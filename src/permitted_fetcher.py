"""Robots-aware bounded crawler: each redirect rechecks destination policy."""
from urllib.parse import urlsplit
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

    def _before_fetch(self, url, deadline):
        parts = urlsplit(url)
        origin = f'{parts.scheme}://{parts.netloc}'
        if origin not in self.robots:
            response = None
            try:
                response = self._request(origin + '/robots.txt', deadline)
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
