"""Robots-aware bounded crawler: each redirect rechecks destination policy."""
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
import time
from src.network import SafeFetcher, read_bounded, extract_domain
from src.config import USER_AGENT


class PermittedFetcher(SafeFetcher):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.robots = {}
        self.last_request = {}

    def _allow_redirect(self, old_url, new_url):
        # Cross-company redirects cannot establish official evidence for the old company.
        return extract_domain(old_url) == extract_domain(new_url)

    def _fetch_robots(self, origin, deadline):
        """Fetch robots.txt, following same-company redirects (e.g. apex to www) as RFC 9309 expects."""
        url = origin + '/robots.txt'
        for _ in range(4):
            response = self._request(url, deadline)
            if response.status_code not in (301, 302, 303, 307, 308):
                return response
            location = response.headers.get('Location')
            response.close()
            target = urljoin(url, location) if location else ''
            if not target or not self._allow_redirect(url, target):
                return None
            url = target
        return None

    def _before_fetch(self, url, deadline):
        parts = urlsplit(url)
        origin = f'{parts.scheme}://{parts.netloc}'
        if origin not in self.robots:
            response = None
            try:
                response = self._fetch_robots(origin, deadline)
                if response is None:
                    return False
                parser = RobotFileParser()
                if response.status_code == 404:
                    parser.parse([])
                elif response.status_code == 200:
                    parser.parse(read_bounded(response, 100000, deadline).decode('utf-8', errors='replace').splitlines())
                else:
                    return False
                self.robots[origin] = parser
            finally:
                if response is not None:
                    response.close()
        rules = self.robots[origin]
        if not rules.can_fetch(USER_AGENT, url):
            return False
        delay = max(1, rules.crawl_delay(USER_AGENT) or 1)
        pause = max(0, delay - (time.monotonic() - self.last_request.get(origin, 0)))
        if delay > 10 or time.monotonic() + pause >= deadline:
            return False
        time.sleep(pause)
        self.last_request[origin] = time.monotonic()
        return True
