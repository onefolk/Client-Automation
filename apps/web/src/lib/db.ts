import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  Institution,
  Contact,
  EvidenceItem,
  OutreachRecord,
  SuppressionRecord,
  AuditLog,
  FullInstitutionProfile,
  SuppressionType,
} from './institutional-types';

// Use node:sqlite DatabaseSync
// Lazy-load to ensure clean compatibility across test runners and bundlers
function getDatabaseSyncClass() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('node:sqlite');
  return sqlite.DatabaseSync;
}

export class OneFolkDatabase {
  private db: any;
  public dbPath: string;

  constructor(customPath?: string) {
    const DatabaseSync = getDatabaseSyncClass();
    const resolvedPath =
      customPath ||
      process.env.ONEFOLK_DB_PATH ||
      path.join(process.cwd(), 'data', 'onefolk.db');

    this.dbPath = resolvedPath;

    if (resolvedPath !== ':memory:') {
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(resolvedPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS institutions (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        name TEXT NOT NULL,
        parent_organization TEXT,
        campus_name TEXT,
        location TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        website_url TEXT,
        domain TEXT,
        website_state TEXT NOT NULL DEFAULT 'UNKNOWN',
        research_status TEXT NOT NULL DEFAULT 'UNRESEARCHED',
        qualification_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
        qualification_reason TEXT,
        is_shortlisted INTEGER NOT NULL DEFAULT 0,
        shortlist_reason TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_researched_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_inst_domain ON institutions(domain);
      CREATE INDEX IF NOT EXISTS idx_inst_shortlist ON institutions(is_shortlisted);
      CREATE INDEX IF NOT EXISTS idx_inst_qual ON institutions(qualification_status);

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        contact_type TEXT NOT NULL,
        value TEXT NOT NULL,
        label TEXT,
        source_url TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        verified INTEGER NOT NULL DEFAULT 0,
        relevance_note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_inst ON contacts(institution_id);

      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        signal_key TEXT NOT NULL,
        label TEXT NOT NULL,
        claim TEXT NOT NULL,
        status TEXT NOT NULL,
        source_url TEXT,
        evidence_snippet TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        observed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_inst ON evidence(institution_id);

      CREATE TABLE IF NOT EXISTS outreach (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
        contact_name TEXT,
        contact_email TEXT,
        contact_role TEXT,
        contact_source_url TEXT,
        outreach_status TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
        review_decision TEXT,
        draft_recipient TEXT,
        draft_subject TEXT,
        draft_body TEXT,
        approval_version INTEGER NOT NULL DEFAULT 0,
        approval_timestamp TEXT,
        gmail_message_id TEXT,
        gmail_thread_id TEXT,
        send_result TEXT,
        reply_status TEXT,
        reply_snippet TEXT,
        bounce_reason TEXT,
        opt_out_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(outreach_status);

      CREATE TABLE IF NOT EXISTS suppression (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        source TEXT NOT NULL,
        added_date TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_suppression_val ON suppression(value);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT NOT NULL DEFAULT 'user',
        changed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_inst ON audit_logs(institution_id);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  // --- Institutions ---

  public getInstitutions(options: {
    qualification_status?: string;
    is_shortlisted?: boolean;
    research_status?: string;
    search?: string;
  } = {}): Institution[] {
    let sql = 'SELECT * FROM institutions WHERE 1=1';
    const params: any[] = [];

    if (options.qualification_status) {
      sql += ' AND qualification_status = ?';
      params.push(options.qualification_status);
    }
    if (options.is_shortlisted !== undefined) {
      sql += ' AND is_shortlisted = ?';
      params.push(options.is_shortlisted ? 1 : 0);
    }
    if (options.research_status) {
      sql += ' AND research_status = ?';
      params.push(options.research_status);
    }
    if (options.search) {
      sql += ' AND (name LIKE ? OR campus_name LIKE ? OR parent_organization LIKE ? OR city LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r: any) => ({
      ...r,
      is_shortlisted: Boolean(r.is_shortlisted),
    }));
  }

  public getInstitutionById(id: string): Institution | undefined {
    const stmt = this.db.prepare('SELECT * FROM institutions WHERE id = ?');
    const r = stmt.get(id);
    if (!r) return undefined;
    return {
      ...r,
      is_shortlisted: Boolean(r.is_shortlisted),
    };
  }

  /**
   * Safe matching: Differentiates campuses.
   * If campus_name is provided, matches (name + campus_name) or (source_id).
   * Shared parent domain alone NEVER collapses separate campuses!
   */
  public findExistingInstitution(params: {
    source_id?: string;
    name: string;
    campus_name?: string;
    domain?: string;
    city?: string;
  }): Institution | undefined {
    if (params.source_id && params.source_id.trim()) {
      const bySource = this.db.prepare('SELECT * FROM institutions WHERE source_id = ?').get(params.source_id.trim());
      if (bySource) {
        return { ...bySource, is_shortlisted: Boolean(bySource.is_shortlisted) };
      }
    }

    const normName = params.name.trim().toLowerCase();
    const normCampus = (params.campus_name || '').trim().toLowerCase();
    const normCity = (params.city || '').trim().toLowerCase();

    // If campus is specified, match on exact name + campus
    if (normCampus) {
      const row = this.db.prepare(
        'SELECT * FROM institutions WHERE LOWER(name) = ? AND LOWER(campus_name) = ?'
      ).get(normName, normCampus);
      if (row) return { ...row, is_shortlisted: Boolean(row.is_shortlisted) };
    }

    // Match on exact name + city
    if (normCity) {
      const row = this.db.prepare(
        'SELECT * FROM institutions WHERE LOWER(name) = ? AND LOWER(city) = ? AND (campus_name IS NULL OR campus_name = ?)'
      ).get(normName, normCity, params.campus_name || '');
      if (row) return { ...row, is_shortlisted: Boolean(row.is_shortlisted) };
    }

    // If no campus distinction is present and domain matches exactly with identical normalized name:
    if (!normCampus && params.domain) {
      const row = this.db.prepare(
        "SELECT * FROM institutions WHERE LOWER(name) = ? AND LOWER(domain) = ? AND (campus_name IS NULL OR campus_name = '')"
      ).get(normName, params.domain.toLowerCase());
      if (row) return { ...row, is_shortlisted: Boolean(row.is_shortlisted) };
    }

    // Fallback: exact name match if no campus or city conflict
    const row = this.db.prepare(
      "SELECT * FROM institutions WHERE LOWER(name) = ? AND (campus_name IS NULL OR campus_name = '') AND (city IS NULL OR city = '')"
    ).get(normName);
    if (row) return { ...row, is_shortlisted: Boolean(row.is_shortlisted) };

    return undefined;
  }

  public upsertInstitution(inst: Partial<Institution> & { name: string }): Institution {
    const existing = inst.id
      ? this.getInstitutionById(inst.id)
      : this.findExistingInstitution({
          source_id: inst.source_id,
          name: inst.name,
          campus_name: inst.campus_name,
          domain: inst.domain,
          city: inst.city,
        });

    const now = new Date().toISOString();
    const id = existing?.id || inst.id || `inst_${crypto.randomUUID()}`;

    // Compute domain from website_url if not provided
    let domain = inst.domain;
    if (!domain && inst.website_url) {
      try {
        const u = new URL(inst.website_url.includes('://') ? inst.website_url : `https://${inst.website_url}`);
        domain = u.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        // ignore
      }
    }

    if (existing) {
      const updated: Institution = {
        ...existing,
        ...inst,
        id,
        domain: domain || existing.domain,
        updated_at: now,
      };

      const stmt = this.db.prepare(`
        UPDATE institutions SET
          source_id = ?,
          name = ?,
          parent_organization = ?,
          campus_name = ?,
          location = ?,
          city = ?,
          state = ?,
          country = ?,
          website_url = ?,
          domain = ?,
          website_state = ?,
          research_status = ?,
          qualification_status = ?,
          qualification_reason = ?,
          is_shortlisted = ?,
          shortlist_reason = ?,
          notes = ?,
          updated_at = ?,
          last_researched_at = ?
        WHERE id = ?
      `);

      stmt.run(
        updated.source_id || null,
        updated.name,
        updated.parent_organization || null,
        updated.campus_name || null,
        updated.location || null,
        updated.city || null,
        updated.state || null,
        updated.country || null,
        updated.website_url || null,
        updated.domain || null,
        updated.website_state,
        updated.research_status,
        updated.qualification_status,
        updated.qualification_reason || null,
        updated.is_shortlisted ? 1 : 0,
        updated.shortlist_reason || null,
        updated.notes || null,
        updated.updated_at,
        updated.last_researched_at || null,
        id
      );

      return updated;
    } else {
      const newInst: Institution = {
        id,
        source_id: inst.source_id,
        name: inst.name,
        parent_organization: inst.parent_organization,
        campus_name: inst.campus_name,
        location: inst.location,
        city: inst.city,
        state: inst.state,
        country: inst.country,
        website_url: inst.website_url,
        domain,
        website_state: inst.website_state || 'UNKNOWN',
        research_status: inst.research_status || 'UNRESEARCHED',
        qualification_status: inst.qualification_status || 'PENDING_REVIEW',
        qualification_reason: inst.qualification_reason,
        is_shortlisted: Boolean(inst.is_shortlisted),
        shortlist_reason: inst.shortlist_reason,
        notes: inst.notes,
        created_at: inst.created_at || now,
        updated_at: now,
        last_researched_at: inst.last_researched_at,
      };

      const stmt = this.db.prepare(`
        INSERT INTO institutions (
          id, source_id, name, parent_organization, campus_name, location, city, state, country,
          website_url, domain, website_state, research_status, qualification_status,
          qualification_reason, is_shortlisted, shortlist_reason, notes, created_at, updated_at, last_researched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        newInst.id,
        newInst.source_id || null,
        newInst.name,
        newInst.parent_organization || null,
        newInst.campus_name || null,
        newInst.location || null,
        newInst.city || null,
        newInst.state || null,
        newInst.country || null,
        newInst.website_url || null,
        newInst.domain || null,
        newInst.website_state,
        newInst.research_status,
        newInst.qualification_status,
        newInst.qualification_reason || null,
        newInst.is_shortlisted ? 1 : 0,
        newInst.shortlist_reason || null,
        newInst.notes || null,
        newInst.created_at,
        newInst.updated_at,
        newInst.last_researched_at || null
      );

      // Create a default Outreach record if none exists
      this.ensureOutreachRecord(id);

      return newInst;
    }
  }

  public deleteInstitution(id: string) {
    this.db.prepare('DELETE FROM institutions WHERE id = ?').run(id);
  }

  // --- Contacts ---

  public getContacts(institutionId: string): Contact[] {
    const rows = this.db.prepare('SELECT * FROM contacts WHERE institution_id = ? ORDER BY created_at ASC').all(institutionId);
    return rows.map((r: any) => ({
      ...r,
      verified: Boolean(r.verified),
    }));
  }

  public addContacts(contacts: Omit<Contact, 'id'>[]): Contact[] {
    const stmt = this.db.prepare(`
      INSERT INTO contacts (id, institution_id, contact_type, value, label, source_url, confidence, verified, relevance_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result: Contact[] = [];
    const now = new Date().toISOString();

    for (const c of contacts) {
      // Deduplicate by (institution_id, contact_type, value)
      const existing = this.db.prepare(
        'SELECT * FROM contacts WHERE institution_id = ? AND contact_type = ? AND LOWER(value) = ?'
      ).get(c.institution_id, c.contact_type, c.value.toLowerCase().trim());

      if (existing) {
        result.push({ ...existing, verified: Boolean(existing.verified) });
        continue;
      }

      const id = `cnt_${crypto.randomUUID()}`;
      stmt.run(
        id,
        c.institution_id,
        c.contact_type,
        c.value.trim(),
        c.label || null,
        c.source_url || null,
        c.confidence ?? 0.5,
        c.verified ? 1 : 0,
        c.relevance_note || null,
        c.created_at || now
      );

      result.push({
        id,
        institution_id: c.institution_id,
        contact_type: c.contact_type,
        value: c.value.trim(),
        label: c.label,
        source_url: c.source_url,
        confidence: c.confidence ?? 0.5,
        verified: Boolean(c.verified),
        relevance_note: c.relevance_note,
        created_at: c.created_at || now,
      });
    }

    return result;
  }

  // --- Evidence ---

  public getEvidence(institutionId: string): EvidenceItem[] {
    return this.db.prepare('SELECT * FROM evidence WHERE institution_id = ? ORDER BY observed_at DESC').all(institutionId);
  }

  public setEvidence(institutionId: string, evidenceItems: Omit<EvidenceItem, 'id' | 'institution_id'>[]): EvidenceItem[] {
    // Replace current evidence for institution with fresh observations
    this.db.prepare('DELETE FROM evidence WHERE institution_id = ?').run(institutionId);

    const stmt = this.db.prepare(`
      INSERT INTO evidence (id, institution_id, signal_key, label, claim, status, source_url, evidence_snippet, confidence, observed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result: EvidenceItem[] = [];
    const now = new Date().toISOString();

    for (const e of evidenceItems) {
      const id = `ev_${crypto.randomUUID()}`;
      stmt.run(
        id,
        institutionId,
        e.signal_key,
        e.label,
        e.claim,
        e.status,
        e.source_url || null,
        e.evidence_snippet || null,
        e.confidence ?? 0.5,
        e.observed_at || now
      );

      result.push({
        id,
        institution_id: institutionId,
        signal_key: e.signal_key,
        label: e.label,
        claim: e.claim,
        status: e.status,
        source_url: e.source_url,
        evidence_snippet: e.evidence_snippet,
        confidence: e.confidence ?? 0.5,
        observed_at: e.observed_at || now,
      });
    }

    return result;
  }

  // --- Outreach ---

  public ensureOutreachRecord(institutionId: string): OutreachRecord {
    const existing = this.getOutreach(institutionId);
    if (existing) return existing;

    const id = `out_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO outreach (id, institution_id, outreach_status, approval_version, created_at, updated_at)
      VALUES (?, ?, 'NOT_CONTACTED', 0, ?, ?)
    `).run(id, institutionId, now, now);

    return this.getOutreach(institutionId)!;
  }

  public getOutreach(institutionId: string): OutreachRecord | undefined {
    return this.db.prepare('SELECT * FROM outreach WHERE institution_id = ?').get(institutionId);
  }

  public updateOutreach(institutionId: string, updates: Partial<OutreachRecord>): OutreachRecord {
    const current = this.ensureOutreachRecord(institutionId);
    const now = new Date().toISOString();

    // Critical Outreach Boundary Rule:
    // If draft recipient, subject, or body changed, any prior approval is automatically invalidated!
    const draftChanged =
      (updates.draft_recipient !== undefined && updates.draft_recipient !== current.draft_recipient) ||
      (updates.draft_subject !== undefined && updates.draft_subject !== current.draft_subject) ||
      (updates.draft_body !== undefined && updates.draft_body !== current.draft_body);

    let newStatus = updates.outreach_status ?? current.outreach_status;
    let approvalVersion = current.approval_version;
    let approvalTimestamp = updates.approval_timestamp ?? current.approval_timestamp;

    if (draftChanged && current.outreach_status === 'APPROVED_TO_CONTACT') {
      newStatus = 'DRAFTED';
      approvalTimestamp = undefined;
    }

    if (updates.outreach_status === 'APPROVED_TO_CONTACT' && current.outreach_status !== 'APPROVED_TO_CONTACT') {
      approvalVersion = (current.approval_version || 0) + 1;
      approvalTimestamp = now;
    }

    const merged: OutreachRecord = {
      ...current,
      ...updates,
      outreach_status: newStatus,
      approval_version: approvalVersion,
      approval_timestamp: approvalTimestamp,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      UPDATE outreach SET
        contact_name = ?,
        contact_email = ?,
        contact_role = ?,
        contact_source_url = ?,
        outreach_status = ?,
        review_decision = ?,
        draft_recipient = ?,
        draft_subject = ?,
        draft_body = ?,
        approval_version = ?,
        approval_timestamp = ?,
        gmail_message_id = ?,
        gmail_thread_id = ?,
        send_result = ?,
        reply_status = ?,
        reply_snippet = ?,
        bounce_reason = ?,
        opt_out_date = ?,
        updated_at = ?
      WHERE institution_id = ?
    `);

    stmt.run(
      merged.contact_name || null,
      merged.contact_email || null,
      merged.contact_role || null,
      merged.contact_source_url || null,
      merged.outreach_status,
      merged.review_decision || null,
      merged.draft_recipient || null,
      merged.draft_subject || null,
      merged.draft_body || null,
      merged.approval_version,
      merged.approval_timestamp || null,
      merged.gmail_message_id || null,
      merged.gmail_thread_id || null,
      merged.send_result || null,
      merged.reply_status || null,
      merged.reply_snippet || null,
      merged.bounce_reason || null,
      merged.opt_out_date || null,
      merged.updated_at,
      institutionId
    );

    return merged;
  }

  // --- Suppression ---

  public getSuppressionList(): SuppressionRecord[] {
    return this.db.prepare('SELECT * FROM suppression ORDER BY added_date DESC').all();
  }

  public isSuppressed(domain?: string, email?: string, institutionName?: string): { suppressed: boolean; reason?: string } {
    if (email && email.trim()) {
      const match = this.db.prepare("SELECT * FROM suppression WHERE type = 'EMAIL' AND LOWER(value) = ?").get(email.toLowerCase().trim());
      if (match) return { suppressed: true, reason: `Email suppressed: ${match.reason}` };
    }

    if (domain && domain.trim()) {
      const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();
      const match = this.db.prepare("SELECT * FROM suppression WHERE type = 'DOMAIN' AND LOWER(value) = ?").get(cleanDomain);
      if (match) return { suppressed: true, reason: `Domain suppressed: ${match.reason}` };
    }

    if (institutionName && institutionName.trim()) {
      const match = this.db.prepare("SELECT * FROM suppression WHERE type = 'INSTITUTION' AND LOWER(value) = ?").get(institutionName.toLowerCase().trim());
      if (match) return { suppressed: true, reason: `Institution suppressed: ${match.reason}` };
    }

    return { suppressed: false };
  }

  public addSuppression(entry: {
    type: SuppressionType;
    value: string;
    reason: string;
    source: string;
  }): SuppressionRecord {
    const id = `sup_${crypto.randomUUID()}`;
    const cleanValue = entry.type === 'DOMAIN'
      ? entry.value.toLowerCase().replace(/^www\./, '').trim()
      : entry.value.toLowerCase().trim();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO suppression (id, type, value, reason, source, added_date)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(value) DO UPDATE SET
        reason = excluded.reason,
        source = excluded.source,
        added_date = excluded.added_date
    `);

    stmt.run(id, entry.type, cleanValue, entry.reason, entry.source, now);

    return {
      id,
      type: entry.type,
      value: cleanValue,
      reason: entry.reason,
      source: entry.source,
      added_date: now,
    };
  }

  public removeSuppression(id: string) {
    this.db.prepare('DELETE FROM suppression WHERE id = ?').run(id);
  }

  // --- Audit Logs ---

  public addAuditLog(entry: {
    institution_id: string;
    field_name: string;
    old_value?: string;
    new_value?: string;
    changed_by?: string;
  }): AuditLog {
    const id = `aud_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO audit_logs (id, institution_id, field_name, old_value, new_value, changed_by, changed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.institution_id,
      entry.field_name,
      entry.old_value || null,
      entry.new_value || null,
      entry.changed_by || 'user',
      now
    );

    return {
      id,
      institution_id: entry.institution_id,
      field_name: entry.field_name,
      old_value: entry.old_value,
      new_value: entry.new_value,
      changed_by: entry.changed_by || 'user',
      changed_at: now,
    };
  }

  public getAuditLogs(institutionId: string): AuditLog[] {
    return this.db.prepare('SELECT * FROM audit_logs WHERE institution_id = ? ORDER BY changed_at DESC').all(institutionId);
  }

  // --- Aggregate Profile ---

  public getFullProfile(institutionId: string): FullInstitutionProfile | undefined {
    const inst = this.getInstitutionById(institutionId);
    if (!inst) return undefined;

    return {
      institution: inst,
      contacts: this.getContacts(institutionId),
      evidence: this.getEvidence(institutionId),
      outreach: this.getOutreach(institutionId),
      audit_logs: this.getAuditLogs(institutionId),
    };
  }

  // --- Settings ---

  public getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row?.value;
  }

  public setSetting(key: string, value: string) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  public getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }

  public close() {
    this.db.close();
  }
}

// Global singleton for standard server execution
declare global {
  var __ONEFOLK_DB_INSTANCE__: OneFolkDatabase | undefined;
}

export function getDatabase(): OneFolkDatabase {
  if (!global.__ONEFOLK_DB_INSTANCE__) {
    global.__ONEFOLK_DB_INSTANCE__ = new OneFolkDatabase();
  }
  return global.__ONEFOLK_DB_INSTANCE__;
}
