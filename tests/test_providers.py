import json
from unittest.mock import Mock
import pytest
from src.providers.factory import research_provider, verification_provider
from src.providers.discovery import MapsScraperDiscoveryProvider, DirectoryDiscoveryProvider
from src.providers.research import Crawl4AIFetcher
from src.providers.verification import PythonVerificationProvider, TruemailVerificationProvider

def test_unmeasured_external_providers_fail_closed():
    for factory,key,value in [(research_provider,'research','crawl4ai'),(verification_provider,'verification','truemail')]:
        with pytest.raises(ValueError):
            factory(config={key:value,'external_promotion':{'approved':False,'scheduled_benchmark_run':''}})

def test_maps_discovery_never_invokes_binary(monkeypatch):
    def forbidden(*a,**kw): raise AssertionError('Maps extraction must not run')
    monkeypatch.setattr('subprocess.run',forbidden)
    candidates,errors=MapsScraperDiscoveryProvider().discover()
    assert candidates==[] and 'POLICY_BLOCKED' in errors[0]

def test_crawl_failure_uses_explicit_counted_fallback(monkeypatch):
    import subprocess
    transport=Mock(); transport.fetch_html.return_value='<p>source</p>'
    def fail(*a,**kw): raise subprocess.TimeoutExpired('worker',35)
    monkeypatch.setattr('subprocess.run',fail)
    fetcher=Crawl4AIFetcher(transport)
    assert fetcher.fetch_html('https://example.com/')=='<p>source</p>'
    assert fetcher.fallbacks==1 and fetcher.rendered==0
    assert fetcher.fetch_html('https://example.com/')=='<p>source</p>'
    assert transport.fetch_html.call_count==1

def test_both_verifiers_reject_wrong_source_without_dns_or_ruby(monkeypatch):
    def forbidden(*a,**kw): raise AssertionError('No verification of unrelated source')
    monkeypatch.setattr('subprocess.run',forbidden)
    for provider in (PythonVerificationProvider(),TruemailVerificationProvider()):
        result=provider.verify('hello@example.com','example.com','https://unrelated.org/')
        assert not result['valid'] and not result['mailbox_confirmed']

def test_unapproved_directories_are_never_fetched(monkeypatch):
    fetcher=Mock()
    engine=DirectoryDiscoveryProvider({},fetcher,())
    engine.engine.harvest_candidates=Mock(return_value=([],{}))
    monkeypatch.setattr('src.providers.discovery.read_csv_file',lambda _: [{'directory_url':'https://unapproved.org'}])
    engine.discover()
    assert engine.engine.harvest_candidates.call_args.kwargs['directory_rows']==[]
    fetcher.fetch_html.assert_not_called()
