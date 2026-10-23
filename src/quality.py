"""One fail-closed definition of an independently reviewable draft."""
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import re
from src.config import load_portfolio
from src.network import extract_domain
from src.verifier import is_valid_syntax
from src.email_validator import validate_email_body

IST = ZoneInfo("Asia/Kolkata")
FRESH_DAYS = 7

def validate_queued_draft(row, now=None):
    now = now or datetime.now(IST)
    required = ('lead_id','company_id','business','industry','website','public_email',
                'email_source_url','observation','observation_url','opportunity',
                'proof_project','proof_line','proof_url','last_verified_at',
                'subject','email_body','alt_opening_1','alt_opening_2')
    for key in required:
        val = row.get(key)
        if val is None or not str(val).strip() or str(val).strip() == 'None':
            return False, 'Missing ' + key
    if row.get('qualification_status') != 'QUALIFIED':
        return False, 'Research incomplete'
    if row.get('mail_domain_status') != 'MX_VALID_MAILBOX_UNCONFIRMED':
        return False, 'Mail domain not verified'
    if not is_valid_syntax(row['public_email']):
        return False, 'Invalid email syntax'
    domain = extract_domain(row['website'])
    for key in ('email_source_url','observation_url'):
        if extract_domain(row[key]) != domain:
            return False, 'Evidence not from official website'
    try:
        verified = datetime.fromisoformat(str(row['last_verified_at']).replace('Z','+00:00'))
        if not timedelta(0) <= now - verified <= timedelta(days=FRESH_DAYS):
            return False, 'Stale or future research'
    except (ValueError, TypeError):
        return False, 'Invalid verification timestamp'
    proofs = load_portfolio()
    if not any(p['project'] == row['proof_project'] and p['proof'] == row['proof_line']
               and p.get('evidence_url') == row['proof_url'] for p in proofs):
        return False, 'Unapproved portfolio proof'
    if row.get('proof_verified') != 'YES':
        return False, 'Portfolio evidence not verified'
    body = row['email_body'].strip()
    valid_body, body_err, _ = validate_email_body(body, row.get('proof_line'))
    if not valid_body:
        return False, body_err
    if row['alt_opening_1'] == row['alt_opening_2']:
        return False, 'Alternative openings must differ'
    return True, 'READY'

def eligible_queue(rows, suppression, now=None):
    ready, issues, seen = [], [], set()
    for row in rows:
        if row.get('status') != 'AWAITING_REVIEW' or row.get('approval') != 'PENDING':
            continue
        ok, reason = validate_queued_draft(row, now)
        blocked, why = suppression.is_suppressed(row.get('public_email',''), row.get('website',''))
        domain = extract_domain(row.get('website',''))
        email = str(row.get('public_email','')).lower()
        if not ok or blocked or domain in seen or email in seen:
            issues.append((row, why if blocked else reason if not ok else 'Duplicate company/contact'))
            continue
        seen.update((domain,email))
        ready.append(row)
    return ready, issues
