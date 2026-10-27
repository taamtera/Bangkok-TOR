'use client';
import { procurementMethodLabel } from '@/lib/translate';
import { useLanguage } from '@/lib/LanguageProvider';


import React, { useEffect, useRef, useState } from 'react';
import { TORContract } from '@/types';
import { DocumentPreview } from './PDFReader';
import { ProjectObservations } from './ProjectObservations';
import { TORTags } from './TORTags';
import { getStatusClasses, getStatusLabel, getProjectStatus } from '@/lib/torPresentation';
import { 
  X, 
  Download, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  FileText, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle,
  BrainCircuit
} from 'lucide-react';

interface TORDetailModalProps {
  contract: TORContract | null;
  onClose: () => void;
  onDownloadPDF: (contract: TORContract) => void;
}

export const TORDetailModal: React.FC<TORDetailModalProps> = ({
  contract,
  onClose,
  onDownloadPDF
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'pdf' | 'ai-eval'>('pdf');
  const closeButton = useRef<HTMLButtonElement>(null);
  const projectId = contract?.projectId;

  useEffect(() => {
    if (!projectId) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => previousFocus?.focus();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [projectId, onClose]);

  if (!contract) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden my-8 flex flex-col max-h-[92vh]">
        
        {/* Modal Close Button */}
        <button
          ref={closeButton}
          aria-label={t('Close TOR details')}
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* Top Section matching Desktop - 2 wireframe layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 bg-slate-50 dark:bg-slate-950/60 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
            
            {/* Source metadata and document action */}
            <div className="md:col-span-4 flex flex-col gap-3">
              <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t("Source data")}</h2>
                </div>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">{t("Source")}</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">{contract.sourceId || 'EGP'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">{t("Department ID")}</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">{contract.departmentId || t("Not available")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">{t("Project ID")}</dt>
                    <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200 break-all text-right">{contract.projectId || t("Not available")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">{t("Identity")}</dt>
                    <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200 break-all text-right">{t(contract.identityScope || 'project')}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">{t("Announcement")}</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 text-right">{t(getStatusLabel(getProjectStatus(contract)))}</dd>
                  </div>
                </dl>
              </div>

              <button
                onClick={() => onDownloadPDF(contract)}
                disabled={!contract.documentUrl && !contract.url}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{t('Download document')}</span>
              </button>
            </div>

            {/* Right Details (contract name, owner, dates, price, คุณสมบัติ) */}
            <div className="md:col-span-8 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {procurementMethodLabel(contract.category, language)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">{t("Status:")} <span className={`px-2 py-0.5 rounded-md border font-semibold ${getStatusClasses(getProjectStatus(contract))}`}>
                      {t(getStatusLabel(getProjectStatus(contract)))}
                    </span>
                  </span>
                </div>

                {/* contract name */}
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">
                  {contract.title}
                </h1>

                {/* contract owner name */}
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-3">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>{contract.departmentName || contract.contractOwner}</span>
                </p>

                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {t(getStatusLabel(getProjectStatus(contract)))}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{t("Published:")} {contract.publishedAt || contract.postingDate}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {procurementMethodLabel(typeof contract.procurementMethod === 'string' ? contract.procurementMethod : contract.category, language)}
                  </span>
                </div>

                <TORTags contract={contract} />

                {/* Contract period and project budget */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 mb-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {(contract.startDate || contract.endDate) && <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{t("Contract period:")} <strong className="text-slate-900 dark:text-white">{contract.startDate} - {contract.endDate}</strong></span>
                  </div>}
                  {/* price: 3,000,000 THB */}
                  <div className="ml-auto">
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5">{t("Project budget:")}</span>
                    <strong className="text-lg text-slate-800 dark:text-slate-100 font-extrabold">{t(contract.priceFormatted)}</strong>
                  </div>
                </div>

                {/* คุณสมบัติ (Requirements Checklist) */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span>{t("Requirements checklist")}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {contract.properties.map((prop, idx) => (
                      <div key={prop.id || idx} className="flex items-start gap-2 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                        {prop.fulfilledBySoftwareHouse ? (
                          <CheckCircle2 className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                        )}
                        <span className={prop.fulfilledBySoftwareHouse ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                          {prop.property}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* View Tab Switcher (PDF Reader vs Vertex AI Evaluation) */}
          <ProjectObservations project={contract} />
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('pdf')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'pdf'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{t('Document preview')}</span>
              </button>

              <button
                onClick={() => setActiveTab('ai-eval')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'ai-eval'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BrainCircuit className="w-4 h-4" />
                <span>{t("AI Evaluation")}</span>
              </button>
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden sm:block">{t("Ref:")} {contract.id}
            </span>
          </div>

          {/* Tab Content Display */}
          {activeTab === 'pdf' ? (
            /* pdf reader container */
            <DocumentPreview contract={contract} onDownload={() => onDownloadPDF(contract)} />
          ) : (
            /* Vertex AI Evaluation details */
            <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("AI Evaluation Analysis")}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("Model:")} {t(contract.aiEvaluation.aiModel)}{t("• Evaluated:")} {contract.aiEvaluation.evaluatedAt}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{contract.aiEvaluation.qualificationMatchScore}%</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">{t("Match Confidence")}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>{t("Price & Budget Assessment")}</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    {t(contract.aiEvaluation.priceAssessment)}
                  </p>
                  <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div className="bg-slate-600 h-full rounded-full" style={{ width: `${contract.aiEvaluation.priceScore}%` }} />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>{t("Risk & Compliance Level")}</span>
                  </h4>
                  <div className="inline-block px-2.5 py-0.5 rounded text-xs font-bold mb-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    {t(contract.aiEvaluation.riskLevel)}{t("Risk")} </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t(contract.aiEvaluation.riskAnalysis)}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
