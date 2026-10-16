'use client';

import { useLanguage } from '@/lib/LanguageProvider';
import type { CompanyCatalogTag } from '@/types';

export function ContractorServices({ tags, onRemove }: {
  tags: CompanyCatalogTag[];
  onRemove?: (tagId: string) => void;
}) {
  const { t } = useLanguage();
  return <section className="space-y-3">
    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('Contractor services')}</h3>
    {tags.length ? <ul className="flex flex-wrap gap-2">
      {tags.map(tag => <li key={tag.tagId} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm">
        <span>{tag.contractorLabel || t('Contractor label unavailable')}</span>
        {onRemove && <button type="button" onClick={() => onRemove(tag.tagId)} aria-label={`${t('Remove contractor service')}: ${tag.contractorLabel || t('Contractor label unavailable')}`} className="text-slate-500 hover:text-rose-600">×</button>}
      </li>)}
    </ul> : <p className="text-sm text-slate-500">{t('No contractor services selected.')}</p>}
  </section>;
}
