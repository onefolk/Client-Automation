"""Durable Sheet checkpoints. No local cache is authoritative."""
import hashlib
import json
import logging
import re
import threading
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
logger = logging.getLogger(__name__)


OPERATOR_COLUMNS = frozenset({'status', 'approval', 'reviewer_notes'})


class SerializedMutationGateway:
    """
    Process-local serialization for pipeline-owned data.
    This is not a distributed lock. Approval Queue refreshes are append-only.
    """
    def __init__(self):
        self._lock = threading.RLock()

    @staticmethod
    def compute_row_version(record: dict, ignore_keys: tuple = ('updated_at', '_row_version', 'row_version')) -> str:
        """
        Computes a stable deterministic SHA-256 hash of a record's contents.
        Excludes auto-generated timestamps while hashing all content, note,
        and decision columns.
        """
        if not record or not isinstance(record, dict):
            return ""
        items = []
        for k in sorted(record.keys()):
            if k in ignore_keys:
                continue
            v = record[k]
            s = "" if v is None else str(v).strip()
            items.append(f"{k}:{s}")
        payload = "|".join(items)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def update_row(self, ws, row_idx, columns, expected_record, new_record, tab):
        """Best-effort refresh for non-queue data, serialized within this process only.

        Approval Queue rows are never refreshed in place by Python. No number of
        pre-write reads can make Sheets compare-and-swap atomic across writers.
        """
        if tab == 'Approval Queue':
            return False
        with self._lock:
            try:
                values = ws.row_values(row_idx)
            except Exception:
                return False
            if not values:
                return False
            live = dict(zip(columns, values))
            if expected_record and any(str(live.get(k, '')).strip() != str(v).strip()
                                       for k, v in expected_record.items() if k != 'updated_at'):
                return False
            merged = {**live, **new_record}
            if 'updated_at' in columns:
                merged['updated_at'] = datetime.now(IST).isoformat()
            ws.update(range_name=f'A{row_idx}', values=[[merged.get(k, '') for k in columns]],
                      value_input_option='RAW')
            return True


mutation_gateway = SerializedMutationGateway()
compute_row_version = SerializedMutationGateway.compute_row_version


def serialize_store_value(value, max_chars=45000) -> str:
    """Safely serializes store values for Google Sheets single-cell 50,000 char limit.

    Guarantees valid JSON output that never exceeds max_chars and avoids
    expensive ASCII escaping inflation for UTF-8 content.
    """
    try:
        raw = json.dumps(value, ensure_ascii=False)
    except Exception:
        raw = json.dumps(value, ensure_ascii=True)

    if len(raw) <= max_chars:
        return raw

    # Value exceeds Google Sheet cell threshold: prune large fields defensively
    if isinstance(value, dict):
        pruned = dict(value)
        # 1. Prune research page_contexts
        if 'research' in pruned and isinstance(pruned['research'], dict):
            r = dict(pruned['research'])
            if 'page_contexts' in r:
                r['page_contexts'] = [(str(t)[:300], str(u)) for t, u in r.get('page_contexts', [])[:2]]
            pruned['research'] = r
            try:
                candidate = json.dumps(pruned, ensure_ascii=False)
                if len(candidate) <= max_chars:
                    return candidate
            except Exception:
                pass
            # Drop page_contexts entirely if still too big
            r.pop('page_contexts', None)
            pruned['research'] = r
            try:
                candidate = json.dumps(pruned, ensure_ascii=False)
                if len(candidate) <= max_chars:
                    return candidate
            except Exception:
                pass

        # 2. Prune any huge strings or long lists in the dictionary
        for k, v in list(pruned.items()):
            if isinstance(v, str) and len(v) > 1000:
                pruned[k] = v[:1000] + "... [TRUNCATED]"
            elif isinstance(v, list) and len(v) > 20:
                pruned[k] = v[:20]
        try:
            candidate = json.dumps(pruned, ensure_ascii=False)
            if len(candidate) <= max_chars:
                return candidate
        except Exception:
            pass

        # 3. Compact fallback dict that preserves identity & core metadata
        fallback = {
            'company_id': pruned.get('company_id', ''),
            'name': pruned.get('name', ''),
            'website': pruned.get('website', ''),
            'state': pruned.get('state', ''),
            'last_attempt': pruned.get('last_attempt', 0),
            'research_version': pruned.get('research_version', 0),
            'reason': str(pruned.get('reason', ''))[:200],
            '_sheet_truncated': True
        }
        # Never silently drop a finished draft; keep it when it fits on its own.
        if isinstance(pruned.get('record'), dict):
            with_record = dict(fallback, record=pruned['record'])
            candidate = json.dumps(with_record, ensure_ascii=False)
            if len(candidate) <= max_chars:
                return candidate
            logger.warning("Draft record for %s exceeds the cell limit and was dropped", fallback['company_id'])
        return json.dumps(fallback, ensure_ascii=False)

    # For non-dict payloads, truncate safely
    return json.dumps({"_truncated": True, "raw": str(value)[:max_chars - 100]}, ensure_ascii=False)


class ReserveStore:
    def __init__(self, sheets):
        self.sheets = sheets
        self.ws = sheets.ensure_tab('Automation State', ['key', 'json', 'updated_at'], rows=10000)
        self.rows = self.ws.get_all_records()
        self.data = {r['key']: json.loads(r['json']) for r in self.rows}
        self.indices = {r['key']: i + 2 for i, r in enumerate(self.rows)}

    def get(self, key, default=None):
        return self.data.get(key, default)

    def put(self, key, value):
        with mutation_gateway._lock:
            serialized = serialize_store_value(value)
            row = [key, serialized, datetime.now(IST).isoformat()]
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
                    # Recover actual row index by locating key in column A; never guess
                    try:
                        col_a = self.ws.col_values(1)
                        if key in col_a:
                            row_idx = col_a.index(key) + 1
                    except Exception:
                        pass
                if not row_idx:
                    raise RuntimeError(f"Failed to determine durable checkpoint row index for key: {key}")
                self.indices[key] = row_idx
            self.data[key] = json.loads(serialized)

    def values(self, prefix):
        return [v for k, v in self.data.items() if k.startswith(prefix)]

    def put_many_new(self, records):
        with mutation_gateway._lock:
            rows = []
            for key, value in records.items():
                if key not in self.data:
                    serialized = serialize_store_value(value)
                    rows.append([key, serialized, datetime.now(IST).isoformat()])
            if rows:
                resp = self.ws.append_rows(rows, value_input_option='RAW')
                start_row = None
                if resp and isinstance(resp, dict) and 'updates' in resp:
                    m = re.search(r'![A-Za-z]*(\d+)', resp['updates'].get('updatedRange', ''))
                    if m:
                        start_row = int(m.group(1))
                if start_row is None:
                    # Recover actual row index by locating first appended key in column A; never guess
                    try:
                        col_a = self.ws.col_values(1)
                        first_key = rows[0][0]
                        if first_key in col_a:
                            start_row = col_a.index(first_key) + 1
                    except Exception:
                        pass
                if start_row is None:
                    raise RuntimeError("Failed to determine durable checkpoint start row for bulk append")
                for i, (key, raw, _) in enumerate(rows):
                    self.indices[key] = start_row + i
                    self.data[key] = json.loads(raw)


def transactional_update_row(ws, row_idx, columns, expected_record, new_record, tab):
    """
    Compatibility wrapper: queue rows cannot be updated by the pipeline.
    Other tabs use best-effort version checks under a process-local lock.
    """
    return mutation_gateway.update_row(ws, row_idx, columns, expected_record, new_record, tab)


def queue_revision_digest(record):
    """Stable content identity for replay-safe, separately approved revisions."""
    ignored = {'lead_id', 'status', 'approval', 'reviewer_notes', 'created_at',
               'updated_at', 'campaign_date', 'timestamp'}
    payload = {k: v for k, v in record.items() if k not in ignored}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=True,
                                    separators=(',', ':'), default=str).encode()).hexdigest()[:20]


def append_records(sheets, tab, records, key='lead_id', refresh_pending=False):
    """Append by header, preserving existing columns and human decisions."""
    if not records:
        return 0
    with mutation_gateway._lock:
        headers = list(dict.fromkeys(k for row in records for k in row))
        ws = sheets.ensure_tab(tab, headers)
        existing = ws.get_all_records()
        columns = ws.row_values(1)
        missing = [h for h in headers if h not in columns]
        if missing:
            columns += missing
            if ws.col_count < len(columns):
                ws.resize(cols=len(columns))
            ws.update(range_name='A1', values=[columns], value_input_option='RAW')
        ids = {str(r.get(key, '')) for r in existing}
        by_id = {str(r.get(key, '')):(i + 2, r) for i, r in enumerate(existing)}
        new = []
        for record in records:
            rid = str(record[key])
            if rid in ids:
                if refresh_pending:
                    row_idx, old = by_id[rid]
                    if tab == 'Approval Queue':
                        if (str(old.get('status', '')).upper() not in ('NEEDS_RESEARCH', 'AWAITING_REVIEW')
                                or str(old.get('approval', '')).upper() != 'PENDING'):
                            continue
                        # Compare only proposed fields: existing Sheets may include extra columns.
                        old_content = {k: old.get(k, '') for k in record}
                        if queue_revision_digest(old_content) == queue_revision_digest(record):
                            continue
                        revision_id = rid + '_rev_' + queue_revision_digest(record)
                        if revision_id in ids:
                            continue
                        revision = {**record, key: revision_id, 'status': 'AWAITING_REVIEW',
                                    'approval': 'PENDING',
                                    'reviewer_notes': 'New research revision of ' + rid + '; requires separate approval.'}
                        new.append([json.dumps(revision.get(h, '')) if isinstance(revision.get(h), (dict, list))
                                    else revision.get(h, '') for h in columns])
                        ids.add(revision_id)
                    else:
                        mutation_gateway.update_row(ws, row_idx, columns, old, record, tab)
                continue
            new.append([json.dumps(record.get(h, '')) if isinstance(record.get(h), (dict, list)) else record.get(h, '') for h in columns])
            ids.add(rid)
        if new:
            ws.append_rows(new, value_input_option='RAW')
        return len(new)
