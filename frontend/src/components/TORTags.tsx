'use client';

import { TORContract } from '@/types';
import { useLanguage } from '@/lib/LanguageProvider';
import { Check } from 'lucide-react';

export function TORTags({ contract, matchedTagIds = [] }: { contract: TORContract; matchedTagIds?: string[] }) {
  const { t } = useLanguage();
  const matches = new Set(matchedTagIds.map(id => id.toLowerCase()));
  return (
    <div className="mb-3" aria-label={t('Tags')}>
      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t('Tags')}</span>
      {contract.tags?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {contract.tags.map(tag => {
            const matched = matches.has(tag.id.toLowerCase());
            return <span key={tag.id}
              title={matched ? t('Matched') : undefined}
              className={`inline-flex max-w-full items-center gap-1 break-words rounded-full border px-2.5 py-1 text-xs font-medium ${matched
                ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200'}`}>
              {matched && <><Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">{t('Matched')}: </span></>}
              {tag.text}
            </span>;
          })}
        </div>
      ) : <span className="text-xs text-slate-400">{t('No tags available')}</span>}
    </div>
  );
}
