import { OneFolkDatabase, getDatabase } from './db';
import {
  Institution,
  EvidenceItem,
  OutreachRecord,
  SuppressionRecord,
  FullInstitutionProfile,
} from './institutional-types';

/**
 * Sanitizes cell text to neutralize spreadsheet formula injection (CSV Injection).
 * Any value starting with =, +, -, @, \t, or \r is prefixed with a single quote (').
 * Leading zeros and phone numbers are protected from scientific notation or truncation.
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  if (value == null) return '';
  let str = String(value);

  // If text starts with dangerous formula operators or whitespace control characters
  if (/^[\s]*[=+@-]/.test(str) || /^[\t\r\n]/.test(str)) {
    str = `'${str}`;
  }

  // Preserve phone numbers or identifiers with leading zeros
  if (/^0\d+/.test(str) && !str.startsWith("'")) {
    str = `'${str}`;
  }

  return str;
}

/**
 * Encodes a 2D array of cells into RFC 4180 compliant CSV string
 * with formula injection neutralization.
 */
export function encodeSafeCsv(rows: unknown[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const sanitized = sanitizeSpreadsheetCell(cell);
          return `"${sanitized.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\r\n');
}

/**
 * Parses CSV text safely handling quotes, escapes, and commas.
 */
export function parseSafeCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuote = false;

  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (insideQuote) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        insideQuote = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuote = true;
      } else if (char === ',') {
        currentRow.push(cleanParsedCell(currentField));
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(cleanParsedCell(currentField));
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(cleanParsedCell(currentField));
    rows.push(currentRow);
  }

  return rows;
}

function cleanParsedCell(val: string): string {
  let cleaned = val.trim();
  // Strip prepended single quote used for formula neutralization
  if (cleaned.startsWith("'") && cleaned.length > 1 && /^[=+@-]/.test(cleaned.substring(1))) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Generates the 5 standard workbook CSV exports.
 */
export function exportWorkbookCsvs(db: OneFolkDatabase = getDatabase()): {
  leadsCsv: string;
  evidenceCsv: string;
  outreachCsv: string;
  suppressionCsv: string;
  settingsCsv: string;
} {
  // 1. Leads Tab
  const institutions = db.getInstitutions();
  const leadsHeaders = [
    'Lead ID',
    'Source ID',
    'Institution Name',
    'Campus Name',
    'Parent Organization',
    'Location',
    'City',
    'State',
    'Country',
    'Website URL',
    'Domain',
    'Website State',
    'Research Status',
    'Qualification Status',
    'Shortlisted',
    'Qualification Reason',
    'Shortlist Reason',
    'Notes / Manual Review',
    'Created At',
    'Last Researched At',
  ];

  const leadsRows: unknown[][] = [leadsHeaders];
  for (const inst of institutions) {
    leadsRows.push([
      inst.id,
      inst.source_id || '',
      inst.name,
      inst.campus_name || '',
      inst.parent_organization || '',
      inst.location || '',
      inst.city || '',
      inst.state || '',
      inst.country || '',
      inst.website_url || '',
      inst.domain || '',
      inst.website_state,
      inst.research_status,
      inst.qualification_status,
      inst.is_shortlisted ? 'TRUE' : 'FALSE',
      inst.qualification_reason || '',
      inst.shortlist_reason || '',
      inst.notes || '',
      inst.created_at,
      inst.last_researched_at || '',
    ]);
  }

  // 2. Evidence Tab
  const evidenceHeaders = [
    'Evidence ID',
    'Lead ID',
    'Signal Key',
    'Signal Label',
    'Claim',
    'Status',
    'Source URL',
    'Evidence Snippet',
    'Confidence',
    'Observed At',
  ];
  const evidenceRows: unknown[][] = [evidenceHeaders];
  for (const inst of institutions) {
    const items = db.getEvidence(inst.id);
    for (const ev of items) {
      evidenceRows.push([
        ev.id,
        inst.id,
        ev.signal_key,
        ev.label,
        ev.claim,
        ev.status,
        ev.source_url || '',
        ev.evidence_snippet || '',
        ev.confidence,
        ev.observed_at,
      ]);
    }
  }

  // 3. Outreach Tab
  const outreachHeaders = [
    'Outreach ID',
    'Lead ID',
    'Institution Name',
    'Contact Name',
    'Contact Email',
    'Contact Role',
    'Contact Source URL',
    'Outreach Status',
    'Review Decision',
    'Draft Recipient',
    'Draft Subject',
    'Draft Body',
    'Approval Version',
    'Approval Timestamp',
    'Gmail Message ID',
    'Gmail Thread ID',
    'Send Result',
    'Reply Status',
    'Reply Snippet',
    'Bounce Reason',
    'Opt Out Date',
    'Updated At',
  ];
  const outreachRows: unknown[][] = [outreachHeaders];
  for (const inst of institutions) {
    const out = db.getOutreach(inst.id);
    if (out) {
      outreachRows.push([
        out.id,
        inst.id,
        inst.name,
        out.contact_name || '',
        out.contact_email || '',
        out.contact_role || '',
        out.contact_source_url || '',
        out.outreach_status,
        out.review_decision || '',
        out.draft_recipient || '',
        out.draft_subject || '',
        out.draft_body || '',
        out.approval_version,
        out.approval_timestamp || '',
        out.gmail_message_id || '',
        out.gmail_thread_id || '',
        out.send_result || '',
        out.reply_status || '',
        out.reply_snippet || '',
        out.bounce_reason || '',
        out.opt_out_date || '',
        out.updated_at,
      ]);
    }
  }

  // 4. Suppression Tab
  const suppressionHeaders = ['Suppression ID', 'Type', 'Value', 'Reason', 'Source', 'Added Date'];
  const suppressionRows: unknown[][] = [suppressionHeaders];
  for (const s of db.getSuppressionList()) {
    suppressionRows.push([s.id, s.type, s.value, s.reason, s.source, s.added_date]);
  }

  // 5. Settings Tab
  const settingsHeaders = ['Key', 'Value', 'Description', 'Updated At'];
  const settingsRows: unknown[][] = [
    settingsHeaders,
    ['SCHEMA_VERSION', '1.0', 'OneFolk Lead Intelligence Schema Version', new Date().toISOString()],
    ['OUTREACH_MODE', 'MANUAL_CHATGPT_GMAIL', 'Outreach is executed manually via ChatGPT with connected Gmail', new Date().toISOString()],
    ['SAFETY_POLICY', 'SSRF_PROTECTED_HONEST_EVIDENCE', 'Strict SSRF validation; non-observed features never assumed absent', new Date().toISOString()],
  ];

  return {
    leadsCsv: encodeSafeCsv(leadsRows),
    evidenceCsv: encodeSafeCsv(evidenceRows),
    outreachCsv: encodeSafeCsv(outreachRows),
    suppressionCsv: encodeSafeCsv(suppressionRows),
    settingsCsv: encodeSafeCsv(settingsRows),
  };
}

/**
 * Non-destructive Import of Institution Lists from CSV.
 * - Adds new institutions or updates research URLs.
 * - NEVER overwrites existing outreach approvals, sent messages, thread IDs, replies, or suppression records.
 */
export function importInstitutionsFromCsv(
  csvContent: string,
  db: OneFolkDatabase = getDatabase()
): { imported: number; updated: number; suppressed_skipped: number } {
  const rows = parseSafeCsv(csvContent);
  if (rows.length < 2) {
    return { imported: 0, updated: 0, suppressed_skipped: 0 };
  }

  const headerRow = rows[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));

  // Column index resolvers
  const nameIdx = headerRow.findIndex((h) => h.includes('institution') || h.includes('name') || h === 'school');
  const campusIdx = headerRow.findIndex((h) => h.includes('campus') || h.includes('branch'));
  const parentIdx = headerRow.findIndex((h) => h.includes('parent') || h.includes('trust') || h.includes('group'));
  const websiteIdx = headerRow.findIndex((h) => h.includes('website') || h.includes('url') || h.includes('web'));
  const cityIdx = headerRow.findIndex((h) => h.includes('city') || h.includes('town'));
  const stateIdx = headerRow.findIndex((h) => h.includes('state') || h.includes('province'));
  const countryIdx = headerRow.findIndex((h) => h.includes('country'));
  const locationIdx = headerRow.findIndex((h) => h.includes('location') || h.includes('address'));
  const sourceIdIdx = headerRow.findIndex((h) => h.includes('source_id') || h.includes('id') || h.includes('code'));

  let imported = 0;
  let updated = 0;
  let suppressedCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || !row.some((cell) => cell.trim())) continue;

    const name = nameIdx >= 0 ? row[nameIdx]?.trim() : row[0]?.trim();
    if (!name) continue;

    const campus = campusIdx >= 0 ? row[campusIdx]?.trim() : undefined;
    const parent = parentIdx >= 0 ? row[parentIdx]?.trim() : undefined;
    const website = websiteIdx >= 0 ? row[websiteIdx]?.trim() : undefined;
    const city = cityIdx >= 0 ? row[cityIdx]?.trim() : undefined;
    const state = stateIdx >= 0 ? row[stateIdx]?.trim() : undefined;
    const country = countryIdx >= 0 ? row[countryIdx]?.trim() : undefined;
    const location = locationIdx >= 0 ? row[locationIdx]?.trim() : undefined;
    const sourceId = sourceIdIdx >= 0 ? row[sourceIdIdx]?.trim() : undefined;

    // Check suppression
    let domain: string | undefined;
    if (website) {
      try {
        const u = new URL(website.includes('://') ? website : `https://${website}`);
        domain = u.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        // ignore
      }
    }

    const suppressionCheck = db.isSuppressed(domain, undefined, name);
    if (suppressionCheck.suppressed) {
      suppressedCount++;
      // Still persist or mark as disqualified if imported
    }

    const existing = db.findExistingInstitution({
      source_id: sourceId,
      name,
      campus_name: campus,
      domain,
      city,
    });

    if (existing) {
      db.upsertInstitution({
        id: existing.id,
        name,
        campus_name: campus || existing.campus_name,
        parent_organization: parent || existing.parent_organization,
        website_url: website || existing.website_url,
        city: city || existing.city,
        state: state || existing.state,
        country: country || existing.country,
        location: location || existing.location,
        source_id: sourceId || existing.source_id,
      });
      updated++;
    } else {
      db.upsertInstitution({
        name,
        campus_name: campus,
        parent_organization: parent,
        website_url: website,
        city,
        state,
        country,
        location,
        source_id: sourceId,
        qualification_status: suppressionCheck.suppressed ? 'DISQUALIFIED' : 'PENDING_REVIEW',
        qualification_reason: suppressionCheck.suppressed ? `Suppressed: ${suppressionCheck.reason}` : undefined,
      });
      imported++;
    }
  }

  return { imported, updated, suppressed_skipped: suppressedCount };
}

/**
 * Non-destructive Sync from Google Sheets Outreach Tab.
 * Updates review decisions, manual draft edits, sent IDs, replies, bounces, and opt-outs.
 * Guarantees that local research data is NOT corrupted and suppression records are created for opt-outs.
 */
export function syncOutreachFromSpreadsheetCsv(
  csvContent: string,
  db: OneFolkDatabase = getDatabase()
): { synced: number; opt_outs_suppressed: number } {
  const rows = parseSafeCsv(csvContent);
  if (rows.length < 2) return { synced: 0, opt_outs_suppressed: 0 };

  const header = rows[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));
  const leadIdIdx = header.findIndex((h) => h.includes('lead_id') || h === 'id');
  const statusIdx = header.findIndex((h) => h.includes('outreach_status') || h === 'status');
  const decisionIdx = header.findIndex((h) => h.includes('review_decision') || h.includes('decision'));
  const draftRecipientIdx = header.findIndex((h) => h.includes('draft_recipient'));
  const draftSubjectIdx = header.findIndex((h) => h.includes('draft_subject'));
  const draftBodyIdx = header.findIndex((h) => h.includes('draft_body'));
  const gmailMsgIdx = header.findIndex((h) => h.includes('gmail_message_id') || h.includes('message_id'));
  const gmailThreadIdx = header.findIndex((h) => h.includes('gmail_thread_id') || h.includes('thread_id'));
  const replyStatusIdx = header.findIndex((h) => h.includes('reply_status'));
  const bounceIdx = header.findIndex((h) => h.includes('bounce'));
  const optOutIdx = header.findIndex((h) => h.includes('opt_out'));

  let synced = 0;
  let optOutsSuppressed = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (leadIdIdx < 0 || !row[leadIdIdx]) continue;
    const leadId = row[leadIdIdx].trim();

    const inst = db.getInstitutionById(leadId);
    if (!inst) continue;

    const updates: Partial<OutreachRecord> = {};
    if (statusIdx >= 0 && row[statusIdx]) updates.outreach_status = row[statusIdx].trim() as any;
    if (decisionIdx >= 0 && row[decisionIdx]) updates.review_decision = row[decisionIdx].trim();
    if (draftRecipientIdx >= 0 && row[draftRecipientIdx]) updates.draft_recipient = row[draftRecipientIdx].trim();
    if (draftSubjectIdx >= 0 && row[draftSubjectIdx]) updates.draft_subject = row[draftSubjectIdx].trim();
    if (draftBodyIdx >= 0 && row[draftBodyIdx]) updates.draft_body = row[draftBodyIdx].trim();
    if (gmailMsgIdx >= 0 && row[gmailMsgIdx]) updates.gmail_message_id = row[gmailMsgIdx].trim();
    if (gmailThreadIdx >= 0 && row[gmailThreadIdx]) updates.gmail_thread_id = row[gmailThreadIdx].trim();
    if (replyStatusIdx >= 0 && row[replyStatusIdx]) updates.reply_status = row[replyStatusIdx].trim();
    if (bounceIdx >= 0 && row[bounceIdx]) updates.bounce_reason = row[bounceIdx].trim();
    if (optOutIdx >= 0 && row[optOutIdx]) updates.opt_out_date = row[optOutIdx].trim();

    // If marked OPTED_OUT, automatically add to persistent suppression list
    if (updates.outreach_status === 'OPTED_OUT' || updates.opt_out_date) {
      if (inst.domain) {
        db.addSuppression({
          type: 'DOMAIN',
          value: inst.domain,
          reason: 'Opted out via spreadsheet outreach sync',
          source: 'google_sheets_sync',
        });
        optOutsSuppressed++;
      }
    }

    db.updateOutreach(leadId, updates);
    synced++;
  }

  return { synced, opt_outs_suppressed: optOutsSuppressed };
}
