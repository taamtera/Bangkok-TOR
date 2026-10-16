'use client';

import { useLanguage } from '@/lib/LanguageProvider';
import { TORContract } from '@/types';
import { getLatestStageCodes, getAnnouncementStage, getStatusClasses, STAGE_STATUS } from '@/lib/torPresentation';

export function ProjectStages({ project }: { project: TORContract }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-2 text-xs" aria-label={t("Latest announcement stages")}>
      {getLatestStageCodes(project).map(code => (
        <span key={code} className={`rounded border px-2 py-1 ${getStatusClasses(STAGE_STATUS[code])}`}>
          {t(getAnnouncementStage(code))}
        </span>
      ))}
      {/* Same-day announcements can be published together, e.g. reference price
          and invitation. Show each observed stage without an ordering warning. */}
    </div>
  );
}
