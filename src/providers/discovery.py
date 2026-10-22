"""Adapters do not change source permissions or imply that listings are verified."""
import os
import subprocess
from src.discovery import DiscoveryEngine, read_csv_file
from src.open_discovery import OpenDiscovery, company_id
from src.network import extract_domain, canonical_url

class PublicDataDiscoveryProvider:
    name='open-public-data'
    def __init__(self, store, campaign): self.engine=OpenDiscovery(store,campaign)
    def discover(self): return self.engine.harvest()

class DirectoryDiscoveryProvider:
    name='existing-directories'
    def __init__(self, campaign, fetcher, permitted_directory_urls=()):
        self.engine=DiscoveryEngine(campaign)
        self.fetcher=fetcher
        self.permitted=set(permitted_directory_urls)
    def discover(self):
        rows=[r for r in read_csv_file('directories.csv') if r['directory_url'] in self.permitted]
        candidates,report=self.engine.harvest_candidates(self.fetcher, directory_rows=rows)
        unique={}
        for candidate in candidates:
            website=canonical_url(candidate['website'])
            cid=company_id(website)
            unique.setdefault(cid,{**candidate,'website':website,'company_id':cid,'state':'DISCOVERED'})
        return list(unique.values()), [] if rows else ['No directory permission entries; curated seed candidates only']

class MapsScraperDiscoveryProvider:
    """Optional installed executable; extraction stays disabled pending source permission.

    The executable is exercised for installation/CLI compatibility only. A software
    license is NOT a permission record for the underlying Maps content.
    """
    name='google-maps-scraper'
    def __init__(self, binary='google-maps-scraper'): self.binary=binary
    def smoke_test(self):
        return subprocess.run([self.binary,'-h'],capture_output=True,text=True,timeout=30,
                              env={**os.environ,'DISABLE_TELEMETRY':'1'})
    def discover(self):
        return [], ['POLICY_BLOCKED: no permission for Google Maps extraction; no queries sent']
