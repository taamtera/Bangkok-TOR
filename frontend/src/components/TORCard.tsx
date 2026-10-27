'use client';
import { procurementMethodLabel } from '@/lib/translate';
import { useLanguage } from '@/lib/LanguageProvider';


import React from 'react';
import { TORContract } from '@/types';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { PDFThumbnail } from './PDFThumbnail';
import { TORTags } from './TORTags';
import { getStatusClasses, getStatusLabel, getProjectStatus } from '@/lib/torPresentation';

interface TORCardProps {
  contract: TORContract;
  onSelect: (contract: TORContract) => void;
}

export const TORCard: React.FC<TORCardProps> = ({ contract, onSelect }) => {
  const { t, language } = useLanguage();
  return (
    <div 
      role="button"
      tabIndex={0}
      aria-label={`${t('View project and document')}: ${contract.title}`}
      onClick={() => onSelect(contract)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect(contract);
        }
      }}
      className="theme-card rounded-lg p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer transition-all duration-200 group flex flex-col lg:flex-row gap-4 items-stretch shadow-sm"
    >
      {/* PDF Document Preview / Thumbnail Section */}
      <div className="w-full lg:w-48 h-36 lg:h-auto shrink-0">
        <PDFThumbnail contract={contract} className="w-full h-full min-h-[145px]" />
      </div>

      {/* Contract Core Info Section */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {procurementMethodLabel(contract.category, language)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">{t("Status:")} <span className={`px-2 py-0.5 rounded-md border font-semibold ${getStatusClasses(getProjectStatus(contract))}`}>
                {t(getStatusLabel(getProjectStatus(contract)))}
              </span>
            </span>
          </div>

          <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors line-clamp-2 leading-snug mb-2">
            {contract.title}
          </h3>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 dark:text-slate-300 mb-3">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[240px] font-medium">{contract.departmentName || contract.contractOwner}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{t("Published:")} {contract.statusPublishedAt || contract.publishedAt || contract.postingDate}</span>
            </div>
          </div>
          <TORTags contract={contract} />
        </div>

        {/* Price Tag */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-medium text-slate-400 block uppercase">{t("Project budget:")}</span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{t(contract.priceFormatted)}</span>
          </div>
          
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-1 transition-all">
            <span>{t('View project and document')}</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Right Section: คุณสมบัติ */}
      {contract.properties.length > 0 && <div className="w-full lg:w-64 shrink-0 bg-slate-50 dark:bg-slate-950/80 p-3 rounded-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>{t("Requirements")}</span>
            </span>

          </div>

          <div className="space-y-1.5">
            {contract.properties.slice(0, 3).map((prop, idx) => (
              <div key={prop.id || idx} className="flex items-start gap-2 text-xs">
                {prop.fulfilledBySoftwareHouse ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                )}
                <span className={`line-clamp-2 ${prop.fulfilledBySoftwareHouse ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  {prop.property}
                </span>
              </div>
            ))}
            {contract.properties.length > 3 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium italic pl-5">
                +{contract.properties.length - 3}{t("more requirements...")} </p>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">{t("TOR status:")}</span>
          <span className={`px-2 py-0.5 rounded-md border font-semibold ${getStatusClasses(getProjectStatus(contract))}`}>
            {t(getStatusLabel(getProjectStatus(contract)))}
          </span>
        </div>
      </div>}

    </div>
  );
};
