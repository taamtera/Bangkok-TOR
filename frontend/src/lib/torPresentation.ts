import { TORContract, StageCode } from '@/types';

export const STAGE_STATUS: Record<StageCode, string> = {
  P0: 'procurement_planned', '15': 'reference_price_published', B0: 'draft_tender_published',
  D0: 'invitation_published', W0: 'award_published', D1: 'invitation_cancelled',
  W1: 'award_cancelled', D2: 'invitation_amended', W2: 'award_amended'
};
// Explicit order matches the stage filter; numeric object keys would put '15' first.
export const ANNOUNCEMENT_STAGE_CODES: StageCode[] = ['P0', '15', 'B0', 'D0', 'W0', 'D1', 'W1', 'D2', 'W2'];
const LABELS: Record<string, string> = {
  procurement_planned: 'Procurement Plan', reference_price_published: 'Reference Price Published',
  draft_tender_published: 'Draft Tender Published', invitation_published: 'Invitation Published',
  award_published: 'Award Published', invitation_cancelled: 'Invitation Cancelled',
  award_cancelled: 'Award Cancelled', invitation_amended: 'Invitation Amended',
  award_amended: 'Award Amended',
  unknown: 'Stage unavailable'
};
export function getAnnouncementStage(code: string) {
  return getStatusLabel(STAGE_STATUS[code as StageCode] ?? code);
}
export function getStageCode(status?: string | null) {
  return ANNOUNCEMENT_STAGE_CODES.find(code => STAGE_STATUS[code] === status) ?? '';
}
export function getStatusLabel(status?: string | null) {
  if (status === 'multiple_announcements_same_day') return LABELS.unknown;
  return LABELS[status ?? 'unknown'] ?? status ?? LABELS.unknown;
}
export function getLatestStageCodes(project: TORContract): StageCode[] {
  const observations = project.stageObservations ?? {};
  const latestDate = project.statusPublishedAt ?? Object.values(observations)
    .map(observation => observation?.publishedAt ?? '').sort().at(-1);
  const codes = latestDate ? ANNOUNCEMENT_STAGE_CODES.filter(code => observations[code]?.publishedAt === latestDate) : [];
  const statusCode = getStageCode(project.status) as StageCode;
  return codes.length ? codes.slice(-1) : statusCode ? [statusCode] : [];
}
export function getProjectStatus(project: TORContract) {
  const code = getLatestStageCodes(project)[0];
  return code ? STAGE_STATUS[code] : 'unknown';
}
export function matchesStage(project: TORContract, stage: string) {
  return getLatestStageCodes(project).includes(stage as StageCode);
}
export function getStatusClasses(status?: string | null) {
  const code = getStageCode(status);
  const color = ['D1', 'W1'].includes(code) ? 'rose' : ['W0', 'W2'].includes(code) ? 'sky'
    : ['D0', 'D2'].includes(code) ? 'emerald' : ['P0', '15', 'B0'].includes(code) ? 'amber' : 'slate';
  const classes: Record<string, string> = {
    rose: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    sky: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    amber: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  };
  return classes[color];
}
