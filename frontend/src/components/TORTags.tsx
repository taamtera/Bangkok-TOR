'use client';

import { TORContract } from '@/types';
import { useLanguage } from '@/lib/LanguageProvider';

export function TORTags({ contract }: { contract: TORContract }) {
  const { t } = useLanguage();
  return (
    <div className="mb-3" aria-label={t('Tags')}>
      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{t('Tags')}</span>
      {contract.tags?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {contract.tags.map(tag => <span key={tag.id} className="max-w-full break-words rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">{tag.text}</span>)}
        </div>
      ) : <span className="text-xs text-slate-400">{t('No tags available')}</span>}
    </div>
  );
}
