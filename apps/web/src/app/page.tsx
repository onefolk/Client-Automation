'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Search,
  Globe,
  Upload,
  Download,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  Mail,
  Phone,
  FileText,
  Clock,
  Sparkles,
  Filter,
  Check,
  Send,
  UserCheck,
} from 'lucide-react';
import {
  Institution,
  FullInstitutionProfile,
  QualificationStatus,
  WebsiteState,
} from '@/lib/institutional-types';

export default function InstitutionalLeadsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualFilter, setQualFilter] = useState<string>('ALL');
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<FullInstitutionProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [syncCsvText, setSyncCsvText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Manual Edit State in Drawer
  const [editNotes, setEditNotes] = useState('');
  const [editQualStatus, setEditQualStatus] = useState<QualificationStatus>('PENDING_REVIEW');
  const [editShortlisted, setEditShortlisted] = useState(false);
  const [researchingId, setResearchingId] = useState<string | null>(null);

  // Load Institutions
  const fetchInstitutions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (qualFilter !== 'ALL') params.set('qualification_status', qualFilter);
      if (shortlistOnly) params.set('is_shortlisted', 'true');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/institutions?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setInstitutions(json.data);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to load leads: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, [qualFilter, shortlistOnly, searchQuery]);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  // Load Profile when selected
  const fetchProfile = async (id: string) => {
    setSelectedId(id);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/institutions/${id}`);
      const json = await res.json();
      if (json.success) {
        setActiveProfile(json.data);
        setEditNotes(json.data.institution.notes || '');
        setEditQualStatus(json.data.institution.qualification_status);
        setEditShortlisted(json.data.institution.is_shortlisted);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to load lead details: ${err.message}` });
    } finally {
      setProfileLoading(false);
    }
  };

  // Run Research for a single institution
  const handleResearch = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setResearchingId(id);
    setStatusMessage({ type: 'info', text: 'Conducting safe SSRF-guarded research & evidence analysis...' });
    try {
      const res = await fetch(`/api/institutions/${id}/research`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({
          type: 'success',
          text: `Research completed. Qualification: ${json.outcome.qualification_status} (${json.outcome.is_shortlisted ? 'Shortlisted' : 'Not Shortlisted'})`,
        });
        await fetchInstitutions();
        if (selectedId === id) {
          await fetchProfile(id);
        }
      } else {
        setStatusMessage({ type: 'error', text: `Research failed: ${json.error}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Network error during research: ${err.message}` });
    } finally {
      setResearchingId(null);
    }
  };

  // Save Manual Corrections
  const handleSaveCorrection = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/institutions/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qualification_status: editQualStatus,
          is_shortlisted: editShortlisted,
          notes: editNotes,
          changed_by: 'lead_reviewer',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({ type: 'success', text: 'Manual correction saved with audit log.' });
        await fetchInstitutions();
        await fetchProfile(selectedId);
      } else {
        setStatusMessage({ type: 'error', text: `Save failed: ${json.error}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  // Import CSV
  const handleImportCsv = async () => {
    if (!importCsvText.trim()) return;
    try {
      const res = await fetch('/api/institutions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: importCsvText,
      });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({
          type: 'success',
          text: `CSV Imported successfully! Added ${json.imported} new leads, updated ${json.updated} existing.`,
        });
        setShowImportModal(false);
        setImportCsvText('');
        fetchInstitutions();
      } else {
        setStatusMessage({ type: 'error', text: `Import failed: ${json.error}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  // Sync Outreach CSV
  const handleSyncOutreach = async () => {
    if (!syncCsvText.trim()) return;
    try {
      const res = await fetch('/api/outreach/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: syncCsvText,
      });
      const json = await res.json();
      if (json.success) {
        setStatusMessage({
          type: 'success',
          text: `Outreach synced successfully! Synced ${json.synced} records (${json.opt_outs_suppressed} added to permanent suppression).`,
        });
        setShowSyncModal(false);
        setSyncCsvText('');
        fetchInstitutions();
        if (selectedId) fetchProfile(selectedId);
      } else {
        setStatusMessage({ type: 'error', text: `Sync failed: ${json.error}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  // Counts
  const totalCount = institutions.length;
  const qualifiedCount = institutions.filter((i) => i.qualification_status === 'QUALIFIED').length;
  const shortlistedCount = institutions.filter((i) => i.is_shortlisted).length;
  const researchedCount = institutions.filter((i) => i.research_status === 'RESEARCHED').length;
  const pendingCount = institutions.filter((i) => i.qualification_status === 'PENDING_REVIEW' || i.qualification_status === 'NEEDS_FURTHER_RESEARCH').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Institutional Lead Intelligence</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              v1.0 Local Durable
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Research, verify, and shortlist educational institutions. Free-tier, low-maintenance operational workflow.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-white/[0.08] transition"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-300" />
            Import CSV
          </button>

          <a
            href="/api/institutions/export-csv?tab=leads"
            download="onefolk_leads.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-white/[0.08] transition"
          >
            <Download className="w-3.5 h-3.5 text-zinc-300" />
            Export Leads CSV
          </a>

          <a
            href="/api/institutions/export-csv?tab=evidence"
            download="onefolk_evidence.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-white/[0.08] transition"
          >
            <Download className="w-3.5 h-3.5 text-zinc-300" />
            Export Evidence
          </a>

          <a
            href="/api/institutions/export-csv?tab=outreach"
            download="onefolk_outreach.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-white/[0.08] transition"
          >
            <Download className="w-3.5 h-3.5 text-zinc-300" />
            Export Outreach
          </a>

          <button
            onClick={() => setShowSyncModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-950/60 hover:bg-indigo-900/60 text-xs font-medium text-indigo-300 border border-indigo-700/30 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            Sync from Sheets
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-md text-xs flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/30 text-rose-300 border-rose-800/40'
              : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/40'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-zinc-500 hover:text-zinc-300 ml-4">
            ×
          </button>
        </div>
      )}

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Total Leads</span>
          <p className="text-xl font-bold text-white mt-1">{totalCount}</p>
        </div>
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Researched</span>
          <p className="text-xl font-bold text-sky-400 mt-1">{researchedCount}</p>
        </div>
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Shortlisted</span>
          <p className="text-xl font-bold text-emerald-400 mt-1">{shortlistedCount}</p>
        </div>
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Qualified</span>
          <p className="text-xl font-bold text-indigo-400 mt-1">{qualifiedCount}</p>
        </div>
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Review Needed</span>
          <p className="text-xl font-bold text-amber-400 mt-1">{pendingCount}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-lg border border-white/[0.06]">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, campus, or city..."
            className="w-full bg-zinc-950 border border-white/[0.08] rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span>Qualification:</span>
          </div>
          <select
            value={qualFilter}
            onChange={(e) => setQualFilter(e.target.value)}
            className="bg-zinc-950 border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
          >
            <option value="ALL">All States</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="NEEDS_FURTHER_RESEARCH">Needs Research</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="DISQUALIFIED">Disqualified</option>
          </select>

          <button
            onClick={() => setShortlistOnly(!shortlistOnly)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
              shortlistOnly
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                : 'bg-zinc-950 text-zinc-400 border-white/[0.08] hover:text-white'
            }`}
          >
            {shortlistOnly ? '✓ Shortlisted Only' : 'Shortlisted Only'}
          </button>
        </div>
      </div>

      {/* Main Layout: Table + Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table View (Cols 7 or 12) */}
        <div className={`${selectedId ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all`}>
          <div className="bg-zinc-900/40 rounded-lg border border-white/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 border-b border-white/[0.08] text-zinc-400 text-[11px] font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Institution & Campus</th>
                    <th className="py-2.5 px-3">Website & State</th>
                    <th className="py-2.5 px-3">Qualification</th>
                    <th className="py-2.5 px-3">Shortlisted</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500">
                        Loading institutions...
                      </td>
                    </tr>
                  ) : institutions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-500">
                        <Building2 className="w-8 h-8 mx-auto text-zinc-600 mb-2 stroke-[1.5]" />
                        <p className="text-xs font-medium text-zinc-400">No institutions found</p>
                        <p className="text-[11px] text-zinc-500 mt-1">Import a CSV list or add a lead to begin research.</p>
                      </td>
                    </tr>
                  ) : (
                    institutions.map((inst) => {
                      const isSelected = inst.id === selectedId;
                      const isResearching = inst.id === researchingId;

                      return (
                        <tr
                          key={inst.id}
                          onClick={() => fetchProfile(inst.id)}
                          className={`cursor-pointer transition hover:bg-zinc-800/40 ${
                            isSelected ? 'bg-zinc-800/70 border-l-2 border-emerald-500' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{inst.name}</div>
                            {inst.campus_name && (
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                                <span className="text-zinc-500">Campus:</span> {inst.campus_name}
                              </div>
                            )}
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {[inst.city, inst.state, inst.country].filter(Boolean).join(', ') || 'Location Unset'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {inst.website_url ? (
                              <a
                                href={inst.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-sky-400 hover:underline flex items-center gap-1 text-[11px]"
                              >
                                <span className="truncate max-w-[130px]">{inst.domain || inst.website_url}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-zinc-500 text-[11px]">No website URL</span>
                            )}
                            <div className="mt-1">
                              <WebsiteStateBadge state={inst.website_state} />
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <QualificationBadge status={inst.qualification_status} />
                            {inst.qualification_reason && (
                              <p className="text-[10px] text-zinc-400 truncate max-w-[160px] mt-1" title={inst.qualification_reason}>
                                {inst.qualification_reason}
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {inst.is_shortlisted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/40">
                                <Check className="w-3 h-3 text-emerald-400" />
                                Shortlisted
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-500">No</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => handleResearch(inst.id, e)}
                              disabled={isResearching}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-white border border-white/[0.08] transition disabled:opacity-50"
                            >
                              {isResearching ? 'Crawling...' : 'Research'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Drawer (Col 5) */}
        {selectedId && (
          <div className="lg:col-span-5 bg-zinc-900/60 rounded-lg border border-white/[0.08] p-4 space-y-5 sticky top-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{activeProfile?.institution.name || 'Lead Details'}</h3>
                {activeProfile?.institution.campus_name && (
                  <p className="text-[11px] text-zinc-400">{activeProfile.institution.campus_name}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 rounded"
              >
                Close
              </button>
            </div>

            {profileLoading ? (
              <div className="py-12 text-center text-xs text-zinc-500">Loading details...</div>
            ) : activeProfile ? (
              <div className="space-y-4 text-xs">
                {/* Qualification & Shortlist Banner */}
                <div className="p-3 rounded-md bg-zinc-950 border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Qualification Status</span>
                    <QualificationBadge status={activeProfile.institution.qualification_status} />
                  </div>
                  {activeProfile.institution.qualification_reason && (
                    <p className="text-[11px] text-zinc-300 leading-relaxed bg-zinc-900/60 p-2 rounded border border-white/[0.04]">
                      {activeProfile.institution.qualification_reason}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-zinc-400 font-medium">Shortlisted for Review</span>
                    <span className={`font-semibold ${activeProfile.institution.is_shortlisted ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {activeProfile.institution.is_shortlisted ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                {/* Evidence & Observed Signals */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">Observed Evidence & Claims</span>
                    <span className="text-[10px] text-zinc-500">{activeProfile.evidence.length} signals</span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeProfile.evidence.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 italic">No web evidence recorded. Click &quot;Research&quot; to inspect.</p>
                    ) : (
                      activeProfile.evidence.map((ev) => (
                        <div key={ev.id} className="p-2 rounded bg-zinc-950/70 border border-white/[0.04] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-zinc-300">{ev.label}</span>
                            <EvidenceStatusBadge status={ev.status} />
                          </div>
                          <p className="text-[11px] text-zinc-400">{ev.claim}</p>
                          {ev.evidence_snippet && (
                            <p className="text-[10px] text-zinc-500 font-mono truncate">{ev.evidence_snippet}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Extracted Contacts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">Extracted Institutional Contacts</span>
                    <span className="text-[10px] text-zinc-500">Unverified Regex Provenance</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {activeProfile.contacts.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 italic">No public contacts extracted yet.</p>
                    ) : (
                      activeProfile.contacts.map((c) => (
                        <div key={c.id} className="p-2 rounded bg-zinc-950/70 border border-white/[0.04] flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {c.contact_type === 'email' ? <Mail className="w-3 h-3 text-sky-400" /> : <Phone className="w-3 h-3 text-emerald-400" />}
                              <span className="text-zinc-200 font-mono truncate">{c.value}</span>
                              <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">{c.label}</span>
                            </div>
                            {c.source_url && (
                              <p className="text-[10px] text-zinc-500 truncate mt-0.5">Source: {c.source_url}</p>
                            )}
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/[0.04]">
                            verified: false
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Outreach Draft Preview */}
                {activeProfile.outreach && (
                  <div className="p-3 rounded bg-zinc-950 border border-indigo-900/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-300">Outreach Boundary</span>
                      <OutreachStatusBadge status={activeProfile.outreach.outreach_status} />
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      The application prepares drafts, but never sends autonomously. Outreach is executed separately by ChatGPT via connected Gmail.
                    </p>
                    {activeProfile.outreach.draft_subject && (
                      <div className="text-[11px] text-zinc-300 font-medium">
                        Subject: {activeProfile.outreach.draft_subject}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Correction Form */}
                <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                  <span className="font-semibold text-white block">Manual Correction & Review Notes</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Qualification Status</label>
                      <select
                        value={editQualStatus}
                        onChange={(e) => setEditQualStatus(e.target.value as QualificationStatus)}
                        className="w-full bg-zinc-950 border border-white/[0.08] rounded p-1.5 text-xs text-white"
                      >
                        <option value="PENDING_REVIEW">Pending Review</option>
                        <option value="QUALIFIED">Qualified</option>
                        <option value="NEEDS_FURTHER_RESEARCH">Needs Research</option>
                        <option value="DISQUALIFIED">Disqualified</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Shortlist Decision</label>
                      <button
                        type="button"
                        onClick={() => setEditShortlisted(!editShortlisted)}
                        className={`w-full py-1.5 px-2 rounded text-xs font-medium border transition ${
                          editShortlisted
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                            : 'bg-zinc-950 text-zinc-400 border-white/[0.08]'
                        }`}
                      >
                        {editShortlisted ? '✓ Shortlisted' : 'Not Shortlisted'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Reviewer Notes (Logged to Audit Trail)</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      placeholder="Add manual verification reasoning..."
                      className="w-full bg-zinc-950 border border-white/[0.08] rounded p-2 text-xs text-white placeholder-zinc-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleResearch(selectedId)}
                      disabled={researchingId === selectedId}
                      className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-white/[0.08]"
                    >
                      Re-run Research
                    </button>
                    <button
                      onClick={handleSaveCorrection}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white shadow-sm"
                    >
                      Save Correction
                    </button>
                  </div>
                </div>

                {/* Audit Trail */}
                {activeProfile.audit_logs.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.08]">
                    <span className="font-semibold text-zinc-400 text-[11px] block mb-1.5">Change History (Audit Trail)</span>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {activeProfile.audit_logs.map((log) => (
                        <div key={log.id} className="text-[10px] text-zinc-500">
                          <span className="font-mono text-zinc-400">{log.changed_at.split('T')[0]}:</span> Changed {log.field_name} to &quot;{log.new_value}&quot; by {log.changed_by}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/[0.12] rounded-lg p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Import Institutional List (CSV)</h3>
              <button onClick={() => setShowImportModal(false)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Paste CSV text below with headers such as <code>Institution Name, Campus, Website, City, Parent Org</code>.
              Existing approvals and outreach data are guaranteed never to be overwritten.
            </p>
            <textarea
              rows={8}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder="Institution Name,Campus Name,Website,City&#10;St. Andrews Academy,Main,https://standrews.example,Edinburgh"
              className="w-full bg-zinc-950 border border-white/[0.08] rounded p-3 text-xs text-white font-mono placeholder-zinc-600"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCsv}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white shadow-sm"
              >
                Start Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Manually Modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            fetchInstitutions();
          }}
        />
      )}

      {/* Sync Outreach from Sheets Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/[0.12] rounded-lg p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Sync Outreach from Google Sheets</h3>
              <button onClick={() => setShowSyncModal(false)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Paste the exported CSV from your Google Sheets <code>Outreach</code> tab. This syncs review decisions, sent message IDs, replies, and automatically adds any opt-outs to the permanent suppression table.
            </p>
            <textarea
              rows={8}
              value={syncCsvText}
              onChange={(e) => setSyncCsvText(e.target.value)}
              placeholder="Lead ID,Outreach Status,Review Decision,Gmail Message ID,Opt Out Date&#10;inst_123,APPROVED_TO_CONTACT,APPROVE,,&#10;inst_456,OPTED_OUT,,,2026-10-21"
              className="w-full bg-zinc-950 border border-white/[0.08] rounded p-3 text-xs text-white font-mono placeholder-zinc-600"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSyncModal(false)}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSyncOutreach}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow-sm"
              >
                Sync Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          campus_name: campus.trim() || undefined,
          website_url: website.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onAdded();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-white/[0.12] rounded-lg p-6 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Add Institution Lead</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1">Institution Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oakridge International School"
              className="w-full bg-zinc-950 border border-white/[0.08] rounded p-2 text-white"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Campus / Branch Identity</label>
            <input
              type="text"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              placeholder="e.g. North Campus (kept separate from parent)"
              className="w-full bg-zinc-950 border border-white/[0.08] rounded p-2 text-white"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Official Website URL</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://oakridge.example"
              className="w-full bg-zinc-950 border border-white/[0.08] rounded p-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-400 block mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full bg-zinc-950 border border-white/[0.08] rounded p-2 text-white"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className="w-full bg-zinc-950 border border-white/[0.08] rounded p-2 text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white">
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white shadow-sm">
            Save Lead
          </button>
        </div>
      </form>
    </div>
  );
}

function WebsiteStateBadge({ state }: { state: WebsiteState }) {
  if (state === 'VERIFIED_PRESENT') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">Verified Present</span>;
  }
  if (state === 'UNREACHABLE') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800/40">Unreachable</span>;
  }
  if (state === 'NOT_FOUND') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/40">Not Found</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Unknown</span>;
}

function QualificationBadge({ status }: { status: QualificationStatus }) {
  if (status === 'QUALIFIED') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/40">Qualified</span>;
  }
  if (status === 'NEEDS_FURTHER_RESEARCH') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-950 text-amber-400 border border-amber-800/40">Needs Research</span>;
  }
  if (status === 'DISQUALIFIED') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-rose-950 text-rose-400 border border-rose-800/40">Disqualified</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-zinc-800 text-zinc-400">Pending Review</span>;
}

function EvidenceStatusBadge({ status }: { status: string }) {
  if (status === 'DETECTED') {
    return <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/40">DETECTED</span>;
  }
  if (status === 'NOT_OBSERVED') {
    return <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-amber-950 text-amber-400 border border-amber-800/40">NOT OBSERVED</span>;
  }
  return <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-zinc-800 text-zinc-400">UNKNOWN</span>;
}

function OutreachStatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED_TO_CONTACT') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/40">Approved to Contact</span>;
  }
  if (status === 'DRAFTED') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-950 text-indigo-400 border border-indigo-800/40">Drafted</span>;
  }
  if (status === 'SENT') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-sky-950 text-sky-400 border border-sky-800/40">Sent via Gmail</span>;
  }
  if (status === 'OPTED_OUT') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-rose-950 text-rose-400 border border-rose-800/40">Opted Out</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-zinc-800 text-zinc-400">Not Contacted</span>;
}
