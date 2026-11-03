'use client';
import { useLanguage } from '@/lib/LanguageProvider';


import React from 'react';
import {
  Target,
  Zap,
  PieChart,
  Users,
  DollarSign,
  Gavel,
  Layers,
  Rss
} from 'lucide-react';
import type { TORContract } from '@/types';
import type { DashboardStats as DashboardStatsData } from '@/lib/dashboardApi';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext, color = 'sky' }) => {
  const colorClasses = {
    sky: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
  };
  return (
    <div className={`rounded-xl border p-5 backdrop-blur-sm transition-all hover:shadow-md ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tabular-nums">{value}</p>
      {subtext && <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>}
    </div>
  );
};

function procurementMethodName(contract: TORContract): string {
  const method = contract.procurementMethod;
  if (typeof method === 'string' && method.trim()) return method.trim();
  if (typeof contract.category === 'string' && contract.category.trim()) return contract.category.trim();
  return 'ไม่ระบุวิธี';
}

export const DashboardStats: React.FC<{ contracts: TORContract[]; stats: DashboardStatsData | null }> = ({ contracts, stats }) => {
  const { t } = useLanguage();

  // ----- TOR-derived figures (from /api/tors) -----
  const total = contracts.length;
  const withBudget = contracts.filter((c) => typeof c.price === 'number' && (c.price as number) > 0);
  const totalValue = withBudget.reduce((sum, c) => sum + (c.price ?? 0), 0);
  const totalValueM = `฿${(totalValue / 1_000_000).toFixed(1)}M`;
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const newThisMonth = contracts.filter((c) => {
    const d = c.publishedAt ? new Date(c.publishedAt) : null;
    return d && !Number.isNaN(d.getTime()) && d >= since;
  }).length;
  const awarded = contracts.filter((c) => typeof c.status === 'string' && c.status.includes('award_published')).length;

  const methodCounts = new Map<string, number>();
  for (const c of contracts) {
    const name = procurementMethodName(c);
    methodCounts.set(name, (methodCounts.get(name) ?? 0) + 1);
  }
  const methodsSorted = [...methodCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topMethod = methodsSorted[0];
  const topMethodValue = topMethod
    ? withBudget.filter((c) => procurementMethodName(c) === topMethod[0]).reduce((s, c) => s + (c.price ?? 0), 0)
    : 0;
  const distribution = methodsSorted.slice(0, 4).map(([name, count], i) => ({
    name,
    value: total ? Math.round((count / total) * 100) : 0,
    bar: ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500'][i] ?? 'bg-slate-400'
  }));

  // ----- Live DB figures (from /api/dashboard/stats) -----
  const demand = stats?.topDemand ?? [];
  const demandMax = demand.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  const n = (v: number | undefined) => (v === undefined ? '—' : v.toLocaleString());

  const cards: StatCardProps[] = [
    { icon: <FileCheckIcon className="w-5 h-5" />, label: t('Active TORs'), value: total.toLocaleString(), subtext: `${newThisMonth} ${t('new in last 30 days')}`, color: 'sky' },
    { icon: <DollarSign className="w-5 h-5" />, label: t('Total Market Value'), value: totalValueM, subtext: `${withBudget.length}/${total} ${t('TORs')}`, color: 'emerald' },
    { icon: <Gavel className="w-5 h-5" />, label: t('Awarded (announced)'), value: awarded.toLocaleString(), subtext: `${t('of')} ${total} ${t('TORs')}`, color: 'sky' },
    { icon: <Target className="w-5 h-5" />, label: t('Avg AI Match Score'), value: stats ? `${stats.matches.avgScore}%` : '—', subtext: `${n(stats?.matches.total)} ${t('matches computed')}`, color: 'violet' },
    { icon: <Users className="w-5 h-5" />, label: t('Participating Vendors'), value: n(stats?.vendors), subtext: `${n(stats?.matches.companiesMatched)} ${t('matched')}`, color: 'amber' },
    { icon: <Rss className="w-5 h-5" />, label: t('Crawl Runs'), value: n(stats?.crawl.runs), subtext: `${n(stats?.crawl.itemsFetched)} ${t('items fetched')}`, color: 'emerald' },
    { icon: <PieChart className="w-5 h-5" />, label: t('Top Procurement Method'), value: topMethod ? `${topMethod[1]}` : '—', subtext: topMethod ? topMethod[0] : t('No data'), color: 'violet' },
    { icon: <Layers className="w-5 h-5" />, label: t('Crawl Sources'), value: n(stats?.sources.count), subtext: stats?.sources.names[0] ?? '—', color: 'sky' }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">{t("📊 Market Intelligence Dashboard")} </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, idx) => (
            <StatCard key={idx} icon={card.icon} label={card.label} value={card.value} subtext={card.subtext} color={card.color} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Distribution by procurement method */}
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{t("📈 TOR Distribution by Procurement Method")} </h3>
          {distribution.length ? (
            <div className="space-y-3">
              {distribution.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white shrink-0 tabular-nums">{item.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.bar} transition-all`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('No data')}</p>
          )}
        </div>

        {/* Most-required categories (live from tag assignments) */}
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{t("🔧 Most-required Categories")} </h3>
          {demand.length ? (
            <div className="space-y-3">
              {demand.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white shrink-0 tabular-nums">{item.count}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round((item.count / demandMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('No data')}</p>
          )}
        </div>
      </div>

      {/* Top procurement method detail + crawl sources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t("🏆 Top Procurement Method")} </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white truncate" title={topMethod?.[0]}>{topMethod ? topMethod[0] : '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">{topMethod ? `${topMethod[1]} ${t('TORs')} • ฿${(topMethodValue / 1_000_000).toFixed(1)}M` : t('No data')}</p>
        </div>
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />{t("Most Required")} </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white truncate" title={demand[0]?.name}>{demand[0]?.name ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">{demand[0] ? `${t('Required in')} ${demand[0].count} ${t('TORs')}` : t('No data')}</p>
        </div>
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm md:col-span-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t("📡 Crawl Sources")} </p>
          <div className="flex flex-wrap gap-1.5">
            {(stats?.sources.names ?? []).map((name, idx) => (
              <span key={idx} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{name}</span>
            ))}
            {!stats?.sources.names.length && <span className="text-xs text-slate-500 dark:text-slate-400">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple icon component (can be replaced with lucide-react icon)
const FileCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
