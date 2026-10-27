'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SoftwareHouseProfile } from '@/types';
import { useLanguage } from '@/lib/LanguageProvider';
import { getTorEvaluation, EvaluationResult } from '@/lib/torEvaluationApi';

export function AIEvaluationPanel({ projectId, currentUser }: { projectId: string; currentUser?: SoftwareHouseProfile | null }) {
  const { t } = useLanguage();
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const profileKey = JSON.stringify([currentUser?.companyId, currentUser?.description, currentUser?.qualifications,
    currentUser?.certifications, currentUser?.tags, currentUser?.companySize, currentUser?.district]);
  useEffect(() => {
    setResult(null); setError('');
    if (!currentUser?.companyId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (initial = false) => {
      try {
        let next = await getTorEvaluation(projectId, false, controller.signal);
        if (next.status === 'missing' || (initial && retry > 0 && next.status === 'failed')) {
          next = await getTorEvaluation(projectId, true, controller.signal);
        }
        if (controller.signal.aborted) return;
        setResult(next);
        if (next.status === 'processing') timer = setTimeout(() => { void poll(); }, 2500);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The AI evaluation could not be loaded.');
      }
    };
    void poll(true);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [projectId, profileKey, retry]);

  if (!currentUser?.companyId) return <p className="theme-card rounded-xl p-6 text-sm">{t('Log in with a company profile to request an AI evaluation.')}</p>;
  if (result?.status === 'insufficient_data') return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
    <h2 className="font-semibold">{t('Not enough data for AI evaluation')}</h2>
    <p className="mt-2">{t('Add company profile details and provide extracted TOR document text before requesting an evaluation.')}</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">{result.missingInformation?.map(item => <li key={item}>{t(item)}</li>)}</ul>
    <button onClick={() => setRetry(value => value + 1)} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-semibold"><RefreshCw className="h-4 w-4" />{t('Check again')}</button>
  </div>;
  const failure = error || (result?.status === 'failed' ? result.error?.message || 'The AI evaluation failed. Please retry.' : '');
  if (failure) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
    <p>{t(failure)}</p><button onClick={() => setRetry(value => value + 1)} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-semibold"><RefreshCw className="h-4 w-4" />{t('Retry')}</button>
  </div>;
  if (!result?.evaluation) return <div role="status" aria-live="polite" className="theme-card flex items-center gap-3 rounded-xl p-6 text-sm">
    <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
    <div><p className="font-semibold">{t('Evaluating this TOR against your company profile…')}</p>
      <p className="mt-1 text-slate-500">{t('This may take a few minutes. The result will be saved for later visits.')}</p></div>
  </div>;
  const value = result.evaluation;
  const score = (number: number | null) => number == null ? t('Not available') : `${number}%`;
  return <section className="theme-card space-y-5 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
    <header className="space-y-2"><h2 className="text-lg font-bold">{t('AI Evaluation Analysis')}</h2>
      <p className="text-xs text-slate-500">{t('Model:')} {value.aiModel} · {t('Evaluated:')} {new Date(value.evaluatedAt).toLocaleString()}</p>
      <p className="text-sm whitespace-pre-wrap">{value.summary}</p></header>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><h3 className="text-sm font-semibold">{t('Company qualification match')}</h3>
        <strong className="my-2 block text-2xl text-sky-700 dark:text-sky-300">{score(value.qualificationMatchScore)}</strong>
        <p className="text-sm whitespace-pre-wrap">{value.qualificationAnalysis}</p></div>
      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><h3 className="text-sm font-semibold">{t('Price & Budget Assessment')}</h3>
        <strong className="my-2 block text-2xl">{score(value.priceScore)}</strong><p className="text-sm whitespace-pre-wrap">{value.priceAssessment}</p></div>
    </div>
    <div><h3 className="text-sm font-semibold">{t('Risk & Compliance Level')}: {t(value.riskLevel)}</h3><p className="mt-2 text-sm whitespace-pre-wrap">{value.riskAnalysis}</p></div>
    {([['Key requirements', value.keyRequirementsExtracted], ['Strengths', value.strengths], ['Gaps', value.gaps], ['Missing information', value.missingInformation]] as const)
      .map(([label, items]) => items.length > 0 && <div key={label}><h3 className="text-sm font-semibold">{t(label)}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}
    <p className="text-xs text-slate-500">{t('AI assessment uses the available documents and self-reported company information.')}</p>
  </section>;
}
