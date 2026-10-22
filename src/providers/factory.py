import json
from src.config import CONFIG_DIR
from .discovery import PublicDataDiscoveryProvider, DirectoryDiscoveryProvider, MapsScraperDiscoveryProvider
from .research import LightweightResearchProvider, Crawl4AIResearchProvider
from .verification import PythonVerificationProvider, TruemailVerificationProvider

def provider_config(): return json.loads((CONFIG_DIR/'providers.json').read_text())

def research_provider(fetcher=None, config=None):
    cfg=config or provider_config()
    if cfg['research']=='lightweight': return LightweightResearchProvider(fetcher)
    if cfg['research']=='crawl4ai' and cfg['external_promotion']['approved'] and cfg['external_promotion']['scheduled_benchmark_run']:
        return Crawl4AIResearchProvider(fetcher)
    raise ValueError('External research provider has no measured promotion approval')

def discovery_provider(store,campaign,fetcher=None,config=None):
    cfg=config or provider_config()
    if cfg['discovery']=='open-public-data': return PublicDataDiscoveryProvider(store,campaign)
    if cfg['discovery']=='directories': return DirectoryDiscoveryProvider(campaign,fetcher,cfg['permitted_directory_urls'])
    if cfg['discovery']=='maps': return MapsScraperDiscoveryProvider()
    raise ValueError('Unknown discovery provider')

def verification_provider(config=None):
    cfg=config or provider_config()
    if cfg['verification']=='python-dns': return PythonVerificationProvider()
    if cfg['verification']=='truemail' and cfg['external_promotion']['approved'] and cfg['external_promotion']['scheduled_benchmark_run']:
        return TruemailVerificationProvider()
    raise ValueError('External verifier has no measured promotion approval')
