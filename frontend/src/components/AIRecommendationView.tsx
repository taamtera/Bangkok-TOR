'use client';

import { Bot } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageProvider';
import type { RecommendationItem, RecommendationResponse } from '@/lib/aiRecommendationApi';

const SUITABILITY = { suitable: 'Suitable', needs_review: 'Needs review', not_suitable: 'Not suitable' };

export function AIRecommendationView({ recommendations, status, isLoading, error, onViewMatches, onSelectProject }: {
  recommendations: RecommendationItem[];
  status: RecommendationResponse['status'];
  isLoading: boolean;
  error: string | null;
  onViewMatches: () => void;
  onSelectProject: (projectId: string) => void;
}) {
  const { t } = useLanguage();
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-bold">{t('AI recommendations')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('AI evaluates your profile, project details, and matching results to explain which projects are suitable.')}</p></header>
    {isLoading && <p role="status" className="theme-card rounded-xl p-6">{t('Loading AI recommendations…')}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    {!isLoading && !error && status !== 'ready' && <section className="theme-card rounded-xl border border-slate-200 p-8 dark:border-slate-800">
      <Bot className="mb-3 h-8 w-8 text-sky-600" />
      <h2 className="font-semibold">{t(status === 'pending' ? 'AI evaluation is in progress' : 'AI recommendations are not available yet')}</h2>
      <p className="mt-2 text-sm text-slate-500">{t('You can view your company’s requirement matches now.')}</p>
      <button onClick={onViewMatches} className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">{t('View matching results')}</button>
    </section>}
    {!isLoading && !error && status === 'ready' && recommendations.length === 0 && <p className="theme-card rounded-xl p-6">{t('No AI recommendations are available for your company yet.')}</p>}
    {!isLoading && !error && status === 'ready' && recommendations.map((item) => <article key={`${item.projectId}-${item.torVersion}`} className="theme-card space-y-3 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{item.title}</h2><span className="rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-900">{t(SUITABILITY[item.suitability])}</span></div>
      {item.dataMode === 'demo' && <p className="text-sm text-amber-800 dark:text-amber-200">{t('Demo requirements')}</p>}
      <p>{item.summary}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">{item.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
      {item.risks.length > 0 && <div><h3 className="font-semibold">{t('Points to consider')}</h3><ul className="list-disc space-y-1 pl-5 text-sm">{item.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul></div>}
      <button onClick={() => onSelectProject(item.projectId)} className="theme-input rounded-lg px-3 py-2 text-sm">{t('View project and document')}</button>
    </article>)}
  </div>;
}
