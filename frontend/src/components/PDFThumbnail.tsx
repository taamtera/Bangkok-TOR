'use client';
import { useLanguage } from '@/lib/LanguageProvider';


import React, { useEffect, useState } from 'react';
import { TORContract } from '@/types';
import { resolveApiUrl } from '@/lib/api';
import { ExternalLink, Sparkles } from 'lucide-react';

interface PDFThumbnailProps {
  contract: TORContract;
  className?: string;
}

export const PDFThumbnail: React.FC<PDFThumbnailProps> = ({ contract, className = '' }) => {
  const { t } = useLanguage();
  const [imageError, setImageError] = useState(false);
  const [revision, setRevision] = useState(0);
  const endpoint = resolveApiUrl(`/api/thumbnail/${encodeURIComponent(contract.projectId)}`);
  const thumbnailUrl = endpoint ? `${endpoint}?revision=${revision}&document=${encodeURIComponent(contract.documentUrl ?? '')}` : null;
  useEffect(() => {
    setImageError(false);
    const timer = setInterval(() => {
      setRevision(value => value + 1);
      setImageError(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [contract.projectId, contract.documentUrl]);

  // Render the document thumbnail when available.
  if (thumbnailUrl && !imageError) {
    return (
      <div className={`relative overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group/thumb ${className}`}>
        <img
          src={thumbnailUrl}
          alt={contract.title}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
        />
        {contract.matchedScore && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-sky-600 text-white rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" />
            <span>{contract.matchedScore}% {t("Match")}</span>
          </div>
        )}
      </div>
    );
  }

  // Otherwise, render a realistic official Government PDF Document 1st-Page Sheet Preview
  return (
    <div className={`relative overflow-hidden rounded-md bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 flex flex-col justify-between select-none group/thumb shadow-sm ${className}`}>
      <div className="flex items-center justify-end gap-1 mb-1.5">
        <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
          {(contract.departmentName || contract.contractOwner || 'e-GP').split(' ')[0]}
        </span>
      </div>

      {/* Simulated Document Sheet / First Page Layout */}
      <div className="bg-white dark:bg-slate-900/90 rounded border border-slate-200/80 dark:border-slate-800 p-2 flex-1 flex flex-col justify-between shadow-xs">
        <div>
          {/* Emblem simulation */}
          <div className="w-5 h-5 mx-auto mb-1 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[8px] font-serif text-slate-500 dark:text-slate-400">{t("Official document")} </div>
          <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200 text-center line-clamp-2 leading-tight mb-1">
            {contract.title}
          </div>
          {/* Simulated text lines */}
          <div className="space-y-1 my-1 opacity-60">
            <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
            <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded w-4/5"></div>
            <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="truncate">{contract.category?.split(' ')[0] || 'e-Bidding'}</span>
          <span className="font-mono text-sky-600 dark:text-sky-400 flex items-center gap-0.5 group-hover/thumb:underline">
            <span>{t("Read PDF")}</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>

      {/* Bottom match score badge if present */}
      {contract.matchedScore && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-sky-600 text-white rounded text-[9px] font-extrabold flex items-center gap-1 shadow-sm">
          <Sparkles className="w-2.5 h-2.5" />
          <span>{contract.matchedScore}%</span>
        </div>
      )}
    </div>
  );
};
