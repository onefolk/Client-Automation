"""Robots-aware research; deny on ambiguous robots failures or access challenges."""
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser
import time
from src.network import SafeFetcher, is_safe_url
from src.config import USER_AGENT

class PermittedFetcher(SafeFetcher):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.robots = {}
        self.last_request = {}

    def fetch_html(self, url, max_redirects=3):
        origin = '{0.scheme}://{0.netloc}'.format(urlsplit(url))
        if origin not in self.robots:
            if not is_safe_url(origin) or self.count >= self.limit: return None
            self.count += 1
            try:
                with self.session.get(origin+'/robots.txt', timeout=self.timeout, allow_redirects=False) as response:
                    parser = RobotFileParser()
                    if response.status_code == 404: parser.parse([])
                    elif response.status_code == 200: parser.parse(response.text[:100000].splitlines())
                    else: return None
                    self.robots[origin] = parser
            except Exception:
                return None
        rules = self.robots[origin]
        if not rules.can_fetch(USER_AGENT, url): return None
        delay = max(1, rules.crawl_delay(USER_AGENT) or 1)
        if delay > 10: return None
        time.sleep(max(0, delay - (time.monotonic()-self.last_request.get(origin,0))))
        self.last_request[origin] = time.monotonic()
        # Do not follow unverified redirects into a different robots policy.
        return super().fetch_html(url, max_redirects=0)
