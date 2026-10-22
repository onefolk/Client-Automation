"""Same qualification rules, interchangeable extraction, explicit fallback metrics."""
import json
import os
import signal
import subprocess
import sys
from src.strict_research import StrictResearcher
from src.permitted_fetcher import PermittedFetcher

def render_snapshot(payload):
    """Kill the entire Linux browser process group if a worker exceeds its budget."""
    process=subprocess.Popen([sys.executable,'-m','src.providers.crawl_worker'],
        stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,
        start_new_session=os.name!='nt')
    try:
        stdout,stderr=process.communicate(json.dumps(payload),timeout=35)
    except subprocess.TimeoutExpired:
        if os.name!='nt': os.killpg(process.pid,signal.SIGKILL)
        else: process.kill()
        process.communicate()
        raise
    if process.returncode:
        raise subprocess.CalledProcessError(process.returncode, 'crawl4ai-worker')
    return json.loads(stdout.split('ONEFOLK_RESULT=',1)[1])

class LightweightResearchProvider:
    name='lightweight'
    def __init__(self,fetcher=None):
        self.fetcher=fetcher or PermittedFetcher(max_fetches=160)
        self.researcher=StrictResearcher(self.fetcher)
    def investigate(self,candidate): return self.researcher.investigate(candidate)

class Crawl4AIFetcher:
    """Crawl4AI renders permitted snapshots with ALL browser networking disabled.

    Fetch authorization and exact provenance remain in the bounded transport.
    External JS is not fetched or executed. Inline JS can reveal dynamic content.
    This restriction must be disclosed in performance/quality comparisons.
    """
    def __init__(self,transport):
        self.transport=transport; self.fallbacks=0; self.rendered=0; self.cache={}; self.failures=[]
    @property
    def count(self): return self.transport.count
    def fetch_html(self,url,**kwargs):
        if url in self.cache: return self.cache[url]
        html=self.transport.fetch_html(url)
        if not html: return None
        try:
            data=render_snapshot({'url':url,'html':html})
            if not data['success'] or not data['html']: raise ValueError('Empty Crawl4AI extraction')
            result=data['html']; self.rendered+=1
        except (subprocess.SubprocessError,ValueError,KeyError,IndexError,OSError) as exc:
            self.fallbacks+=1; self.failures.append({'url':url,'error':type(exc).__name__}); result=html
        self.cache[url]=result
        return result

class Crawl4AIResearchProvider(LightweightResearchProvider):
    name='crawl4ai-with-fallback'
    def __init__(self,fetcher=None):
        super().__init__(Crawl4AIFetcher(fetcher or PermittedFetcher(max_fetches=160)))
