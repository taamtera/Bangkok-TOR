'use client';
import { useLanguage } from '@/lib/LanguageProvider';


import React from 'react';
import {
  Target,
  Zap,
  PieChart,
  Clock,
  Users,
  DollarSign,
  Gavel
} from 'lucide-react';
import type { TORContract } from '@/types';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose';
  mock?: boolean;
}

// Small badge marking a card whose numbers are placeholder/demo data (no live
// source yet), so real and mock figures are never confused.
const MockBadge: React.FC = () => {
  const { t } = useLanguage();
  return (
    <span
      title={t('Placeholder data — no live source yet')}
      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-300 border border-slate-300/60 dark:border-slate-600/60"
    >
      {t('Demo')}
    </span>
  );
};

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtext,
  trend,
  trendValue,
  color = 'sky',
  mock = false
}) => {
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
        {mock ? (
          <MockBadge />
        ) : (trend && trendValue && (
          <div className={`text-xs font-semibold flex items-center gap-1 ${
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
            trend === 'down' ? 'text-rose-600 dark:text-rose-400' :
            'text-slate-600 dark:text-slate-400'
          }`}>
            {trend === 'up' && '↑'} {trend === 'down' && '↓'} {trendValue}
          </div>
        ))}
      </div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {subtext}
        </p>
      )}
    </div>
  );
};

function procurementMethodName(contract: TORContract): string {
  const method = contract.procurementMethod;
  if (typeof method === 'string' && method.trim()) return method.trim();
  if (typeof contract.category === 'string' && contract.category.trim()) return contract.category.trim();
  return 'ไม่ระบุวิธี';
}

export const DashboardStats: React.FC<{ contracts: TORContract[] }> = ({ contracts }) => {
  const { t } = useLanguage();

  // ----- Real figures derived from the loaded TOR data (/api/tors) -----
  const total = contracts.length;
  const withBudget = contracts.filter((c) => typeof c.price === 'number' && (c.price as number) > 0);
  const totalValue = withBudget.reduce((sum, c) => sum + (c.price ?? 0), 0);
  const totalValueM = `${(totalValue / 1_000_000).toFixed(1)}M`;

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const newThisMonth = contracts.filter((c) => {
    const d = c.publishedAt ? new Date(c.publishedAt) : null;
    return d && !Number.isNaN(d.getTime()) && d >= since;
  }).length;

  const awarded = contracts.filter((c) => typeof c.status === 'string' && c.status.includes('award_published')).length;

  const biddingDays = contracts
    .map((c) => {
      if (!c.publishedAt || !c.submissionDeadline) return null;
      const a = new Date(c.publishedAt).getTime();
      const b = new Date(c.submissionDeadline).getTime();
      const days = Math.round((b - a) / 86_400_000);
      return Number.isFinite(days) && days > 0 && days < 365 ? days : null;
    })
    .filter((d): d is number => d !== null);
  const avgBidding = biddingDays.length ? Math.round(biddingDays.reduce((s, d) => s + d, 0) / biddingDays.length) : null;

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

  const stats: StatCardProps[] = [
    // --- REAL ---
    {
      icon: <FileCheckIcon className="w-5 h-5" />,
      label: t('Active TORs'),
      value: total.toLocaleString(),
      subtext: `${newThisMonth} ${t('new in last 30 days')}`,
      color: 'sky'
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      label: t('Total Market Value'),
      value: `${totalValueM}`,
      subtext: `${t('THB')} • ${withBudget.length}/${total} ${t('TORs')}`,
      color: 'emerald'
    },
    {
      icon: <Gavel className="w-5 h-5" />,
      label: t('Awarded (announced)'),
      value: awarded.toLocaleString(),
      subtext: `${t('of')} ${total} ${t('TORs')}`,
      color: 'sky'
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: t('Avg Bidding Period'),
      value: avgBidding !== null ? `${avgBidding} ${t('days')}` : '—',
      subtext: avgBidding !== null ? `${t('based on')} ${biddingDays.length} ${t('TORs')}` : t('No deadline data'),
      color: 'rose',
      mock: avgBidding === null
    },
    {
      icon: <PieChart className="w-5 h-5" />,
      label: t('Top Procurement Method'),
      value: topMethod ? `${topMethod[1]}` : '—',
      subtext: topMethod ? `${topMethod[0]}` : t('No data'),
      color: 'violet'
    },
    // --- MOCK (no live source yet) ---
    {
      icon: <Target className="w-5 h-5" />,
      label: t('Avg AI Match Score'),
      value: '86.3%',
      subtext: t('±4.2 points'),
      trend: 'up',
      trendValue: '+2.1%',
      color: 'violet',
      mock: true
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: t('Participating Vendors'),
      value: '387',
      subtext: t('+32 this quarter'),
      trend: 'up',
      trendValue: '+9%',
      color: 'amber',
      mock: true
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: t('AI Crawl Updates'),
      value: '1,204',
      subtext: t('Last 30 days'),
      trend: 'up',
      trendValue: '+18%',
      color: 'emerald',
      mock: true
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">{t("📊 Market Intelligence Dashboard")} </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <StatCard
              key={idx}
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
              subtext={stat.subtext}
              trend={stat.trend}
              trendValue={stat.trendValue}
              color={stat.color}
              mock={stat.mock}
            />
          ))}
        </div>
      </div>

      {/* Distribution by procurement method — REAL */}
      <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{t("📈 TOR Distribution by Procurement Method")} </h3>
        {distribution.length ? (
          <div className="space-y-3">
            {distribution.map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1 gap-3">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.name}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white shrink-0">
                    {item.value}%
                  </span>
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

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* REAL */}
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t("🏆 Top Procurement Method")} </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white truncate" title={topMethod?.[0]}>{topMethod ? topMethod[0] : '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{topMethod ? `${topMethod[1]} ${t('TORs')} • ฿${(topMethodValue / 1_000_000).toFixed(1)}M` : t('No data')}</p>
        </div>

        {/* MOCK */}
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("⚡ Highest Demand Tech")} </p>
            <MockBadge />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">Next.js / React</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("Required in 34 TORs • 71% match rate")} </p>
        </div>

        {/* MOCK */}
        <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("🎯 Vendor Satisfaction")} </p>
            <MockBadge />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">4.7 / 5.0</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("Based on 234 reviews • Highly recommended")} </p>
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
