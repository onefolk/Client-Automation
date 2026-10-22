"""Same qualification rules, interchangeable extraction, explicit fallback metrics."""
import json
import subprocess
import sys
from src.strict_research import StrictResearcher
from src.permitted_fetcher import PermittedFetcher

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
        self.transport=transport; self.fallbacks=0; self.rendered=0; self.cache={}
    @property
    def count(self): return self.transport.count
    def fetch_html(self,url,**kwargs):
        if url in self.cache: return self.cache[url]
        html=self.transport.fetch_html(url)
        if not html: return None
        try:
            process=subprocess.run([sys.executable,'-m','src.providers.crawl_worker'],
                input=json.dumps({'url':url,'html':html}),capture_output=True,text=True,timeout=35,check=True)
            data=json.loads(process.stdout.split('ONEFOLK_RESULT=',1)[1])
            if not data['success'] or not data['html']: raise ValueError('Empty Crawl4AI extraction')
            result=data['html']; self.rendered+=1
        except (subprocess.SubprocessError,ValueError,KeyError,IndexError):
            self.fallbacks+=1; result=html
        self.cache[url]=result
        return result

class Crawl4AIResearchProvider(LightweightResearchProvider):
    name='crawl4ai-with-fallback'
    def __init__(self,fetcher=None):
        super().__init__(Crawl4AIFetcher(fetcher or PermittedFetcher(max_fetches=160)))
