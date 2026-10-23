"""Durable Sheet checkpoints. No local cache is authoritative."""
import json
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

class ReserveStore:
    def __init__(self, sheets):
        self.sheets = sheets
        self.ws = sheets.ensure_tab('Automation State', ['key','json','updated_at'], rows=10000)
        self.rows = self.ws.get_all_records()
        self.data = {r['key']: json.loads(r['json']) for r in self.rows}
        self.indices = {r['key']: i+2 for i,r in enumerate(self.rows)}

    def get(self, key, default=None):
        return self.data.get(key, default)

    def put(self, key, value):
        row = [key, json.dumps(value, ensure_ascii=True), datetime.now(IST).isoformat()]
        if key in self.indices:
            self.ws.update(range_name=f'A{self.indices[key]}:C{self.indices[key]}', values=[row], value_input_option='RAW')
        else:
            resp = self.ws.append_row(row, value_input_option='RAW')
            row_idx = None
            if resp and isinstance(resp, dict) and 'updates' in resp:
                m = re.search(r'![A-Za-z]*(\d+)', resp['updates'].get('updatedRange', ''))
                if m:
                    row_idx = int(m.group(1))
            if not row_idx:
                row_idx = len(self.indices) + 2
            self.indices[key] = row_idx
        self.data[key] = value

    def values(self, prefix):
        return [v for k,v in self.data.items() if k.startswith(prefix)]

    def put_many_new(self, records):
        rows = []
        for key, value in records.items():
            if key not in self.data:
                rows.append([key, json.dumps(value, ensure_ascii=True), datetime.now(IST).isoformat()])
        if rows:
            resp = self.ws.append_rows(rows, value_input_option='RAW')
            start_row = None
            if resp and isinstance(resp, dict) and 'updates' in resp:
                m = re.search(r'![A-Za-z]*(\d+)', resp['updates'].get('updatedRange', ''))
                if m:
                    start_row = int(m.group(1))
            if start_row is None:
                start_row = len(self.indices) + 2
            for i, (key, raw, _) in enumerate(rows):
                self.indices[key] = start_row + i
                self.data[key] = json.loads(raw)

def append_records(sheets, tab, records, key='lead_id', refresh_pending=False):
    """Append by header, preserving existing columns and human decisions."""
    if not records: return 0
    headers = list(dict.fromkeys(k for row in records for k in row))
    ws = sheets.ensure_tab(tab, headers)
    existing = ws.get_all_records()
    columns = ws.row_values(1)
    missing = [h for h in headers if h not in columns]
    if missing:
        columns += missing
        if ws.col_count < len(columns): ws.resize(cols=len(columns))
        ws.update(range_name='A1', values=[columns], value_input_option='RAW')
    ids = {str(r.get(key,'')) for r in existing}
    by_id = {str(r.get(key,'')):(i+2, r) for i, r in enumerate(existing)}
    new = []
    for record in records:
        rid = str(record[key])
        if rid in ids:
            if refresh_pending:
                row_idx, old = by_id[rid]
                # Re-fetch live row state directly from the sheet to prevent overwriting concurrent human decisions
                try:
                    live_vals = ws.row_values(row_idx)
                    live_row = dict(zip(columns, live_vals)) if live_vals else old
                except Exception:
                    live_row = old

                if tab == 'Approval Queue':
                    curr_st = str(live_row.get('status', '')).strip().upper()
                    curr_app = str(live_row.get('approval', '')).strip().upper()
                    if curr_st in ('APPROVED', 'SENT', 'SENDING', 'SUPPRESSED') or curr_app in ('APPROVED', 'REJECTED'):
                        continue
                if tab != 'Approval Queue' or (str(live_row.get('status', '')).strip().upper() in ('NEEDS_RESEARCH', 'AWAITING_REVIEW') and str(live_row.get('approval', '')).strip().upper() == 'PENDING'):
                    merged = {**live_row, **record}
                    # Keep reviewer notes; edits invalidate any previous approval fingerprint.
                    if live_row.get('reviewer_notes'):
                        merged['reviewer_notes'] = live_row['reviewer_notes']
                    ws.update(range_name=f'A{row_idx}', values=[[merged.get(h, '') for h in columns]], value_input_option='RAW')
            continue
        new.append([json.dumps(record.get(h, '')) if isinstance(record.get(h), (dict, list)) else record.get(h, '') for h in columns])
        ids.add(rid)
    if new:
        ws.append_rows(new, value_input_option='RAW')
    return len(new)
