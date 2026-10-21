from unittest.mock import Mock
from src import verifier
from src.groq_client import GroqClient

def test_no_dns_and_null_mx_never_pass(monkeypatch):
    verifier.MX_CACHE.clear()
    monkeypatch.setattr(verifier,'DNS_AVAILABLE',False)
    assert not verifier.has_valid_mx_records('fixture.edu')
    monkeypatch.setattr(verifier,'DNS_AVAILABLE',True)
    answer=Mock(exchange='.')
    resolver=Mock(); resolver.resolve.return_value=[answer]
    monkeypatch.setattr(verifier.dns.resolver,'Resolver',lambda:resolver)
    assert not verifier.has_valid_mx_records('nullmx.edu')

def test_invalid_local_and_domain_syntax():
    for email in ('a..b@fixture.edu','.a@fixture.edu','a.@fixture.edu','a@-fixture.edu','a@fixture..edu'):
        assert not verifier.is_valid_syntax(email)

def test_retry_loop_cannot_exceed_reserved_budget(monkeypatch):
    client=GroqClient(api_key='test',max_calls=1)
    response=Mock(status_code=429,headers={'Retry-After':'0'})
    post=Mock(return_value=response)
    monkeypatch.setattr('src.groq_client.requests.post',post)
    monkeypatch.setattr('src.groq_client.time.sleep',lambda _:None)
    assert client.draft_outreach({}, {}) is None
    assert post.call_count==1
