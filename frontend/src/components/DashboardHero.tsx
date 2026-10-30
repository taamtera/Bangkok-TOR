'use client';
import { useLanguage } from '@/lib/LanguageProvider';


import React from 'react';
import {
  Cpu,
  FileCheck,
  TrendingUp,
  Bot
} from 'lucide-react';

interface DashboardHeroProps {
  totalTORs: number;
  totalBudgetFormatted: string;
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  totalTORs,
  totalBudgetFormatted
}) => {
  const { t } = useLanguage();
  return (
    <div className="relative overflow-hidden rounded-xl theme-card p-5 md:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

        {/* Banner Left Info */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-ping" />
            <Bot className="w-3.5 h-3.5" />
            <span>{t("Vertex AI Engine Active • Thailand TOR Aggregator")}</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-3">{t("Dash board")} <span className="text-slate-600 dark:text-slate-400">{t("TOR Software")}</span>
          </h1>

          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed mb-6">{t("Discover and assess government TOR projects across Thailand for software companies and freelancers.")} </p>
        </div>

        {/* Live Metrics Cards */}
        <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Active TORs")}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{totalTORs} <span className="text-xs font-normal text-slate-500">{t("contracts")}</span></p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Total Value")}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{t(totalBudgetFormatted)}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3 col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Vertex AI Match")}</p>
                <span title={t('Placeholder data — no live source yet')} className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-300 border border-slate-300/60 dark:border-slate-600/60">{t('Demo')}</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">98.4% <span className="text-xs font-normal text-slate-500">{t("accuracy")}</span></p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
