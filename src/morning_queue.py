"""Scheduled bounded work, durable reserve, and read-after-write publication."""
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import json
import os
import time
from src.writer_policy import require_production_writer
from src.config import (
    CALL_LIST_HEADERS, LEAD_TYPE_NO_WEBSITE, NO_SITE_SEARCHES_PER_DAY, NO_SITE_SEARCHES_PER_RUN, TAB_CALL_LIST,
    get_active_campaign, is_no_site_lead, validate_credentials,
)
from src.no_site_verifier import NoSiteResearcher, SearchUnavailable
from src.sheets import SheetsManager
from src.suppression import SuppressionManager
from src.groq_client import GroqClient
from src.permitted_fetcher import PermittedFetcher
from src.strict_research import StrictResearcher, RESEARCH_VERSION
from src.network import extract_domain
from src.open_discovery import OpenDiscovery, company_id
from src.reserve import ReserveStore, append_records
from src.quality import validate_queued_draft, eligible_queue

IST = ZoneInfo("Asia/Kolkata")

def campaign_day(now):
    local = now.astimezone(IST)
    day = local.date() + (timedelta(days=1) if local.hour >= 22 else timedelta())
    while day.weekday() >= 5: day += timedelta(days=1)
    return str(day)

class MorningQueueManager:
    def __init__(self, target_queue=None, dry_run=False):
        if target_queue is None:
            env_target = os.getenv('TARGET_QUEUE') or os.getenv('MORNING_TARGET')
            target_queue = int(env_target) if env_target else 10
        self.target_queue = min(50, max(1, target_queue))
        self.dry_run = dry_run
        self.sheets = SheetsManager()
        self.campaign_cfg = get_active_campaign()

    def run(self, publish_only=False):
        if self.dry_run:
            raise ValueError("Use the isolated test harness; production orchestrator never invents dry-run leads")
        require_production_writer()
        validate_credentials(require_groq=not publish_only, require_sheets=True)
        if not self.sheets.connect(): raise RuntimeError("Sheet credentials/connectivity failed")
        self.sheets.initialize_schema()
        store = ReserveStore(self.sheets)
        started_monotonic = time.monotonic()
        now = datetime.now(IST)
        day = campaign_day(now)
        slot = os.getenv('SCHEDULE_SLOT', 'local')
        github_run_id = os.getenv('GITHUB_RUN_ID')
        if github_run_id:
            run_id = github_run_id
            slot_key = 'slot:' + day + ':' + slot + ':' + github_run_id
        else:
            slot_key = 'slot:' + day + ':' + slot
            prior = store.get(slot_key)
            run_id = prior.get('run_id') if (prior and prior.get('status') == 'READY') else ('local_' + str(int(now.timestamp())))

        repo_name = os.getenv('GITHUB_REPOSITORY', 'onefolk/Client-Automation')
        summary = {'run_id':run_id, 'campaign_date':day, 'start_time':now.isoformat(),
                   'trigger':os.getenv('GITHUB_EVENT_NAME','local'), 'status':'RUNNING',
                   'workflow_url':(f'https://github.com/{repo_name}/actions/runs/'+run_id) if run_id.isdigit() else '',
                   'newly_discovered_today':0, 'qualified_overnight':0, 'api_failures':0,
                   'ready_for_approval':0, 'needs_research':0, 'rejected':0,
                   'suppressed_or_duplicate':0, 'shortage_reasons':[], 'target_queue':self.target_queue,
                   'no_site_checked':0, 'no_site_qualified':0, 'call_list_added':0, 'no_site_found_website':0}

        prior = store.get(slot_key)
        if prior and prior.get('status') == 'READY':
            publish_only = True  # Re-read human edits/suppressions without spending another AI batch.
        store.put('health:last_attempt', summary)
        try:
            month_key='runner_budget:'+day[:7]
            runner_budget=store.get(month_key, {'reserved_minutes':0})
            if runner_budget['reserved_minutes']+12 > 1500:
                raise RuntimeError('Monthly pipeline runner allowance exhausted (1500 minutes)')
            runner_budget['reserved_minutes']+=12
            store.put(month_key,runner_budget)
            summary['runner_minutes_reserved_month']=runner_budget['reserved_minutes']
            if runner_budget['reserved_minutes']>=1200:
                summary['shortage_reasons'].append('Pipeline runner allowance above 80%; account-wide billing still requires independent verification')
            supp, sent, queue = self.sheets.load_historical_suppression_data()
            suppression = SuppressionManager()
            suppression.load_from_sheet_data(supp,sent,queue)
            ready, invalid = eligible_queue(queue,suppression)
            summary['drawn_from_backlog'] = len(ready)
            existing_ids = {str(r.get('lead_id','')) for r in queue}
            existing_domains = {str(r.get('company_id','')) for r in ready}
            existing_domains.update(str(r.get('company_id','')) for r in queue if r.get('status')=='APPROVED')
            # Import the existing inventory once so discovery never starts again at the old seed list.
            old_leads=self.sheets.spreadsheet.worksheet('Lead Database').get_all_records()
            store.put_many_new({'prospect:'+company_id(r['website']):{
                'company_id':company_id(r['website']), 'name':r.get('business',''),
                'business':r.get('business',''), 'website':r['website'], 'industry':r.get('industry','other'),
                'city':r.get('city',''), 'source_url':r.get('source_url',''), 'state':'DISCOVERED',
                'last_attempt':0, 'reason':'Legacy evidence incomplete; automatically re-research'
            } for r in old_leads if r.get('website')})
            # Never rewrite operator-owned queue rows from a stale pipeline snapshot.
            # Validators exclude invalid rows; retain their original content and decisions.
            summary['invalid_pending_rows'] = len(invalid)
            if not publish_only:
                discovered, errors = [], []
                discovery = OpenDiscovery(store, self.campaign_cfg)
                for _ in range(3):
                    d, errs = discovery.harvest()
                    discovered.extend(d)
                    errors.extend(errs)
                    if len(discovered) >= 15:
                        break
                summary['newly_discovered_today'] = len(discovered)
                summary['shortage_reasons'] += errors
                fetcher = PermittedFetcher(max_fetches=250)
                researcher = StrictResearcher(fetcher)
                # Reserve the whole call allowance BEFORE network work; crashes cannot reset it.
                budget_key='budget:'+day
                budget=store.get(budget_key, {'ai_reserved':0,'batches':0})
                calls=min(30, max(0,120-budget['ai_reserved']))
                if budget['batches'] >= 6: calls=0
                budget['ai_reserved'] += calls
                budget['batches'] += 1
                store.put(budget_key,budget)
                groq=GroqClient(max_calls=calls)
                # Reserved up front like the AI budget, so a crash can never overspend search credits.
                search_key='no_site_budget:'+day
                search_budget=store.get(search_key,{'reserved':0})
                searches=min(NO_SITE_SEARCHES_PER_RUN,max(0,NO_SITE_SEARCHES_PER_DAY-search_budget['reserved']))
                search_budget['reserved']+=searches
                store.put(search_key,search_budget)
                no_site=NoSiteResearcher(fetcher,max_searches=searches)
                call_ws=self.sheets.ensure_tab(TAB_CALL_LIST,CALL_LIST_HEADERS)
                suppression.load_call_list(call_ws.get_all_records() if call_ws else [])
                # No-website leads go first; once their search budget is spent the website lane continues.
                prospects=sorted(store.values('prospect:'), key=lambda p:(
                    0 if p.get('state') in ('QUALIFIED','QUALIFIED_CONTACTABLE','DRAFTED') else 1,
                    0 if is_no_site_lead(p) else 1, p.get('last_attempt',0)))
                if not no_site.api_key and any(is_no_site_lead(p) and p.get('state')=='DISCOVERED' for p in prospects):
                    summary['shortage_reasons'].append('No-website leads waiting: SERPER_API_KEY is required to verify them')
                completed=0
                for prospect in prospects:
                    if time.monotonic() - started_monotonic > 840 or completed >= 40: break
                    if len(ready) >= 100: break
                    if prospect.get('state')=='QUEUED' and prospect['company_id'] not in existing_domains:
                        prospect['state']='DRAFTED'  # Missing/stale Sheet row: replay outbox or re-research.
                    if prospect.get('state') in ('QUEUED','SUPPRESSED','REJECTED','ROUTED_HAS_SITE','CALL_LISTED'): continue
                    if is_no_site_lead(prospect) and not no_site.can_verify() and not prospect.get('record') and not prospect.get('research'):
                        continue
                    if (prospect.get('state') in ('NEEDS_RESEARCH','QUALIFIED_CONTACT_MISSING','NEEDS_OPPORTUNITY_EVIDENCE','WEBSITE_UNAVAILABLE','EMAIL_VALIDATION_FAILED')
                        and prospect.get('research_version') == RESEARCH_VERSION
                        and time.time()-prospect.get('last_attempt',0)<14*86400): continue
                    cid=prospect['company_id']
                    if cid in existing_domains: continue
                    company_site=prospect.get('website') or prospect.get('dead_domain','')
                    blocked,_=suppression.is_suppressed(prospect.get('public_email',''),company_site)
                    if blocked:
                        prospect['state']='SUPPRESSED'; store.put('prospect:'+cid,prospect)
                        continue
                    completed+=1
                    # Outbox retry: retain a validated draft after interrupted Sheet writes.
                    record=prospect.get('record')
                    valid=bool(record and validate_queued_draft(record)[0])
                    if not valid:
                        research=prospect.get('research')
                        fresh=False
                        if research and prospect.get('research_version') == RESEARCH_VERSION:
                            try: fresh=(now-datetime.fromisoformat(research['last_verified_at'])).total_seconds()<7*86400
                            except (KeyError,ValueError,TypeError): pass
                        if not fresh:
                            try:
                                if is_no_site_lead(prospect):
                                    research=no_site.investigate(prospect)
                                    summary['no_site_checked']+=1
                                else:
                                    research=researcher.investigate(prospect)
                            except SearchUnavailable as exc:
                                # Nothing was learned, so the lead stays untouched for a later run.
                                reason='No-website verification paused: '+str(exc)
                                if reason not in summary['shortage_reasons']:
                                    summary['shortage_reasons'].append(reason)
                                continue
                        prospect['last_attempt']=time.time()
                        prospect['research']=research
                        prospect['research_version']=RESEARCH_VERSION
                        if not research:
                            prospect['state']='WEBSITE_UNAVAILABLE'; store.put('prospect:'+cid,prospect); continue
                        q_status = research.get('qualification_status')
                        if research.get('dead_site_reason'):
                            # The domain is gone or parked: re-check this company in the no-website lane.
                            prospect.update(lead_type=LEAD_TYPE_NO_WEBSITE, dead_domain=extract_domain(prospect.get('website','')),
                                            website='', research=None, state='DISCOVERED', last_attempt=0)
                            store.put('prospect:'+cid,prospect); continue
                        if q_status == 'HAS_WEBSITE_FOUND':
                            # Keep the lead: it moves to the normal website pipeline.
                            site_cid=company_id(research['website'])
                            store.put_many_new({'prospect:'+site_cid:{
                                'company_id':site_cid,'name':prospect.get('name',''),'business':prospect.get('business',''),
                                'website':research['website'],'industry':prospect.get('industry','other'),'city':prospect.get('city',''),
                                'source_url':prospect.get('source_url',''),'source':prospect.get('source',''),
                                'state':'DISCOVERED','discovered_at':time.time()}})
                            prospect['state']='ROUTED_HAS_SITE'
                            summary['no_site_found_website']+=1
                            store.put('prospect:'+cid,prospect); continue
                        if q_status == 'CALL_LIST':
                            if suppression.is_phone_blocked(research.get('phone','')):
                                prospect['state']='SUPPRESSED'; store.put('prospect:'+cid,prospect); continue
                            call_row={h:research.get(h,'') for h in CALL_LIST_HEADERS}
                            call_row.update(evidence_url=research.get('observation_url',''),status='TO_CALL',created_at=now.isoformat())
                            append_records(self.sheets,TAB_CALL_LIST,[call_row])
                            suppression.known_phones.add(research.get('phone',''))
                            prospect['state']='CALL_LISTED'
                            summary['call_list_added']+=1
                            store.put('prospect:'+cid,prospect); continue
                        if q_status == 'QUALIFIED_CONTACT_MISSING':
                            prospect['state']='QUALIFIED_CONTACT_MISSING'
                            if 'research' in prospect and isinstance(prospect['research'], dict):
                                prospect['research'].pop('page_contexts', None)
                            store.put('prospect:'+cid,prospect)
                            lead_record = {
                                'lead_id': research.get('lead_id', 'lead_'+cid),
                                'company_id': cid,
                                'business': research.get('business', prospect.get('name', '')),
                                'industry': prospect.get('industry', 'other'),
                                'city': prospect.get('city', ''),
                                'website': prospect.get('website', ''),
                                'source_url': prospect.get('source_url', ''),
                                'public_email': '',
                                'email_source_url': '',
                                'qualification_score': research.get('qualification_score', 0),
                                'qualification_status': 'QUALIFIED_CONTACT_MISSING',
                                'opportunity_category': research.get('opportunity_category', 'COMMERCIAL_OPPORTUNITY'),
                                'observation': research.get('observation', ''),
                                'observation_url': research.get('observation_url', ''),
                                'observation_type': research.get('observation_type', ''),
                                'opportunity': research.get('opportunity', ''),
                                'business_relevance': research.get('business_relevance', ''),
                                'recommended_service': research.get('recommended_service', ''),
                                'confidence_level': research.get('confidence_level', 'LOW'),
                                'qualification_reason': research.get('qualification_reason', ''),
                                'proof_project': research.get('proof_project', ''),
                                'last_verified_at': research.get('last_verified_at', now.isoformat()),
                                'discovered_at': now.isoformat(),
                                'updated_at': now.isoformat()
                            }
                            append_records(self.sheets,'Lead Database',[lead_record],refresh_pending=True)
                            continue
                        if q_status not in ('QUALIFIED', 'QUALIFIED_CONTACTABLE'):
                            prospect['state']=q_status or 'NEEDS_RESEARCH'
                            if 'research' in prospect and isinstance(prospect['research'], dict):
                                prospect['research'].pop('page_contexts', None)
                            store.put('prospect:'+cid,prospect); continue
                        blocked,_=suppression.is_suppressed(research.get('public_email',''),research.get('website','') or company_site)
                        if blocked or suppression.is_phone_opted_out(research.get('phone','')):
                            prospect['state']='SUPPRESSED'; store.put('prospect:'+cid,prospect); continue
                        prospect['state']='QUALIFIED' if prospect.get('state')=='QUALIFIED' else 'QUALIFIED_CONTACTABLE'; store.put('prospect:'+cid,prospect)
                        summary['qualified_overnight']+=1
                        if is_no_site_lead(prospect): summary['no_site_qualified']+=1
                        if not groq.is_available():
                            # Keep researching other prospects: qualified leads are saved and drafted later.
                            reason='Groq call budget exhausted; qualified reserve saved'
                            if reason not in summary['shortage_reasons']:
                                summary['shortage_reasons'].append(reason)
                            continue
                        draft=groq.draft_outreach(prospect,research)
                        if not draft:
                            summary['api_failures']+=1; continue
                        record={**research, **draft, 'campaign_date':day, 'status':'AWAITING_REVIEW',
                                'approval':'PENDING','created_at':now.isoformat(),'updated_at':now.isoformat(),
                                'source':prospect.get('source','')}
                        record.pop('page_contexts',None)
                        if not validate_queued_draft(record)[0]:
                            summary['api_failures']+=1; continue
                        prospect['record']=record
                        prospect['state']='DRAFTED'
                        if 'research' in prospect and isinstance(prospect['research'], dict):
                            prospect['research'].pop('page_contexts', None)
                        store.put('prospect:'+cid,prospect)
                    append_records(self.sheets,'Lead Database',[record],refresh_pending=True)
                    append_records(self.sheets,'Approval Queue',[record],refresh_pending=True)
                    prospect['state']='QUEUED'
                    if 'research' in prospect and isinstance(prospect['research'], dict):
                        prospect['research'].pop('page_contexts', None)
                    store.put('prospect:'+cid,prospect)
                    ready.append(record)
                    existing_domains.add(cid)
                summary['ai_calls_used']=groq.calls_used
                # The batch reserved its whole allowance up front; give back what it did not spend
                # so later batches today can still draft qualified leads.
                unused=calls-groq.calls_used
                if unused>0:
                    budget['ai_reserved']=max(0,budget['ai_reserved']-unused)
                    store.put(budget_key,budget)
                unused_searches=searches-no_site.searches_used
                if unused_searches>0:
                    search_budget['reserved']=max(0,search_budget['reserved']-unused_searches)
                    store.put(search_key,search_budget)
                summary['http_fetches_used']=fetcher.count
            # Only live readback can establish readiness; repeat suppression after all writes.
            supp,sent,queue=self.sheets.load_historical_suppression_data()
            suppression=SuppressionManager(); suppression.load_from_sheet_data(supp,sent,queue)
            ready,invalid=eligible_queue(queue,suppression)
            summary['ready_for_approval']=len(ready)
            prospects=store.values('prospect:')
            summary['needs_research']=sum(p.get('state') in ('NEEDS_RESEARCH','LEGACY_REVIEW','QUALIFIED_CONTACT_MISSING','NEEDS_OPPORTUNITY_EVIDENCE','WEBSITE_UNAVAILABLE','EMAIL_VALIDATION_FAILED') for p in prospects)
            summary['suppressed_or_duplicate']=sum(p.get('state')=='SUPPRESSED' for p in prospects)
            summary['reserve_qualified']=sum(p.get('state') in ('QUALIFIED','QUALIFIED_CONTACTABLE','DRAFTED') for p in prospects)
            summary['rejected']=sum(r.get('status')=='REJECTED' for r in queue)
            sources={p.get('source','legacy') for p in prospects}
            for source in sources:
                members=[p for p in prospects if p.get('source','legacy')==source]
                q=[r for r in queue if r.get('source','legacy')==source]
                append_records(self.sheets,'Source Performance',[{
                    'source_run_id':run_id+':'+source,'source':source,'run_id':run_id,
                    'discovered':len(members),'qualified_reserve':sum(p.get('state') in ('QUALIFIED','QUALIFIED_CONTACTABLE') for p in members),
                    'queued':sum(p.get('state')=='QUEUED' for p in members),
                    'needs_research':sum(p.get('state') in ('NEEDS_RESEARCH','LEGACY_REVIEW','QUALIFIED_CONTACT_MISSING','NEEDS_OPPORTUNITY_EVIDENCE','WEBSITE_UNAVAILABLE','EMAIL_VALIDATION_FAILED') for p in members),
                    'sent':sum(r.get('status')=='SENT' for r in q),
                    'positive_reply':sum(r.get('status')=='POSITIVE_REPLY' for r in q),
                    'bounced':sum(r.get('status')=='BOUNCED' for r in q)
                }],key='source_run_id')
            # Operational Target: 10+ High-Priority Leads (score >= 80)
            top_10 = [
                r for r in ready
                if int(r.get('priority_score', r.get('qualification_score', 0)) or 0) >= 80
            ]
            secondary = [r for r in ready if r not in top_10]
            summary['top_10_priority'] = len(top_10)
            summary['secondary_backlog'] = len(secondary)
            primary_target = self.target_queue
            summary['shortage'] = max(0, primary_target - len(top_10))
            if summary['shortage'] > 0:
                summary['shortage_reasons'].append(
                    f"Honest Shortage: Only {len(top_10)}/{primary_target} prospects met the strict 80/100 priority qualification standard. Maintaining high-quality threshold rather than compromising criteria."
                )
            if summary['api_failures']: summary['shortage_reasons'].append('Groq output validation or API failures')
            summary['status'] = 'READY' if summary['shortage'] == 0 and not summary['api_failures'] else 'SHORTFALL'
            summary['end_time']=datetime.now(IST).isoformat()
            append_records(self.sheets,'Campaign Runs',[summary],key='run_id')
            # Dedicated metrics do not overwrite or inflate the legacy Dashboard counters.
            dash=self.sheets.ensure_tab('Morning Health',['Metric','Value'])
            dash.update(range_name='A1',values=[['Metric','Value']]+[[k,json.dumps(v) if isinstance(v,list) else v] for k,v in summary.items()],value_input_option='RAW')
            store.put('health:last_success',summary)
            store.put('health:last_attempt',summary)
            store.put(slot_key,summary)
            write_github_step_summary(summary)
            return summary
        except Exception as exc:
            summary['status']='FAILED'
            summary['shortage_reasons'].append(type(exc).__name__+': automation failed; inspect workflow logs')
            store.put('health:last_attempt',summary)
            write_github_step_summary(summary)
            raise


def write_github_step_summary(summary: dict):
    summary_path = os.getenv('GITHUB_STEP_SUMMARY')
    if not summary_path:
        return
    try:
        status_badge = "🟢 **READY**" if summary.get('status') == 'READY' else ("🔴 **FAILED**" if summary.get('status') == 'FAILED' else "🟡 **SHORTFALL (Quality Standard Preserved)**")
        reasons = "\n".join(f"- {r}" for r in summary.get('shortage_reasons', [])) or "- All operational criteria satisfied."
        md = f"""## 📊 OneFolk Morning Outreach Queue Summary

| Metric | Result |
| :--- | :--- |
| **Execution Status** | {status_badge} |
| **Campaign Date** | `{summary.get('campaign_date', 'N/A')}` |
| **Trigger** | `{summary.get('trigger', 'manual')}` |
| **Target Queue Goal** | `{summary.get('target_queue', 10)}` |
| **Top-10 Priority Ready** | **`{summary.get('top_10_priority', 0)}`** |
| **Newly Discovered Today** | `{summary.get('newly_discovered_today', 0)}` |
| **Backlog (Needs Research)** | `{summary.get('needs_research', 0)}` |
| **Suppressed / Duplicates** | `{summary.get('suppressed_or_duplicate', 0)}` |
| **HTTP Fetches Used** | `{summary.get('http_fetches_used', 0)}` |
| **AI Calls Used** | `{summary.get('ai_calls_used', 0)}` |

### 📝 Notes & Explanations:
{reasons}
"""
        with open(summary_path, 'a', encoding='utf-8') as f:
            f.write(md)
    except Exception as e:
        logger.warning("Could not write GITHUB_STEP_SUMMARY: %s", e)

