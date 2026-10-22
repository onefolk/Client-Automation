"""Fail-closed live-row eligibility (fixtures are synthetic, never uploaded)."""
from datetime import datetime, timezone, timedelta
import pytest
from src.quality import validate_queued_draft, eligible_queue
from src.suppression import SuppressionManager
from src.morning_queue import campaign_day

def valid_record(index=1):
    return dict(lead_id=f'lead_{index}', company_id=f'company_{index}', business=f'Fixture Business {index}',
        industry='education', website=f'https://fixture{index}.edu/',public_email=f'info@fixture{index}.edu',
        email_source_url=f'https://fixture{index}.edu/contact',observation='Download the application form.',
        observation_url=f'https://fixture{index}.edu/admissions',opportunity='Online application submission',
        proof_project='OneFolk website', proof_line='Our team designed and built the OneFolk website.',
        proof_url='https://onefolk.in/work',proof_verified='YES',qualification_status='QUALIFIED',
        mail_domain_status='MX_VALID_MAILBOX_UNCONFIRMED',last_verified_at=datetime.now(timezone.utc).isoformat(),
        subject='Application workflow',
        email_body=(
            'We noticed that your admissions portal currently provides a downloadable application form without an interactive online submission workflow.\n\n'
            'Implementing a direct digital application and document upload system could make the admissions process significantly faster and easier for prospective students.\n\n'
            'Our team designed and built the OneFolk website, delivering modern web applications and streamlined digital experiences for our partners.\n\n'
            'Could you connect us with the person responsible for your digital portal updates?'
        ),
        alt_opening_1='I saw your downloadable application form.',alt_opening_2='Your admissions page provides a form to download.',
        status='AWAITING_REVIEW',approval='PENDING')

@pytest.mark.parametrize('key',['company_id','email_source_url','opportunity','proof_line','last_verified_at','alt_opening_2','proof_verified'])
def test_missing_evidence_is_not_ready(key):
    r=valid_record(); r.pop(key)
    assert not validate_queued_draft(r)[0]

def test_stale_unknown_future_and_70_words_rejected():
    r=valid_record(); assert validate_queued_draft(r)[0]
    for timestamp in ('bad','',datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),(datetime.now(timezone.utc)-timedelta(days=8)).isoformat()):
        assert not validate_queued_draft({**r,'last_verified_at':timestamp})[0]
    assert not validate_queued_draft({**r,'email_body':' '.join(['word']*200)})[0]

def test_rejection_suppression_and_company_uniqueness():
    r=valid_record(); suppression=SuppressionManager()
    for status in ('REJECTED','APPROVED','SENDING','BOUNCED','SENT','SEND_REVIEW'):
        assert not eligible_queue([{**r,'status':status}],suppression)[0]
    ready, issues=eligible_queue([r,{**r,'lead_id':'other'}],suppression)
    assert len(ready)==1 and len(issues)==1
    suppression.load_from_sheet_data([], [['','another@fixture1.edu']])
    assert not eligible_queue([r],suppression)[0]

def test_weekday_campaign_boundary():
    assert campaign_day(datetime(2026,10,25,16,30,tzinfo=timezone.utc))=='2026-10-26'
    assert campaign_day(datetime(2026,10,26,1,tzinfo=timezone.utc))=='2026-10-26'
