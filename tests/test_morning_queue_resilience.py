"""Exercise the actual orchestrator with isolated service boundaries."""
import copy
from unittest.mock import MagicMock
import pytest
from src import morning_queue as mq
from tests.test_morning_queue import valid_record

class Store:
    def __init__(self): self.data={}
    def get(self,k,d=None): return copy.deepcopy(self.data.get(k,d))
    def put(self,k,v): self.data[k]=copy.deepcopy(v)
    def values(self,p): return [copy.deepcopy(v) for k,v in self.data.items() if k.startswith(p)]
    def put_many_new(self,records):
        for k,v in records.items(): self.data.setdefault(k,v)

@pytest.fixture
def rig(monkeypatch):
    store=Store(); queue=[]
    manager=mq.MorningQueueManager(target_queue=2)
    manager.sheets=MagicMock()
    manager.sheets.connect.return_value=True
    manager.sheets.load_historical_suppression_data.side_effect=lambda:([],[],copy.deepcopy(queue))
    manager.sheets.spreadsheet.worksheet.return_value.get_all_records.return_value=[]
    manager.sheets.spreadsheet.worksheet.return_value.row_values.return_value=['lead_id','status']
    monkeypatch.setattr(mq,'ReserveStore',lambda _:store)
    monkeypatch.setattr(mq,'validate_credentials',lambda **_:None)
    verifier=MagicMock()
    verifier.verify.return_value={'valid':True,'provider':'fixture'}
    monkeypatch.setattr(mq,'verification_provider',lambda:verifier)
    monkeypatch.setattr(mq.OpenDiscovery,'harvest',lambda _: ([],[]))
    monkeypatch.setenv('SCHEDULE_SLOT','test_slot')
    monkeypatch.setenv('GITHUB_EVENT_NAME','schedule')
    def append(sheets,tab,rows,**kwargs):
        if tab=='Approval Queue':
            for r in rows:
                if not any(x['lead_id']==r['lead_id'] for x in queue): queue.append(copy.deepcopy(r))
        return len(rows)
    monkeypatch.setattr(mq,'append_records',append)
    return manager,store,queue

def seed(store,index=1):
    r=valid_record(index)
    store.put('prospect:'+r['company_id'],dict(company_id=r['company_id'],name=r['business'],website=r['website'],state='DRAFTED',record=r))

def test_crash_outbox_resume_then_second_run_no_duplicates(rig,monkeypatch):
    manager,store,queue=rig
    seed(store,1); seed(store,2)
    # These are persisted drafts from an interrupted previous run, not generated on retry.
    result=manager.run()
    assert result['ready_for_approval']==2 and result['status']=='READY'
    assert len(queue)==2
    assert manager.run()['run_id']==result['run_id']
    assert len(queue)==2
    monkeypatch.setenv('SCHEDULE_SLOT','next_slot')
    assert manager.run()['ready_for_approval']==2 and len(queue)==2

def test_write_failure_cannot_publish_ready(rig,monkeypatch):
    manager,store,queue=rig; seed(store)
    def fail(*a,**k): raise RuntimeError('Sheet write failed')
    monkeypatch.setattr(mq,'append_records',fail)
    with pytest.raises(RuntimeError): manager.run()
    assert store.get('health:last_attempt')['status']=='FAILED'
    assert not store.get('health:last_success')
    assert store.get('prospect:company_1')['state']=='DRAFTED'

def test_silent_missing_write_readback_prevents_false_count(rig,monkeypatch):
    manager,store,queue=rig; seed(store)
    monkeypatch.setattr(mq,'append_records',lambda *a,**k:0)
    result=manager.run()
    assert result['ready_for_approval']==0 and result['shortage']==2
    assert result['status']=='SHORTFALL'

def test_groq_failure_preserves_qualified_reserve(rig,monkeypatch):
    manager,store,queue=rig; r=valid_record()
    store.put('prospect:company_1',dict(company_id='company_1',website=r['website'],name=r['business'],state='QUALIFIED',research=r))
    monkeypatch.setattr(mq.GroqClient,'draft_outreach',lambda *a:None)
    monkeypatch.setattr(mq.GroqClient,'is_available',lambda *a:True)
    result=manager.run()
    assert result['api_failures']==1 and result['ready_for_approval']==0
    assert store.get('prospect:company_1')['state']=='QUALIFIED'

def test_publish_does_not_call_discovery(rig,monkeypatch):
    manager,store,queue=rig
    monkeypatch.setattr(mq.OpenDiscovery,'harvest',lambda _:pytest.fail('Discovery called during readback'))
    assert manager.run(publish_only=True)['shortage']==2
