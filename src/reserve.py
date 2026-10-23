"""Durable Sheet checkpoints. No local cache is authoritative."""
import hashlib
import json
import re
import threading
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


class SerializedMutationGateway:
    """
    Shared serialized mutation gateway for Google Sheets.
    Enforces thread-safe serialized execution, actual row-version checking,
    and compare-before-commit verification to prevent overwriting concurrent
    approvals and draft edits.
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

    def update_row(self, ws, row_idx: int, columns: list, expected_record: dict, new_record: dict, tab: str) -> bool:
        """
        Transactionally updates a row under serialization lock with actual
        row-version checking and compare-before-commit verification.
        Fails closed (returns False) on read errors, concurrent approvals, or draft edits.
        """
        with self._lock:
            # 1. Initial live read
            try:
                live_vals = ws.row_values(row_idx)
            except Exception:
                # Fail closed on read error: do not overwrite
                return False

            if not live_vals:
                return False

            live_row = dict(zip(columns, live_vals))

            # 2. Status/approval terminal check for Approval Queue
            if tab == 'Approval Queue':
                curr_st = str(live_row.get('status', '')).strip().upper()
                curr_app = str(live_row.get('approval', '')).strip().upper()
                # Abort if lead has already been approved, sent, or rejected
                if curr_st in ('APPROVED', 'SENT', 'SENDING', 'SUPPRESSED') or curr_app in ('APPROVED', 'REJECTED'):
                    return False
                if curr_st not in ('NEEDS_RESEARCH', 'AWAITING_REVIEW') or curr_app != 'PENDING':
                    return False

            # 3. Actual row-version verification against expected_record
            if expected_record:
                # If explicit row version token provided, compare directly
                exp_version = expected_record.get('_row_version') or expected_record.get('row_version')
                if exp_version:
                    if self.compute_row_version(live_row) != exp_version:
                        return False

                # Compare all fields present in expected_record (ignoring ephemeral timestamps and version keys)
                for k, exp_val in expected_record.items():
                    if k in ('updated_at', '_row_version', 'row_version'):
                        continue
                    curr_val = str(live_row.get(k, '')).strip()
                    exp_val_str = str(exp_val).strip()
                    if k in ('status', 'approval'):
                        if curr_val.upper() != exp_val_str.upper():
                            return False
                    else:
                        if curr_val != exp_val_str:
                            # Draft edit (subject, body, reviewer_notes, etc.) detected: fail closed
                            return False

            # 4. Prepare proposed update payload
            merged = {**live_row, **new_record}
            if live_row.get('reviewer_notes'):
                merged['reviewer_notes'] = live_row['reviewer_notes']
            if 'updated_at' in columns:
                merged['updated_at'] = datetime.now(IST).isoformat()

            row_data = [merged.get(h, '') for h in columns]

            # 5. Compare-before-commit verification
            # Immediately re-read target row to guarantee no approval or draft edit arrived between read and commit
            try:
                pre_commit_vals = ws.row_values(row_idx)
            except Exception:
                # Fail closed on pre-commit read error
                return False

            if not pre_commit_vals:
                return False

            pre_commit_row = dict(zip(columns, pre_commit_vals))

            if tab == 'Approval Queue':
                pre_st = str(pre_commit_row.get('status', '')).strip().upper()
                pre_app = str(pre_commit_row.get('approval', '')).strip().upper()
                if pre_st in ('APPROVED', 'SENT', 'SENDING', 'SUPPRESSED') or pre_app in ('APPROVED', 'REJECTED'):
                    return False
                if pre_st not in ('NEEDS_RESEARCH', 'AWAITING_REVIEW') or pre_app != 'PENDING':
                    return False

            # Enforce that live row content did not change between initial read and write
            if self.compute_row_version(pre_commit_row) != self.compute_row_version(live_row):
                return False

            # 6. Execute atomic write
            ws.update(range_name=f'A{row_idx}', values=[row_data], value_input_option='RAW')
            return True


mutation_gateway = SerializedMutationGateway()
compute_row_version = SerializedMutationGateway.compute_row_version


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
            self.data[key] = value

    def values(self, prefix):
        return [v for k, v in self.data.items() if k.startswith(prefix)]

    def put_many_new(self, records):
        with mutation_gateway._lock:
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
    Transactionally update a row only if fresh live state matches expected version.
    Fails closed on read errors, concurrent approvals, or draft edits.
    Delegates to shared SerializedMutationGateway.
    """
    return mutation_gateway.update_row(ws, row_idx, columns, expected_record, new_record, tab)


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
                    mutation_gateway.update_row(ws, row_idx, columns, old, record, tab)
                continue
            new.append([json.dumps(record.get(h, '')) if isinstance(record.get(h), (dict, list)) else record.get(h, '') for h in columns])
            ids.add(rid)
        if new:
            ws.append_rows(new, value_input_option='RAW')
        return len(new)
