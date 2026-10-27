'use client';
import { useLanguage } from '@/lib/LanguageProvider';

import React, { useState } from 'react';
import { FilterState } from '@/types';
import { DiscoveryFacets } from '@/lib/torApi';
import { STAGE_LABELS } from '@/lib/discovery';
import { ANNOUNCEMENT_STAGE_CODES } from '@/lib/torPresentation';
import { RefreshCw, Search, X } from 'lucide-react';
interface Props {
 filters: FilterState; setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
 onResetFilters: () => void; resultCount: number; departments: DiscoveryFacets['departments'];
 methods: DiscoveryFacets['methods']; onRefresh: () => void; isLoading: boolean;
}
export function FilterBar({filters, setFilters, onResetFilters, departments, methods, onRefresh, isLoading}: Props) {
  const { t, language } = useLanguage();
 const [open, setOpen] = useState(false);
 const [departmentSearch, setDepartmentSearch] = useState('');
 const update = (key: keyof FilterState, value: string) => setFilters(prev => ({...prev, [key]: value}));
 const label = (entry: DiscoveryFacets['departments'][number]) => entry.value === '__unknown__' ? t("Unspecified department") : `${entry.name || t("Unknown department name")} (${entry.value})`;
 const selected = departments.find(entry => entry.value === filters.department);
 const control = 'theme-input w-full rounded-xl px-3 py-2.5 text-sm min-h-11';
 const formatMethod = (val: string) => {
   if (val === '__unknown__') return t("Unspecified method");
   if (val === 'เฉพาะเจาะจง') return t("Specific Selection");
   if (val === 'คัดเลือก') return t("Selective");
   if (val === 'สอบราคา') return t("Price Inquiry");
   if (val === 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)') return t('Electronic bidding (e-bidding)');
   if (val === 'จ้างที่ปรึกษาโดยวิธีประกาศเชิญชวนทั่วไป') return t('General invitation for consulting services');
   return val;
 };
 const chips: Array<{key: keyof FilterState; label: string}> = [];
 if(filters.searchQuery) chips.push({key: 'searchQuery', label: filters.searchQuery});
 if(filters.department) chips.push({key: 'department', label: selected ? label(selected) : filters.department});
 if(filters.status) chips.push({key: 'status', label: t(STAGE_LABELS[filters.status] || filters.status)});
 if(filters.procurementMethod) chips.push({key: 'procurementMethod', label: formatMethod(filters.procurementMethod)});
 if(filters.datePreset) chips.push({key: 'datePreset', label: filters.datePreset === 'custom' ? `${filters.fromDate || t("From")} – ${filters.toDate || t("To")}` : t(`Last ${filters.datePreset} Days`)});
 if(filters.stageScope === 'retained') chips.push({key: 'stageScope', label: t("Retained stages")});
 return <section aria-label={t("Search and filter projects")} className="theme-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5 shadow-sm">
 <div className="flex flex-col sm:flex-row gap-3">
  <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
  <input aria-label={t("Search projects")} maxLength={160} placeholder={t("Project Name, Dept, or ID")} value={filters.searchQuery} onChange={e => setFilters(prev => ({...prev, searchQuery: e.target.value, sort: e.target.value.trim() ? 'relevance' : 'latest'}))} className={`${control} pl-10`} /></div>
  <button onClick={onRefresh} disabled={isLoading} className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-sky-600 text-white text-sm font-semibold disabled:opacity-60 shrink-0"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />{t("Refresh")}</button>
 </div>
 <p className="text-xs text-slate-500 !mt-2">{t("Separate keywords with spaces to search across title, details, department, and project ID")}</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
  <div className="relative"><label id="department-label" className="block text-xs font-medium text-slate-500 mb-2">{t("Department")}</label>
   <button aria-labelledby="department-label" aria-expanded={open} onClick={() => setOpen(!open)} className={`${control} text-left truncate`}>{selected ? label(selected) : t("All Departments")}</button>
   {open && <><button aria-label={t("Close department selection")} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} /><div className="absolute z-20 top-full mt-2 w-full sm:w-80 max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2" onKeyDown={e => {if(e.key === 'Escape') setOpen(false);}}>
    <input autoFocus aria-label={t("Search department")} placeholder={t("Search name or code")} value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} className={`${control} mb-2`} />
    <div className="max-h-64 overflow-y-auto"><button className="w-full text-left p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded" onClick={() => {update('department',''); setOpen(false);}}>{t("All Departments")}</button>
    {[...departments].sort((a,b) => label(a).localeCompare(label(b),language)).filter(entry => label(entry).toLowerCase().includes(departmentSearch.trim().toLowerCase())).map(entry => <button key={entry.value} className="block w-full text-left p-2 text-sm hover:bg-sky-50 dark:hover:bg-slate-800 rounded" onClick={() => {update('department',entry.value); setOpen(false); setDepartmentSearch('');}}>{label(entry)} <span className="text-slate-400">· {entry.count}</span></button>)}</div><p className="text-xs text-slate-500 p-2">{t("Total project count per department")}</p>
   </div></>}
  </div>
  <div><label htmlFor="stage" className="block text-xs font-medium text-slate-500 mb-2">{t("Announcement Stage")}</label><select id="stage" className={control} value={filters.status} onChange={e => update('status',e.target.value)}><option value="">{t("All Stages")}</option>{ANNOUNCEMENT_STAGE_CODES.map(code => <option key={code} value={code}>{t(STAGE_LABELS[code])}</option>)}</select></div>
  <div><label htmlFor="method" className="block text-xs font-medium text-slate-500 mb-2">{t("Procurement Method")}</label><select id="method" className={control} value={filters.procurementMethod} onChange={e => update('procurementMethod',e.target.value)}><option value="">{t("All Methods")}</option>{[...methods].sort((a,b) => b.count-a.count).map(entry => <option key={entry.value} value={entry.value}>{formatMethod(entry.value)} ({entry.count})</option>)}</select></div>
  <div><label htmlFor="dates" className="block text-xs font-medium text-slate-500 mb-2">{t("Published Date")}</label><select id="dates" className={control} value={filters.datePreset} onChange={e => setFilters(prev => ({...prev,datePreset:e.target.value,fromDate:'',toDate:''}))}><option value="">{t("All Time")}</option>{['7', '30', '90'].map(days => <option key={days} value={days}>{t(`Last ${days} Days`)}</option>)}<option value="custom">{t("Custom Date Range")}</option></select></div>
 </div>
 {filters.datePreset === 'custom' && <div className="grid sm:grid-cols-2 gap-4 max-w-xl"><label className="text-xs text-slate-500">{t("From")}<input type="date" className={`${control} mt-2`} value={filters.fromDate} max={filters.toDate || undefined} onChange={e => update('fromDate',e.target.value)} /></label><label className="text-xs text-slate-500">{t("To")}<input type="date" className={`${control} mt-2`} value={filters.toDate} min={filters.fromDate || undefined} onChange={e => update('toDate',e.target.value)} /></label></div>}
 <div className="flex flex-col sm:flex-row justify-between gap-3 text-xs text-slate-500"><label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" className="mt-0.5" checked={filters.stageScope === 'retained'} onChange={e => update('stageScope',e.target.checked ? 'retained':'latest')} /><span>{t("Include retained stages (latest announcement of each stage)")}</span></label>{chips.length > 0 && <button onClick={onResetFilters} className="text-sky-600 font-semibold text-left shrink-0">{t("Clear All Filters")}</button>}</div>
 {chips.length > 0 && <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">{chips.map(chip => <button key={chip.key} aria-label={`${t('Remove filter')} ${chip.label}`} onClick={() => setFilters(prev => ({...prev,[chip.key]:chip.key === 'stageScope' ? 'latest':'',...(chip.key === 'searchQuery' ? {sort:'latest' as const}:{})}))} className="inline-flex items-center gap-2 text-xs rounded-full px-3 py-2 bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 max-w-full"><span className="truncate">{chip.label}</span><X className="w-3 h-3 shrink-0" /></button>)}</div>}
 </section>;
}
