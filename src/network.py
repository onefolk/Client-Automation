"""SSRF-guarded, rate-controlled network fetcher and URL utilities."""

import ipaddress
import logging
import socket
import time
import threading
import queue
from urllib3.util import Timeout
from typing import Optional
from urllib.parse import urljoin, urlparse
import requests

from src.config import HTTP_TIMEOUT_SECONDS, MAX_HTTP_FETCHES, USER_AGENT

logger = logging.getLogger(__name__)


def canonical_url(url: str) -> str:
    """Normalizes and canonicalizes a URL, preserving essential query parameters."""
    if not url:
        return ""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") or "/"
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{scheme}://{netloc}{path}{query}"



def extract_domain(url: str) -> str:
    """Extracts the apex domain/host from a URL, stripping 'www.'."""
    if not url:
        return ""
    try:
        parsed = urlparse(canonical_url(url))
        hostname = (parsed.hostname or "").lower()
        if hostname.startswith("www."):
            hostname = hostname[4:]
        return hostname
    except Exception:
        return ""


def is_ip_safe(ip_str: str) -> bool:
    """Determines if an IP address is a safe, publicly routable global address."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback:  # 127.0.0.0/8, ::1
            return False
        if ip.is_private:  # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            return False
        if ip.is_link_local:  # 169.254.0.0/16 (Cloud Metadata!), fe80::/10
            return False
        if ip.is_multicast:  # 224.0.0.0/4
            return False
        if ip.is_reserved or ip.is_unspecified:  # 0.0.0.0/8
            return False
        # Specific check for AWS / GCP / Azure metadata endpoint
        if ip_str == "169.254.169.254":
            return False
        return ip.is_global
    except ValueError:
        return False


from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.util import connection as urllib3_conn


class PinnedHTTPConnection(HTTPConnection):
    dns_map = None

    def _new_conn(self):
        host_key = self.host.lower()
        dns = self.dns_map or {}
        if host_key not in dns:
            raise OSError(f"Connection rejected: unpinned host {self.host}")
        target_host = dns[host_key]
        extra_kw = {}
        if self.source_address:
            extra_kw["source_address"] = self.source_address
        if self.socket_options:
            extra_kw["socket_options"] = self.socket_options
        return urllib3_conn.create_connection(
            (target_host, self.port),
            self.timeout,
            **extra_kw,
        )


class PinnedHTTPSConnection(HTTPSConnection):
    dns_map = None

    def _new_conn(self):
        host_key = self.host.lower()
        dns = self.dns_map or {}
        if host_key not in dns:
            raise OSError(f"Connection rejected: unpinned host {self.host}")
        target_host = dns[host_key]
        extra_kw = {}
        if self.source_address:
            extra_kw["source_address"] = self.source_address
        if self.socket_options:
            extra_kw["socket_options"] = self.socket_options
        return urllib3_conn.create_connection(
            (target_host, self.port),
            self.timeout,
            **extra_kw,
        )


class PinnedHTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = PinnedHTTPConnection
    dns_map = None

    def _new_conn(self):
        conn = super()._new_conn()
        conn.dns_map = self.dns_map
        return conn


class PinnedHTTPSConnectionPool(HTTPSConnectionPool):
    ConnectionCls = PinnedHTTPSConnection
    dns_map = None

    def _new_conn(self):
        conn = super()._new_conn()
        conn.dns_map = self.dns_map
        return conn


class PinnedPoolManager(PoolManager):
    def __init__(self, dns_map=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.dns_map = dns_map if dns_map is not None else {}
        self.pool_classes_by_scheme = {
            "http": PinnedHTTPConnectionPool,
            "https": PinnedHTTPSConnectionPool,
        }

    def _new_pool(self, scheme, host, port, request_context=None):
        pool = super()._new_pool(scheme, host, port, request_context=request_context)
        pool.dns_map = self.dns_map
        return pool


class PinnedAdapter(HTTPAdapter):
    def __init__(self, dns_map=None, *args, **kwargs):
        self.dns_map = dns_map if dns_map is not None else {}
        super().__init__(*args, **kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        self.poolmanager = PinnedPoolManager(dns_map=self.dns_map, num_pools=connections, maxsize=maxsize, block=block, **pool_kwargs)


_DNS_SLOTS = threading.BoundedSemaphore(4)


def bounded_resolve(hostname, timeout):
    """Bound caller latency and outstanding DNS workers even if OS DNS stalls."""
    if timeout <= 0 or not _DNS_SLOTS.acquire(blocking=False):
        raise TimeoutError('DNS resolver unavailable')
    result = queue.Queue(maxsize=1)
    def resolve():
        try:
            result.put(socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM))
        except Exception as exc:
            result.put(exc)
        finally:
            _DNS_SLOTS.release()
    threading.Thread(target=resolve, daemon=True).start()
    try:
        value = result.get(timeout=timeout)
    except queue.Empty:
        raise TimeoutError('DNS deadline exceeded')
    if isinstance(value, Exception):
        raise value
    return value


def read_bounded(response, max_bytes, deadline):
    """Reject oversized/encoded payloads; never interpret truncated HTML as evidence."""
    encoding = response.headers.get('Content-Encoding', '').lower()
    if encoding not in ('', 'identity'):
        raise ValueError('Compressed responses are not accepted by the bounded crawler')
    length = response.headers.get('Content-Length', '')
    if length and (not length.isdigit() or int(length) > max_bytes):
        raise ValueError('Payload too large or invalid content length')
    content = bytearray()
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Fetch deadline exceeded')
        connection = getattr(response.raw, '_connection', None)
        sock = getattr(connection, 'sock', None)
        if sock is not None:
            sock.settimeout(remaining)
        chunk = response.raw.read1(min(65536, max_bytes + 1 - len(content)), decode_content=False)
        if time.monotonic() > deadline:
            raise TimeoutError('Fetch deadline exceeded')
        if not chunk:
            break
        if not isinstance(chunk, bytes):
            raise ValueError('Invalid response stream')
        content.extend(chunk)
        if len(content) > max_bytes:
            raise ValueError('Payload too large')
    return bytes(content)


def is_safe_url(url: str, pinned_ip_holder: Optional[list] = None, timeout: float = HTTP_TIMEOUT_SECONDS) -> bool:
    """Bulletproof SSRF check with DNS pre-resolution to block internal IP destinations."""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return False

        # Block explicit local/internal names
        if hostname in ("localhost", "local", "internal") or hostname.endswith((".localhost", ".local", ".internal")):
            return False

        # Resolve hostname to actual IP addresses
        try:
            addr_info = bounded_resolve(hostname, timeout)
            if not addr_info:
                return False
            safe_ips = []
            for entry in addr_info:
                ip_str = entry[4][0]
                if not is_ip_safe(ip_str):
                    return False
                safe_ips.append(ip_str)
            if pinned_ip_holder is not None and safe_ips:
                pinned_ip_holder.append(safe_ips[0])
        except socket.gaierror:
            # Domain cannot be resolved via DNS
            return False

        return True
    except Exception:
        return False


class SafeFetcher:
    """SSRF-guarded, bounded HTTP fetcher with pinned destination IP to prevent DNS rebinding."""

    def __init__(self, max_fetches: int = MAX_HTTP_FETCHES, timeout: int = HTTP_TIMEOUT_SECONDS):
        self.count = 0
        self.limit = max_fetches
        self.timeout = timeout
        self.dns_map = {}
        self.session = requests.Session()
        self.session.trust_env = False  # Disable uncontrolled environment proxies
        adapter = PinnedAdapter(self.dns_map)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "identity",
        })

    def _request(self, url, deadline):
        if self.count >= self.limit:
            raise ValueError('HTTP request budget exhausted')
        remaining = deadline - time.monotonic()
        pins = []
        if remaining <= 0 or not is_safe_url(url, pinned_ip_holder=pins, timeout=remaining) or not pins:
            raise ValueError('Unsafe destination or DNS deadline')
        self.dns_map[urlparse(url).hostname.lower()] = pins[0]
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Fetch deadline exceeded')
        self.count += 1
        return self.session.get(url, timeout=Timeout(total=remaining, connect=min(3, remaining), read=min(3, remaining)),
                                allow_redirects=False, stream=True)

    def _before_fetch(self, url, deadline):
        return True

    def _allow_redirect(self, old_url, new_url):
        return True

    def fetch_html(self, url: str, max_redirects: int = 3) -> Optional[str]:
        deadline = time.monotonic() + self.timeout
        current = url
        for hop in range(max_redirects + 1):
            response = None
            try:
                if not self._before_fetch(current, deadline):
                    return None
                response = self._request(current, deadline)
                if response.status_code in (301,302,303,307,308):
                    location = response.headers.get('Location')
                    if not location or hop == max_redirects:
                        return None
                    destination = urljoin(current, location)
                    if not self._allow_redirect(current, destination):
                        return None
                    current = destination
                    continue
                if response.status_code != 200:
                    return None
                content_type = response.headers.get('Content-Type', '').lower()
                if not any(t in content_type for t in ('html', 'xml', 'text')):
                    return None
                content = read_bounded(response, 1000000, deadline)
                self.last_url = current
                return content.decode('utf-8', errors='replace')
            except Exception as exc:
                logger.debug('Fetch rejected for %s: %s', current, type(exc).__name__)
                return None
            finally:
                if response is not None:
                    response.close()
        return None
