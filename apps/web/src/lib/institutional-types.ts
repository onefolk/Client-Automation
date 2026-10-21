export type WebsiteState = 'UNKNOWN' | 'VERIFIED_PRESENT' | 'UNREACHABLE' | 'NOT_FOUND';
export type ResearchStatus = 'UNRESEARCHED' | 'RESEARCHED' | 'RESEARCH_FAILED';
export type QualificationStatus = 'PENDING_REVIEW' | 'QUALIFIED' | 'DISQUALIFIED' | 'NEEDS_FURTHER_RESEARCH';
export type OutreachStatus =
  | 'NOT_CONTACTED'
  | 'REVIEWED'
  | 'DRAFTED'
  | 'APPROVED_TO_CONTACT'
  | 'SENT'
  | 'REPLIED'
  | 'BOUNCED'
  | 'OPTED_OUT'
  | 'DO_NOT_CONTACT';

export type EvidenceStatus = 'DETECTED' | 'NOT_OBSERVED' | 'UNKNOWN';
export type SuppressionType = 'DOMAIN' | 'EMAIL' | 'INSTITUTION';

export interface Institution {
  id: string;
  source_id?: string;
  name: string;
  parent_organization?: string;
  campus_name?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  website_url?: string;
  domain?: string;
  website_state: WebsiteState;
  research_status: ResearchStatus;
  qualification_status: QualificationStatus;
  qualification_reason?: string;
  is_shortlisted: boolean;
  shortlist_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  last_researched_at?: string;
}

export interface Contact {
  id: string;
  institution_id: string;
  contact_type: 'email' | 'phone';
  value: string;
  label?: string;
  source_url?: string;
  confidence: number;
  verified: boolean;
  relevance_note?: string;
  created_at: string;
}

export interface EvidenceItem {
  id: string;
  institution_id: string;
  signal_key: string;
  label: string;
  claim: string;
  status: EvidenceStatus;
  source_url?: string;
  evidence_snippet?: string;
  confidence: number;
  observed_at: string;
}

export interface OutreachRecord {
  id: string;
  institution_id: string;
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
  contact_source_url?: string;
  outreach_status: OutreachStatus;
  review_decision?: string;
  draft_recipient?: string;
  draft_subject?: string;
  draft_body?: string;
  approval_version: number;
  approval_timestamp?: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  send_result?: string;
  reply_status?: string;
  reply_snippet?: string;
  bounce_reason?: string;
  opt_out_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SuppressionRecord {
  id: string;
  type: SuppressionType;
  value: string;
  reason: string;
  source: string;
  added_date: string;
}

export interface AuditLog {
  id: string;
  institution_id: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  changed_by: string;
  changed_at: string;
}

export interface FullInstitutionProfile {
  institution: Institution;
  contacts: Contact[];
  evidence: EvidenceItem[];
  outreach?: OutreachRecord;
  audit_logs: AuditLog[];
}
