"""Small rotating Overpass queries against openly licensed OSM data.

OSM is a discovery hint, never proof of business identity or email provenance.
No Google Maps extraction, proxies, login bypass or unreviewed directories.
"""
import hashlib
import json
import time
from pathlib import Path
import requests
from src.config import CONFIG_DIR, USER_AGENT
from src.network import canonical_url, extract_domain, read_bounded

def company_id(website):
    return 'company_' + hashlib.sha256(extract_domain(website).encode()).hexdigest()[:20]

class OpenDiscovery:
    def __init__(self, store, campaign):
        self.store, self.campaign = store, campaign

    def harvest(self):
        # 1. Primary: Serper Google Search API if configured
        from src.serper_discovery import SerperDiscovery
        serper_errors = []
        serper = SerperDiscovery(self.store, self.campaign)
        if serper.is_configured():
            try:
                d, errs = serper.harvest()
            except Exception as exc:
                d, errs = [], ['Serper discovery crashed: ' + type(exc).__name__]
            if d:
                return d, errs
            serper_errors = errs

        # 2. Fallback: OpenStreetMap (OSM / Overpass) when Serper is off, empty or failed
        osm_d, osm_errs = self._harvest_osm()
        return osm_d, serper_errors + osm_errs

    def _harvest_osm(self):
        cfg = json.loads((CONFIG_DIR/'public_sources.json').read_text())
        jobs = [(city, industry, filters) for city in cfg['cities']
                for industry, filters in cfg['industries'].items()
                if industry in self.campaign.get('industries', cfg['industries'])
                and (not self.campaign.get('target_cities') or city['name'] in self.campaign['target_cities'])]
        if not jobs: raise RuntimeError('No configured discovery locations/industries match campaign')
        cursor = self.store.get('source:osm', {'cursor':0})['cursor']
        discovered, errors = [], []
        # One query per invocation: low public-service load, checkpointed partitions.
        city, industry, filters = jobs[cursor % len(jobs)]
        south,west,north,east=city['bbox']
        tile=(cursor // len(jobs)) % 4
        midlat,midlon=(south+north)/2,(west+east)/2
        bbox = ','.join(str(v) for v in (
            south if tile<2 else midlat, west if tile%2==0 else midlon,
            midlat if tile<2 else north, midlon if tile%2==0 else east))
        parts = ''.join(f'nwr[{f}]["website"]({bbox});nwr[{f}]["contact:website"]({bbox});' for f in filters)
        query = '[out:json][timeout:25][maxsize:67108864];(' + parts + ');out tags;'
        endpoints = cfg.get('endpoints') or [cfg.get('endpoint', 'https://overpass-api.de/api/interpreter')]
        last_exc = None
        data = None
        for endpoint in endpoints:
            response = None
            try:
                deadline = time.monotonic() + 35
                response = requests.post(endpoint, data={'data': query},
                                         headers={'User-Agent': USER_AGENT, 'Accept-Encoding':'identity'}, timeout=35, stream=True, allow_redirects=False)
                response.raise_for_status()
                parsed = json.loads(read_bounded(response, 4000000, deadline))
                if not isinstance(parsed, dict) or not isinstance(parsed.get('elements', []), list):
                    raise ValueError('Invalid discovery response')
                if parsed.get('remark'):
                    raise RuntimeError('Overpass returned incomplete query: ' + str(parsed['remark'])[:200])
                data = parsed
                break
            except (requests.RequestException, RuntimeError, ValueError, TimeoutError) as exc:
                last_exc = exc
                continue
            finally:
                if response is not None:
                    response.close()

        if data is None:
            if last_exc:
                errors.append('OSM source unavailable/incomplete: ' + type(last_exc).__name__)
        else:
            try:
                for item in data.get('elements', []):
                    tags = item.get('tags', {})
                    website = tags.get('website') or tags.get('contact:website', '')
                    if not tags.get('name') or not website.startswith(('https://', 'http://')):
                        continue
                    domain = extract_domain(website)
                    if any(domain == x or domain.endswith('.' + x) for x in self.campaign.get('exclusions', [])):
                        continue
                    cid = company_id(website)
                    if self.store.get('prospect:' + cid):
                        continue
                    candidate = {
                        'company_id': cid,
                        'name': tags['name'],
                        'business': tags['name'],
                        'website': canonical_url(website),
                        'industry': industry,
                        'city': city['name'],
                        'source_url': f"https://www.openstreetmap.org/{item['type']}/{item['id']}",
                        'source': 'OpenStreetMap contributors (ODbL)',
                        'state': 'DISCOVERED',
                        'discovered_at': time.time(),
                    }
                    discovered.append(candidate)
                self.store.put_many_new({'prospect:' + c['company_id']: c for c in discovered})
                # Advance only after ALL candidates are durable; replay deduplicates partial writes.
                self.store.put('source:osm', {'cursor': cursor + 1, 'city': city['name'], 'industry': industry})
            except Exception as exc:
                errors.append('Candidate parsing failed: ' + type(exc).__name__)
        self.store.put('source:last_result', {'source':'OSM','new':len(discovered), 'errors':errors,
                                            'partition':cursor, 'timestamp':time.time()})
        return discovered, errors
