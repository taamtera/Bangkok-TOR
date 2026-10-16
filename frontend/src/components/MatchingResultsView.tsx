'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { SoftwareHouseProfile, TORContract } from '@/types';
import { useLanguage } from '@/lib/LanguageProvider';
import { getMatches, MatchingResponse } from '@/lib/matchingApi';
import { TORCard } from './TORCard';

const STATUS_LABEL = { met: 'Matched', partial: 'Partly matched', missing: 'Missing', informational: 'For information', unassessed: 'Needs interpretation' };
const STATUS_STYLE = { met: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  partial: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  missing: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  informational: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  unassessed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };

export function MatchingResultsView({ currentUser, onSelectContract, onEditProfile, onViewRecommendations }: {
  currentUser: SoftwareHouseProfile;
  onSelectContract: (contract: TORContract) => void;
  onEditProfile: () => void;
  onViewRecommendations: () => void;
}) {
  const { t } = useLanguage();
  const [result, setResult] = useState<MatchingResponse | null>(null);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Profile changes and returning to this tab recalculate from saved values.
  const profileKey = JSON.stringify([currentUser.id, currentUser.technologies, currentUser.properties]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    getMatches(page, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult(data);
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Matches could not be loaded.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [profileKey, page, refreshKey]);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold">{t('Matching results')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('Compare your saved company profile with each project’s requirements.')}</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onEditProfile} className="theme-input rounded-lg px-3 py-2 text-sm">{t('Edit company profile')}</button>
        <button onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="theme-input rounded-lg px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="mr-2 inline h-4 w-4" />{t('Refresh matches')}</button>
      </div>
    </header>
    {loading && <p role="status" className="theme-card rounded-xl p-6">{t('Comparing requirements…')}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    {!loading && !error && result?.items.length === 0 && <div className="theme-card rounded-xl border p-6">
      <p>{t('No project requirements are available to compare yet. Your company profile is saved.')}</p>
    </div>}
    {!loading && !error && result?.items.map((item) => <article key={item.tor.projectId} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {item.dataMode === 'demo' && <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">{t('Demo requirements')}</span>}
        <strong className="rounded-full bg-sky-100 px-3 py-1 text-sky-900">{item.score}% {t('requirement coverage')}</strong>
        <span>{item.counts.met} {t('matched')} · {item.counts.partial} {t('partly matched')} · {item.counts.missing} {t('missing')}</span>
      </div>
      {item.dataMode === 'demo' ? <div className="theme-card rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <h2 className="text-lg font-semibold">{item.contract.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{item.tor.projectId} · {item.contract.departmentName}</p>
      </div> : <TORCard contract={item.contract} onSelect={onSelectContract} />}
      <section className="theme-card space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('Coverage compares the wording of your profile and the requirements. Self-reported capabilities are not independently verified.')}</p>
        {item.dataMode === 'demo' && <p className="text-sm text-amber-800 dark:text-amber-200">{t('These requirements are examples for testing and are not official tender requirements.')}</p>}
        <div className="space-y-3">{item.requirementMatches.map((requirement) => <div key={requirement.requirementId} className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{requirement.requirementText}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[requirement.status]}`}>{t(STATUS_LABEL[requirement.status])}</span></div>
          <p className="mt-1 text-xs text-slate-500">{t(requirement.requirementLevel)}</p>
          <ul className="mt-3 space-y-2">{requirement.components.map((component, index) => <li key={index}>
            <span className="font-medium">{component.label}</span>: {t(STATUS_LABEL[component.status])}
            {component.companyCapability && <p className="mt-1 text-slate-600 dark:text-slate-300">{t('Your profile')}: {component.companyCapability.text} <span className="text-xs">({t(component.companyCapability.verificationLevel)})</span></p>}
          </li>)}</ul>
          {requirement.requirementSourceUrl && <a className="mt-2 inline-block text-sky-700 underline dark:text-sky-300" href={requirement.requirementSourceUrl} target="_blank" rel="noreferrer">{t('Open cited TOR source')}</a>}
        </div>)}</div>
      </section>
    </article>)}
    {result && result.pagination.totalPages > 1 && <nav aria-label={t('Matching pages')} className="flex items-center justify-center gap-4">
      <button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="theme-input rounded-lg px-3 py-2 disabled:opacity-50">{t('Previous')}</button>
      <span>{page} / {result.pagination.totalPages}</span>
      <button disabled={loading || page >= result.pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="theme-input rounded-lg px-3 py-2 disabled:opacity-50">{t('Next')}</button>
    </nav>}
    <button onClick={onViewRecommendations} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">{t('View AI recommendations')}</button>
  </div>;
}
