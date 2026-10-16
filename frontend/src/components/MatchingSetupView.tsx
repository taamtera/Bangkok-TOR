'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ExternalLink, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import type { SoftwareHouseProfile } from '@/types';
import * as tagApi from '@/lib/tagApi';
import * as torApi from '@/lib/torApi';
import type { BackendTor } from '@/lib/torApi';

type DraftTorAssignment = tagApi.TorTagAssignment;

function message(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed. Please try again.';
}

export function MatchingSetupView({ currentUser, onEditProfile, onViewRecommendations }: {
  currentUser: SoftwareHouseProfile;
  onEditProfile: () => void;
  onViewRecommendations: () => void;
}) {
  const canReviewTors = currentUser.role === 'project_manager' || currentUser.role === 'system_admin';
  const isAdmin = currentUser.role === 'system_admin';
  const [tags, setTags] = useState<tagApi.ControlledTag[]>([]);
  const [tors, setTors] = useState<BackendTor[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [torAssignments, setTorAssignments] = useState<DraftTorAssignment[]>([]);
  const [torSuggestions, setTorSuggestions] = useState<tagApi.TorTagSuggestion[]>([]);
  const [reviewingSuggestion, setReviewingSuggestion] = useState('');
  const [query, setQuery] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagCategory, setTagCategory] = useState('capability');
  const [loading, setLoading] = useState(true);
  const [savingTor, setSavingTor] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedTor = tors.find((tor) => tor.projectId === selectedProjectId) || null;
  const visibleTors = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return tors;
    return tors.filter((tor) => `${tor.title || ''} ${tor.projectId} ${tor.departmentName || ''}`.toLocaleLowerCase().includes(normalized));
  }, [query, tors]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (canReviewTors) {
        const loadedTags = await tagApi.listTags();
        setTags(loadedTags.filter((tag) => tag.status === 'active'));
        const torList = await torApi.listBackendTors({ limit: 100, page: 1, sort: 'latest' });
        setTors(torList.items);
        setSelectedProjectId((current) => current || torList.items[0]?.projectId || '');
      }
    } catch (loadError) {
      setError(message(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* load once when the account is known */ }, [currentUser.companyId, canReviewTors]);

  useEffect(() => {
    const currentTor = tors.find((tor) => tor.projectId === selectedProjectId);
    const approvedAssignments = (currentTor?.tagAssignments || []).filter((assignment) => assignment.reviewStatus === 'approved'
      && assignment.source !== 'announcement_text'
      && ['required', 'preferred', 'informational'].includes(assignment.requirementLevel || '')).map((assignment) => ({
      tagId: assignment.tagId || '',
      requirementLevel: (assignment.requirementLevel || 'required') as tagApi.RequirementLevel,
      evidence: assignment.evidence || '',
      reviewStatus: assignment.reviewStatus || null
    })).filter((assignment) => assignment.tagId);
    setTorAssignments(approvedAssignments);
  }, [selectedProjectId, tors]);

  useEffect(() => {
    let cancelled = false;
    setTorSuggestions([]);
    if (!canReviewTors || !selectedProjectId) return () => { cancelled = true; };
    void tagApi.listTorSuggestions(selectedProjectId).then((items) => {
      if (!cancelled) setTorSuggestions(items);
    }).catch((suggestionError) => {
      if (!cancelled) setError(message(suggestionError));
    });
    return () => { cancelled = true; };
  }, [canReviewTors, selectedProjectId]);

  const saveTor = async () => {
    if (!selectedTor) return setError('Select a TOR before saving requirements.');
    if (torAssignments.some((assignment) => !assignment.evidence.trim())) return setError('Add a citation or source location from the TOR for every requirement.');
    setSavingTor(true); setError(''); setNotice('');
    try {
      await tagApi.saveTorAssignments(selectedTor.projectId, torAssignments);
      setTors((current) => current.map((tor) => tor.projectId === selectedTor.projectId
        ? { ...tor, tagAssignments: torAssignments.map((assignment) => ({ ...assignment, reviewStatus: 'approved' })) }
        : tor));
      setNotice('TOR requirements saved and approved by this reviewer. Matching results were refreshed.');
    } catch (saveError) { setError(message(saveError)); }
    finally { setSavingTor(false); }
  };

  const reviewSuggestion = async (suggestion: tagApi.TorTagSuggestion, reviewStatus: 'approved' | 'rejected') => {
    if (!selectedTor) return;
    setReviewingSuggestion(suggestion.suggestionId); setError(''); setNotice('');
    try {
      await tagApi.reviewTorSuggestion(selectedTor.projectId, suggestion.suggestionId, reviewStatus);
      setTorSuggestions(await tagApi.listTorSuggestions(selectedTor.projectId));
      if (reviewStatus === 'approved') {
        const freshTor = await torApi.getTor(selectedTor.projectId);
        setTors((current) => current.map((tor) => tor.projectId === freshTor.projectId ? freshTor : tor));
        setNotice('The cited AI suggestion was approved and matching results were refreshed.');
      } else {
        setNotice('The AI suggestion was rejected and will not affect matching.');
      }
    } catch (reviewError) { setError(message(reviewError)); }
    finally { setReviewingSuggestion(''); }
  };

  const addTag = async () => {
    const name = tagName.trim();
    if (!name) return;
    setError('');
    try {
      const result = await tagApi.createTag({ name, category: tagCategory, aliases: [], description: '' });
      setTags((current) => [...current, result.tag].sort((a, b) => a.name.localeCompare(b.name)));
      setTagName(''); setNotice(`Controlled tag “${result.tag.name}” created.`);
    } catch (createError) { setError(message(createError)); }
  };

  const updateTor = (index: number, changes: Partial<DraftTorAssignment>) => setTorAssignments((current) => current.map((entry, i) => i === index ? { ...entry, ...changes } : entry));
  const inputClass = 'theme-input w-full rounded-lg px-3 py-2 text-sm';
  const cardClass = 'theme-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4';

  if (loading) return <div className="theme-card rounded-xl p-8 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading matching setup…</div>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Matching setup</h1>
        <p className="mt-1 text-sm text-slate-500">Keep your company qualifications and capabilities up to date to receive relevant TOR recommendations.</p>
      </header>

      {!canReviewTors && <section className={`${cardClass} flex flex-wrap items-center justify-between`}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Your Company Profile is the only place to enter qualifications and technologies. Recommendations use it automatically.</p>
        <div className="flex gap-2">
          <button onClick={onEditProfile} className="theme-input rounded-lg px-3 py-2 text-sm">Edit company profile</button>
          <button onClick={onViewRecommendations} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white">View recommendations</button>
        </div>
      </section>}

      {error && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><Check className="mr-2 inline h-4 w-4" />{notice}</div>}

      {canReviewTors && <section className={cardClass}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-sky-600" />
          <div><h2 className="font-semibold text-slate-900 dark:text-white">TOR requirements</h2>
            <p className="mt-1 text-xs text-slate-500">Review source-backed TOR capability tags. Your company account receives automatic recommendations without managing these annotations.</p>
          </div>
        </div>
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded TORs by title, project ID, or department" />
            <select className={inputClass} value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Select a TOR</option>{visibleTors.map((tor) => <option key={tor.projectId} value={tor.projectId}>{tor.title || tor.projectId} · {tor.projectId}</option>)}
            </select>
          </div>
          {selectedTor && <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <p className="font-medium">{selectedTor.title || selectedTor.projectId}</p>
            <p className="mt-1 text-xs text-slate-500">Project {selectedTor.projectId} · {selectedTor.departmentName || 'Department unavailable'} · {selectedTor.documentUrl || selectedTor.url ? <a className="text-sky-700 underline dark:text-sky-300" href={selectedTor.documentUrl || selectedTor.url || ''} target="_blank" rel="noreferrer">Open source document</a> : 'Source document unavailable'}</p>
          </div>}
          {selectedTor && <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/20">
            <div><h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI requirement suggestions</h3><p className="mt-1 text-xs text-slate-500">Suggestions are not used in scores until a reviewer checks the citation and approves them.</p></div>
            {torSuggestions.length === 0 ? <p className="text-sm text-slate-500">No AI suggestions have been submitted for this TOR.</p> : torSuggestions.map((suggestion) => {
              const tag = tags.find((item) => item._id === suggestion.tagId);
              return <div key={suggestion.suggestionId} className="rounded-lg bg-white p-3 text-sm dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{tag?.name || 'Unknown tag'} · {suggestion.requirementLevel} · {suggestion.reviewStatus}</p>
                  <span className="text-xs text-slate-500">AI confidence: {Math.round(suggestion.confidence * 100)}%</span>
                </div>
                <p className="mt-2 text-slate-700 dark:text-slate-300">{suggestion.evidence}</p>
                <p className="mt-1 text-xs text-slate-500">{suggestion.sourcePage ? `Source page: ${suggestion.sourcePage} · ` : ''}<a className="inline-flex items-center gap-1 text-sky-700 underline dark:text-sky-300" href={suggestion.sourceDocumentUrl} target="_blank" rel="noreferrer">Open cited source<ExternalLink className="h-3 w-3" /></a></p>
                {suggestion.reviewStatus === 'suggested' && <div className="mt-3 flex gap-2">
                  <button disabled={Boolean(reviewingSuggestion)} onClick={() => void reviewSuggestion(suggestion, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />{reviewingSuggestion === suggestion.suggestionId ? 'Reviewing…' : 'Approve'}</button>
                  <button disabled={Boolean(reviewingSuggestion)} onClick={() => void reviewSuggestion(suggestion, 'rejected')} className="theme-input inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"><X className="h-3.5 w-3.5" />Reject</button>
                </div>}
              </div>;
            })}
          </div>}
          {!selectedTor && <p className="text-sm text-slate-500">No TORs were returned by the API.</p>}
          {torAssignments.map((assignment, index) => <div key={`${assignment.tagId}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_150px_1.5fr_auto]">
            <select className={inputClass} aria-label="Requirement tag" value={assignment.tagId} onChange={(event) => updateTor(index, { tagId: event.target.value })}>
              <option value="">Select a tag</option>{tags.map((tag) => <option key={tag._id} value={tag._id}>{tag.name} · {tag.category}</option>)}
            </select>
            <select className={inputClass} aria-label="Requirement importance" value={assignment.requirementLevel} onChange={(event) => updateTor(index, { requirementLevel: event.target.value as tagApi.RequirementLevel })}>
              <option value="required">Required</option><option value="preferred">Preferred</option><option value="informational">Informational</option>
            </select>
            <input className={inputClass} aria-label="Requirement evidence" value={assignment.evidence} onChange={(event) => updateTor(index, { evidence: event.target.value })} placeholder="Exact TOR quote or section/page reference" />
            <button className="theme-input rounded-lg px-3" aria-label="Remove TOR requirement" onClick={() => setTorAssignments((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button>
            {assignment.reviewStatus && <span className="sm:col-span-4 text-xs text-slate-500">Current annotation status: {assignment.reviewStatus}</span>}
          </div>)}
          {canReviewTors && <div className="flex flex-wrap gap-2">
            <button disabled={!selectedTor || !tags.length} onClick={() => setTorAssignments((current) => [...current, { tagId: '', requirementLevel: 'required', evidence: '' }])} className="theme-input inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50"><Plus className="h-4 w-4" />Add requirement</button>
            <button disabled={!selectedTor || savingTor} onClick={() => void saveTor()} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{savingTor ? 'Saving…' : 'Save and approve TOR tags'}</button>
          </div>}
          <p className="text-xs text-slate-500">Showing up to the latest 100 announcements. Search and confirm the source document before approving a tag; free-text tags are not created from TOR wording.</p>
        </>
      </section>}

      {isAdmin && <section className={cardClass}>
        <h2 className="font-semibold text-slate-900 dark:text-white">Controlled tag catalog</h2>
        <p className="text-xs text-slate-500">Create a reusable tag only when an existing catalog tag does not accurately represent the capability or requirement.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_190px_auto]">
          <input className={inputClass} value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Tag name" />
          <select className={inputClass} value={tagCategory} onChange={(event) => setTagCategory(event.target.value)}>{['technology', 'skill', 'certification', 'industry', 'project_type', 'capability', 'requirement'].map((category) => <option key={category} value={category}>{category.replace('_', ' ')}</option>)}</select>
          <button disabled={!tagName.trim()} onClick={() => void addTag()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Create tag</button>
        </div>
      </section>}

      {canReviewTors && <button onClick={() => void load()} className="theme-input inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Refresh tags and TORs</button>}
    </div>
  );
}
