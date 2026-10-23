"""SSRF-guarded, rate-controlled network fetcher and URL utilities."""

import ipaddress
import logging
import socket
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


def is_safe_url(url: str, pinned_ip_holder: Optional[list] = None) -> bool:
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
            addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
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
        })

    def fetch_html(self, url: str, max_redirects: int = 3) -> Optional[str]:
        """Fetches HTML content from URL safely with redirect re-verification and IP pinning."""
        current_url = url
        redirects_followed = 0

        while redirects_followed <= max_redirects:
            if self.count >= self.limit:
                logger.warning("HTTP fetch limit (%d) reached. Skipping %s", self.limit, current_url)
                return None

            ip_holder = []
            if not is_safe_url(current_url, pinned_ip_holder=ip_holder):
                logger.warning("SSRF blocked or unsafe URL: %s", current_url)
                return None

            host = (urlparse(current_url).hostname or "").lower()
            if host and ip_holder:
                self.dns_map[host] = ip_holder[0]

            self.count += 1
            response = None
            try:
                response = self.session.get(
                    current_url,
                    timeout=self.timeout,
                    allow_redirects=False,
                    stream=True,
                )

                # Safe manual redirect following with SSRF check on every hop
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("Location")
                    if not location:
                        return None
                    next_url = urljoin(current_url, location)
                    next_ip_holder = []
                    if not is_safe_url(next_url, pinned_ip_holder=next_ip_holder):
                        logger.warning("SSRF redirect blocked to: %s", next_url)
                        return None
                    next_host = (urlparse(next_url).hostname or "").lower()
                    if next_host and next_ip_holder:
                        self.dns_map[next_host] = next_ip_holder[0]
                    current_url = next_url
                    redirects_followed += 1
                    continue

                if response.status_code != 200:
                    logger.debug("HTTP %d for %s", response.status_code, current_url)
                    return None

                content_type = response.headers.get("Content-Type", "").lower()
                if "html" not in content_type and "xml" not in content_type and "text" not in content_type:
                    return None

                # Bounded read to prevent memory exhaustion (max 1 MB)
                content = response.raw.read(1000000, decode_content=True)
                return content.decode("utf-8", errors="replace")

            except requests.RequestException as e:
                logger.debug("Request failed for %s: %s", current_url, str(e)[:120])
                return None
            except Exception as e:
                logger.debug("Unexpected error fetching %s: %s", current_url, str(e)[:120])
                return None
            finally:
                if response is not None:
                    response.close()

        return None

