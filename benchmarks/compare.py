"""Read-only provider experiment. Never connects to Sheets or Gmail.

Frozen identical HTML inputs isolate extraction differences from site changes.
Production eligibility remains unmeasured: this job has no historical-contact data.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from src.config import get_active_campaign, load_portfolio
from src.discovery import read_csv_file
from src.network import canonical_url, extract_domain
from src.permitted_fetcher import PermittedFetcher
from src.providers.discovery import DirectoryDiscoveryProvider, PublicDataDiscoveryProvider
from src.providers.research import LightweightResearchProvider, Crawl4AIResearchProvider
from src.providers.verification import PythonVerificationProvider, TruemailVerificationProvider
from src.research import NAVIGATION_KEYWORDS
from src.verifier import extract_emails_from_html

OUT = Path('benchmark-results')
OUT.mkdir(exist_ok=True)

def save(name, value):
    (OUT/(name+'.json')).write_text(json.dumps(value, indent=2), encoding='utf-8')

def read(name):
    return json.loads((OUT/(name+'.json')).read_text(encoding='utf-8'))

class MemoryStore:
    def __init__(self): self.data = {}
    def get(self, key, default=None): return self.data.get(key, default)
    def put(self, key, value): self.data[key] = value
    def put_many_new(self, values):
        for key, value in values.items(): self.data.setdefault(key, value)

class SnapshotFetcher:
    def __init__(self, pages): self.pages, self.count = pages, 0
    def fetch_html(self, url, **kwargs):
        self.count += 1
        return self.pages.get(canonical_url(url))

def collect():
    fetcher = PermittedFetcher(max_fetches=70)
    campaign = get_active_campaign()
    seeds, notices = DirectoryDiscoveryProvider(campaign, fetcher, ()).discover()
    store = MemoryStore()
    fresh, errors = PublicDataDiscoveryProvider(store, campaign).discover()
    # This is a seed-stratified research sample, NOT newly discovered businesses.
    selected, industries = [], set()
    for row in read_csv_file('seeds.csv'):
        if row['industry'] not in industries:
            selected.append(row); industries.add(row['industry'])
        if len(selected) == 8: break
    pages, audit = {}, []
    for row in selected:
        url = canonical_url(row['website'])
        html = fetcher.fetch_html(url)
        if not html or re.search(r'cf-chl-|verify you are human|captcha challenge',html,re.I):
            audit.append({'url':url, 'status':'UNAVAILABLE_OR_ROBOTS_DENIED'}); continue
        soup = BeautifulSoup(html, 'html.parser')
        # Public access/robots do not override site terms. Skip explicit restrictions.
        terms = next((urljoin(url,a['href']) for a in soup.select('a[href]')
                      if re.search(r'terms|conditions',a.get_text(' ',strip=True),re.I)
                      and extract_domain(urljoin(url,a['href'])) == extract_domain(url)), None)
        terms_html = fetcher.fetch_html(terms) if terms else None
        restrictive = bool(terms_html and re.search(
            r'(?:prohibit|not permitted|may not|must not|shall not)[\s\S]{0,180}(?:scrap|crawl|automated|data mining)',
            BeautifulSoup(terms_html,'html.parser').get_text(' ',strip=True), re.I))
        if restrictive or (terms and not terms_html):
            audit.append({'url':url,'status':'TERMS_RESTRICTED_OR_UNAVAILABLE','terms_url':terms}); continue
        pages[url] = html
        audit.append({'url':url,'status':'PUBLIC_ROBOTS_ALLOWED','terms_url':terms,
                      'terms_review':'No detected restriction; automated screening is not legal clearance'})
        links = []
        for a in soup.select('a[href]'):
            target = canonical_url(urljoin(url,a['href']))
            if extract_domain(target)==extract_domain(url) and target!=url and target not in links and any(
                word in (target+' '+a.get_text(' ',strip=True)).lower() for word in NAVIGATION_KEYWORDS):
                links.append(target)
            if len(links)==4: break
        for target in links:
            content=fetcher.fetch_html(target)
            if content: pages[target]=content
    proof=next(p['evidence_url'] for p in load_portfolio() if p['project']=='OneFolk website')
    proof_html=fetcher.fetch_html(proof)
    if proof_html: pages[canonical_url(proof)]=proof_html
    save('snapshots',pages)
    save('sample',selected)
    save('collection',{'timestamp':datetime.now(timezone.utc).isoformat(),'http_requests':fetcher.count,
        'seed_candidates':len({extract_domain(x['website']) for x in seeds}),
        'new_osm_candidates':len({extract_domain(x['website']) for x in fresh}),
        'discovery_errors':errors+notices, 'osm_checkpoint':store.get('source:osm'),
        'sample_industries':sorted(industries),'source_reviews':audit,
        'evidence':[{'url':url,'sha256':hashlib.sha256(html.encode()).hexdigest()} for url,html in pages.items()]})

def research(kind):
    start=time.monotonic(); pages=read('snapshots'); sample=read('sample')
    transport=SnapshotFetcher(pages)
    provider=(LightweightResearchProvider if kind=='lightweight' else Crawl4AIResearchProvider)(transport)
    smoke = None
    if kind=='crawl4ai':
        # Synthetic capability check is explicitly excluded from all lead counts.
        from src.providers.research import Crawl4AIFetcher
        fixture=SnapshotFetcher({'https://fixture.invalid/':'<html><body><div id="x"></div><script>document.getElementById("x").textContent="rendered fixture";</script></body></html>'})
        renderer=Crawl4AIFetcher(fixture)
        output=renderer.fetch_html('https://fixture.invalid/')
        smoke={'actual_tool_successes':renderer.rendered,'fallbacks':renderer.fallbacks,
               'inline_js_rendered':'rendered fixture' in BeautifulSoup(output or '', 'html.parser').get_text()}
    records=[]; contacts={}; identities=set()
    for row in sample:
        domain=extract_domain(row['website'])
        # Count contacts from this provider's output, before DNS validation.
        for url in pages:
            if extract_domain(url)!=domain: continue
            html=provider.fetcher.fetch_html(url)
            for email,source in extract_emails_from_html(html or '',domain,url,check_dns=False):
                contacts[email]={'email':email,'official_domain':domain,'source_url':source}
        result=provider.investigate(row)
        if result: records.append(result)
        text=BeautifulSoup(pages.get(canonical_url(row['website']),''),'html.parser').get_text(' ',strip=True).lower()
        words=[w.lower() for w in re.findall(r'[A-Za-z]{3,}',row['name']) if w.lower() not in ('the','and','limited')]
        if any(word in text for word in words): identities.add(domain)
    save(kind,{'provider':provider.name,'sample_businesses':len(sample),'valid_official_domains':len(identities),
        'publicly_sourced_contacts':len(contacts),'contacts':list(contacts.values()),
        'specific_opportunities':sum(bool(r.get('opportunity')) for r in records),
        'evidence_qualified_candidates':sum(r['qualification_status']=='QUALIFIED' for r in records),
        'production_qualified_leads':None,'production_eligibility_note':'History/suppression unavailable in isolated benchmark',
        'records':records,'wall_seconds':round(time.monotonic()-start,3),
        'crawl4ai_successful_pages':getattr(provider.fetcher,'rendered',0),
        'crawl4ai_fallback_pages':getattr(provider.fetcher,'fallbacks',0),
        'crawl4ai_failures':getattr(provider.fetcher,'failures',[]),'synthetic_capability_check':smoke})
    if kind=='crawl4ai' and (not smoke['actual_tool_successes'] or not smoke['inline_js_rendered']):
        raise RuntimeError('Crawl4AI browser capability failed; raw HTML pass-through is not rendering proof')

def verify(kind):
    provider=PythonVerificationProvider() if kind=='python' else TruemailVerificationProvider()
    contacts={c['email']:c for name in ('lightweight','crawl4ai') for c in read(name)['contacts']}
    results=[]
    for contact in list(contacts.values())[:30]:
        try: results.append(provider.verify(**contact))
        except Exception as exc: results.append({**contact,'valid':False,'error':type(exc).__name__})
    save('verify-'+kind,{'provider':provider.name,'tested':len(results),
        'passing':sum(r['valid'] for r in results),'errors':sum('error' in r for r in results),'results':results})
    if any('error' in r for r in results): raise RuntimeError('Verifier execution errors; inspect saved results')

def drafts():
    from src.groq_client import GroqClient
    from src.quality import validate_queued_draft
    client=GroqClient(max_calls=4); records={}; outcomes=[]
    for name in ('lightweight','crawl4ai'):
        for row in read(name)['records']:
            if row['qualification_status']=='QUALIFIED': records[row['lead_id']]=row
    for row in list(records.values())[:4]:
        draft=client.draft_outreach(row,row,max_retries=1)
        valid,reason=validate_queued_draft({**row,**(draft or {})})
        outcomes.append({'lead_id':row['lead_id'],'valid':valid,'reason':reason,'draft':draft})
    save('drafts',{'api_configured':bool(client.api_key),'calls':client.calls_used,
        'quota_exhausted':client.quota_exhausted,'compliant_drafts':sum(x['valid'] for x in outcomes),
        'outcomes':outcomes,'uploaded_to_sheet':0,'prospect_emails_sent':0})

def report():
    names=('collection','lightweight','crawl4ai','verify-python','verify-truemail','drafts')
    missing=[name for name in names if not (OUT/(name+'.json')).exists()]
    measurements={p.stem:json.loads(p.read_text()) for p in OUT.glob('*.json')
                  if p.stem.startswith(('install-','research-','verification-')) or p.stem in ('collect-process','drafting','maps-help')}
    result={'event':os.getenv('GITHUB_EVENT_NAME','local'),'run_id':os.getenv('GITHUB_RUN_ID'),
        'missing_stages':missing,'measurements':measurements,
        'experiment_complete':not missing and all(m.get('exit_code')==0 for m in measurements.values()),
        'commit':os.getenv('GITHUB_SHA'),'finished_at':datetime.now(timezone.utc).isoformat(),
        'results':{name:read(name) for name in names if (OUT/(name+'.json')).exists()},
        'maps':'INSTALL_AND_HELP_ONLY: extraction policy blocked; no Maps queries',
        'production_promoted':False,'sending_enabled':False,
        'limitations':['Small stratified seed sample; not a population yield estimate',
            'Crawl4AI offline rendering excludes external JavaScript and dynamic API calls',
            'No historical-contact/suppression access; no production READY claims',
            'Account-wide free allowance not available; job hard cap 20 minutes, weekly schedule']}
    save('report',result)
    print(json.dumps({k:v for k,v in result.items() if k!='results'},indent=2))

if __name__=='__main__':
    action=sys.argv[1]
    if action=='collect': collect()
    elif action=='research': research(sys.argv[2])
    elif action=='verify': verify(sys.argv[2])
    elif action=='drafts': drafts()
    elif action=='report': report()
    else: raise SystemExit('Unknown benchmark command')
