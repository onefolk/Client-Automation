import { OneFolkDatabase, getDatabase } from './db';
import { inspectInstitutionWebsite } from './crawler';
import { Institution, FullInstitutionProfile, QualificationStatus } from './institutional-types';

export interface ResearchOutcome {
  institution: Institution;
  qualification_status: QualificationStatus;
  qualification_reason: string;
  is_shortlisted: boolean;
  shortlist_reason?: string;
  opportunities: string[];
}

/**
 * Executes institutional research against official web properties.
 * Adheres strictly to the following guarantees:
 * 1. Bounded crawl with SSRF protection.
 * 2. Honest evidence status (missing features are NOT_OBSERVED, not assumed absent).
 * 3. Never invents ratings, traffic, revenue losses, or mailbox verification.
 * 4. Distinct research, qualification, and outreach statuses.
 * 5. Shortlisted != Approved to contact.
 */
export async function runInstitutionalResearch(
  institutionId: string,
  db: OneFolkDatabase = getDatabase()
): Promise<ResearchOutcome> {
  const institution = db.getInstitutionById(institutionId);
  if (!institution) {
    throw new Error(`Institution not found: ${institutionId}`);
  }

  // 1. Suppression Check
  const suppressionCheck = db.isSuppressed(institution.domain, undefined, institution.name);
  if (suppressionCheck.suppressed) {
    const updated = db.upsertInstitution({
      id: institution.id,
      name: institution.name,
      research_status: 'RESEARCHED',
      qualification_status: 'DISQUALIFIED',
      qualification_reason: `Disqualified by suppression rule: ${suppressionCheck.reason}`,
      is_shortlisted: false,
      shortlist_reason: 'Suppressed domain or institution',
      last_researched_at: new Date().toISOString(),
    });

    db.addAuditLog({
      institution_id: institution.id,
      field_name: 'qualification_status',
      old_value: institution.qualification_status,
      new_value: 'DISQUALIFIED',
      changed_by: 'system_suppression',
    });

    return {
      institution: updated,
      qualification_status: 'DISQUALIFIED',
      qualification_reason: `Disqualified by suppression rule: ${suppressionCheck.reason}`,
      is_shortlisted: false,
      shortlist_reason: 'Suppressed',
      opportunities: [],
    };
  }

  // 2. Perform safe, bounded crawl
  const inspection = await inspectInstitutionWebsite(institution.website_url);

  // 3. Persist contacts with explicit provenance (verified = false)
  if (inspection.contacts.length > 0) {
    db.addContacts(
      inspection.contacts.map((c) => ({
        institution_id: institution.id,
        contact_type: c.type,
        value: c.value,
        label: c.label,
        source_url: c.source_url,
        confidence: c.confidence,
        verified: false,
        relevance_note: c.relevance_note,
        created_at: new Date().toISOString(),
      }))
    );
  }

  // 4. Persist evidence items
  if (inspection.evidence.length > 0) {
    db.setEvidence(
      institution.id,
      inspection.evidence.map((e) => ({
        signal_key: e.signal_key,
        label: e.label,
        claim: e.claim,
        status: e.status,
        source_url: e.source_url,
        evidence_snippet: e.evidence_snippet,
        confidence: e.confidence,
        observed_at: new Date().toISOString(),
      }))
    );
  }

  // 5. Evaluate Qualification and Shortlisting
  let qualStatus: QualificationStatus = 'PENDING_REVIEW';
  let qualReason = '';
  let isShortlisted = false;
  let shortlistReason: string | undefined = undefined;

  if (inspection.website_state === 'NOT_FOUND') {
    qualStatus = 'NEEDS_FURTHER_RESEARCH';
    qualReason = 'Official website not identified. Requires manual verification before outreach.';
    isShortlisted = false;
  } else if (inspection.website_state === 'UNREACHABLE') {
    qualStatus = 'NEEDS_FURTHER_RESEARCH';
    qualReason = `Official website unreachable or destination blocked (${inspection.error_message || 'network error'}).`;
    isShortlisted = false;
  } else if (inspection.website_state === 'VERIFIED_PRESENT') {
    const opps = inspection.observed_opportunities;
    const contacts = db.getContacts(institution.id);
    const hasEmail = contacts.some((c) => c.contact_type === 'email');

    if (opps.length > 0 && hasEmail) {
      qualStatus = 'QUALIFIED';
      qualReason = `Verified website with observed digital upgrade opportunities: ${opps.join('; ')}`;
      isShortlisted = true;
      shortlistReason = `Qualified institutional candidate: ${opps.slice(0, 2).join(', ')}`;
    } else if (opps.length > 0 && !hasEmail) {
      qualStatus = 'NEEDS_FURTHER_RESEARCH';
      qualReason = `Identified opportunities (${opps.slice(0, 2).join(', ')}), but no public contact email observed on inspected pages.`;
      isShortlisted = false;
      shortlistReason = 'Pending contact identification';
    } else {
      qualStatus = 'PENDING_REVIEW';
      qualReason = 'Modern web presence observed across inspected pages. Manual review recommended for specialized curriculum or portal requirements.';
      isShortlisted = false;
    }
  }

  // 6. Update Institution Record
  const updated = db.upsertInstitution({
    id: institution.id,
    name: institution.name,
    website_url: inspection.final_url || institution.website_url,
    website_state: inspection.website_state,
    research_status: inspection.website_state === 'UNREACHABLE' ? 'RESEARCH_FAILED' : 'RESEARCHED',
    qualification_status: qualStatus,
    qualification_reason: qualReason,
    is_shortlisted: isShortlisted,
    shortlist_reason: shortlistReason,
    last_researched_at: new Date().toISOString(),
  });

  // 7. Initialize clean draft if Qualified and no draft exists yet
  if (isShortlisted && qualStatus === 'QUALIFIED') {
    const contacts = db.getContacts(institution.id);
    const primaryEmail = contacts.find((c) => c.contact_type === 'email');
    const existingOutreach = db.getOutreach(institution.id);

    if (primaryEmail && (!existingOutreach || !existingOutreach.draft_body)) {
      const topOpportunity = inspection.observed_opportunities[0] || 'digital student inquiry and portal architecture';
      db.updateOutreach(institution.id, {
        contact_name: primaryEmail.label || 'Admissions Team',
        contact_email: primaryEmail.value,
        contact_role: primaryEmail.label,
        contact_source_url: primaryEmail.source_url,
        outreach_status: 'DRAFTED',
        review_decision: 'PENDING',
        draft_recipient: primaryEmail.value,
        draft_subject: `Inquiry regarding ${institution.name} – Digital Admissions & Web Experience`,
        draft_body:
`Dear ${institution.name} Team,

I recently reviewed your online presence at ${institution.website_url}.

During our review, we observed opportunities to strengthen your public institutional engagement, specifically regarding ${topOpportunity.toLowerCase()}.

We specialize in high-performance web experiences and automated inquiry workflows for modern educational institutions.

Would you be open to a brief review of our technical findings?

Best regards,
OneFolk Institutional Advisory Team`,
      });
    }
  }

  // 8. Log Audit
  db.addAuditLog({
    institution_id: institution.id,
    field_name: 'research_status',
    old_value: institution.research_status,
    new_value: updated.research_status,
    changed_by: 'research_crawler',
  });

  return {
    institution: updated,
    qualification_status: qualStatus,
    qualification_reason: qualReason,
    is_shortlisted: isShortlisted,
    shortlist_reason: shortlistReason,
    opportunities: inspection.observed_opportunities,
  };
}

/**
 * Applies a manual correction to an institution and records an audit log entry.
 */
export function applyManualCorrection(
  institutionId: string,
  changes: Partial<Institution>,
  notes: string,
  changedBy = 'user',
  db: OneFolkDatabase = getDatabase()
): FullInstitutionProfile {
  const current = db.getInstitutionById(institutionId);
  if (!current) {
    throw new Error(`Institution not found: ${institutionId}`);
  }

  // Record audit logs for each changed field
  for (const [key, value] of Object.entries(changes)) {
    const oldValue = (current as any)[key];
    if (String(oldValue) !== String(value)) {
      db.addAuditLog({
        institution_id: institutionId,
        field_name: key,
        old_value: oldValue != null ? String(oldValue) : undefined,
        new_value: value != null ? String(value) : undefined,
        changed_by: changedBy,
      });
    }
  }

  db.upsertInstitution({
    ...current,
    ...changes,
    notes: notes ? (current.notes ? `${current.notes}\n[Manual Correction]: ${notes}` : notes) : current.notes,
  });

  return db.getFullProfile(institutionId)!;
}
