import { FilterState } from '@/types';
export const DEFAULT_FILTERS: FilterState = { searchQuery: '', department: '', status: '', procurementMethod: '',
  datePreset: '', fromDate: '', toDate: '', stageScope: 'latest', sort: 'latest' };
export const STAGE_LABELS: Record<string, string> = {
  P0: "Procurement Plan",
  '15': "Reference Price",
  B0: "Draft TOR",
  D0: "Invitation to Bid",
  W0: "Winner Awarded",
  D1: "Invitation Cancelled",
  W1: "Award Cancelled",
  D2: "Invitation Amended",
  W2: "Award Amended"
};
export function dateRange(preset: string, now = new Date()) {
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  if (!['7', '30', '90'].includes(preset)) return { fromDate: '', toDate: '' };
  const start = new Date(today + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - Number(preset) + 1);
  return { fromDate: start.toISOString().slice(0, 10), toDate: today };
}
