'use client';
import { useLanguage } from '@/lib/LanguageProvider';


import React, { useState, useMemo, useEffect } from 'react';
import { 
  SoftwareHouseProfile, 
  TORContract, 
  FilterState 
} from '@/types';
import * as authApi from '@/lib/authApi';
import * as companyProfileApi from '@/lib/companyProfileApi';
import * as torApi from '@/lib/torApi';
import * as recommendationApi from '@/lib/aiRecommendationApi';
import { companyDataToProfile, profileToCompanyData, safeUserToProfile } from '@/lib/userProfile';
import { Header } from '@/components/Header';
import { DashboardHero } from '@/components/DashboardHero';
import { DashboardStats } from '@/components/DashboardStats';
import { FilterBar } from '@/components/FilterBar';
import { TORCard } from '@/components/TORCard';
import { TORDetailModal } from '@/components/TORDetailModal';
import { AuthModal } from '@/components/AuthModal';
import { SoftwareHouseProfileModal } from '@/components/SoftwareHouseProfileModal';
import { AIRecommendationView } from '@/components/AIRecommendationView';
import { MatchingResultsView } from '@/components/MatchingResultsView';
import { NotificationToast } from '@/components/NotificationToast';
import { DEFAULT_FILTERS, dateRange } from '@/lib/discovery';
import { resolveApiUrl } from '@/lib/api';
import { 
  Sparkles, 
  Layers, 
  Bot, 
  CheckCircle2, 
  Search,
  RefreshCw
} from 'lucide-react';

export default function Home() {
  const { t } = useLanguage();
  // Theme state ('light' by default for easy on the eyes, or toggleable to 'dark')
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Sync theme mode class to HTML element
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeMode]);

  const handleToggleTheme = () => {
    setThemeMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // State Management
  const [activeTab, setActiveTab] = useState<'dashboard' | 'find' | 'recommendations' | 'profile' | 'matching-setup'>('find');
  const [currentUser, setCurrentUser] = useState<SoftwareHouseProfile | null>(null);
  const [contracts, setContracts] = useState<TORContract[]>([]);
  const [isLoadingTors, setIsLoadingTors] = useState(true);
  const [torLoadError, setTorLoadError] = useState<string | null>(null);
  const [torRefreshKey, setTorRefreshKey] = useState(0);
  const [recommendations, setRecommendations] = useState<recommendationApi.RecommendationItem[]>([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationStatus, setRecommendationStatus] = useState<recommendationApi.RecommendationResponse['status']>('not_configured');

  useEffect(() => {
    if (activeTab !== 'recommendations' || !currentUser) return;
    const controller = new AbortController();
    setRecommendationLoading(true);
    setRecommendations([]);
    setRecommendationError(null);
    recommendationApi.getRecommendations(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setRecommendations(result.items);
      setRecommendationStatus(result.status);
      setRecommendationError(null);
    }).catch((error) => {
      if (!controller.signal.aborted) setRecommendationError((error as Error).message);
    }).finally(() => {
      if (!controller.signal.aborted) setRecommendationLoading(false);
    });
    return () => controller.abort();
  }, [activeTab, currentUser?.id]);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [facets, setFacets] = useState<torApi.DiscoveryFacets>({ departments: [], methods: [] });
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.searchQuery.trim().replace(/\s+/g, ' ')), 300);
    return () => clearTimeout(timer);
  }, [filters.searchQuery]);
  const query = useMemo(() => ({ search: debouncedSearch, departmentId: filters.department,
    stage: filters.status, stageScope: filters.stageScope, procurementMethod: filters.procurementMethod,
    ...(filters.datePreset === 'custom' ? { fromDate: filters.fromDate, toDate: filters.toDate } : dateRange(filters.datePreset)),
    sort: filters.sort }), [debouncedSearch, filters.department, filters.status, filters.stageScope,
    filters.procurementMethod, filters.datePreset, filters.fromDate, filters.toDate, filters.sort]);
  const queryKey = JSON.stringify(query);
  const [pageQueryKey, setPageQueryKey] = useState(queryKey);
  const effectivePage = pageQueryKey === queryKey ? page : 1;
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (initial = false) => {
      if (initial) setIsLoadingTors(true);
      try {
        if (query.fromDate && query.toDate && query.fromDate > query.toDate) throw new Error('The start date must not be after the end date.');
        const result = await torApi.listTors({ ...query, page: effectivePage }, controller.signal);
        if (!controller.signal.aborted) {
          setContracts(result.items); setTotal(result.total); setTotalAll(result.totalAllProjects);
          setFacets(result.facets); setTorLoadError(null);
          if (effectivePage > Math.max(1, result.pagination.totalPages)) {
            setPage(Math.max(1, result.pagination.totalPages)); setPageQueryKey(queryKey);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setTorLoadError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) { setIsLoadingTors(false); timer = setTimeout(() => void refresh(), 30000); }
      }
    };
    void refresh(true);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [queryKey, effectivePage, torRefreshKey]);
  const changePage = (value: number) => {
    setPageQueryKey(queryKey); setPage(value);
    document.getElementById('project-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Restore the session on load: if a valid auth cookie exists, the backend returns
  // the current user; otherwise stay logged out. Runs once on mount.
  useEffect(() => {
    let cancelled = false;
    authApi
      .getSession()
      .then(({ user }) => {
        if (!cancelled && user) setCurrentUser(safeUserToProfile(user));
      })
      .catch(() => {
        // Backend unreachable — remain logged out.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load persisted company fields after the account identity has been restored.
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    const userId = currentUser.id;
    companyProfileApi.getMyCompanyProfile().then((company) => {
      if (!cancelled) {
        setCurrentUser((user) => user?.id === userId ? companyDataToProfile(user, company) : user);
      }
    }).catch(() => {
      // Keep account identity available if the company-profile service is offline.
    });
    return () => { cancelled = true; };
  }, [currentUser?.id]);
  const [selectedContract, setSelectedContract] = useState<TORContract | null>(null);
  
  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signin'>('login');

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);

  const [activeNotification, setActiveNotification] = useState<TORContract | null>(null);
  const [notificationCount] = useState<number>(0);
  const filteredContracts = contracts;

  const saveCompanyProfile = async (updated: SoftwareHouseProfile) => {
    const company = await companyProfileApi.updateMyCompanyProfile(profileToCompanyData(updated));
    setCurrentUser((user) => user?.id === updated.id ? companyDataToProfile(updated, company) : user);
  };

  // Total budget volume formatted
  const totalBudgetFormatted = useMemo(() => {
    const knownBudgets = contracts.filter(project => project.price !== null);
    if (!knownBudgets.length) return t("Not available");
    const total = knownBudgets.reduce((acc, project) => acc + (project.price ?? 0), 0);
    return `${(total / 1000000).toFixed(1)}M THB${knownBudgets.length < contracts.length ? ' (known budgets)' : ''}`;
  }, [contracts]);

  // Handlers
  const handleOpenAuth = (mode: 'login' | 'signin') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    // Clear local state immediately; revoke the session/cookies on the backend.
    setCurrentUser(null);
    setRecommendations([]);
    setActiveTab('dashboard');
    try {
      await authApi.logout();
    } catch {
      // Even if the network call fails, the user is logged out locally.
    }
  };

  const handleResetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const handleDownloadPDF = (contract: TORContract) => {
    if (contract.projectId && (contract.documentUrl || contract.url)) {
      const downloadUrl = resolveApiUrl(`/api/tors/documents/${encodeURIComponent(contract.projectId)}/download`);
      if (downloadUrl) window.location.assign(downloadUrl);
      return;
    }

    const documentUrl = contract.documentUrl || contract.url || contract.pdfUrl;
    if (documentUrl) {
      window.open(documentUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const textContent = `
${t('Terms of Reference (TOR)')}
${contract.title}

${t('Issued by:')} ${contract.contractOwner}
${t('Procurement Method')} ${contract.category}
${t('Project budget:')} ${t(contract.priceFormatted)}
${t('Contract period:')} ${contract.startDate} – ${contract.endDate}
${t('Submission deadline:')} ${t(contract.submissionDeadline)}

${t('Purpose:')}
${contract.description}

${t('Qualifications:')}
${contract.properties.map(p => '- ' + p.property).join('\n')}

${t('Assessment:')}
${t('Score:')} ${contract.aiEvaluation.qualificationMatchScore}%
${t('Budget assessment:')} ${t(contract.aiEvaluation.priceAssessment)}
${t('Risk')}: ${t(contract.aiEvaluation.riskLevel)} (${t(contract.aiEvaluation.riskAnalysis)})

${t('Downloaded from Thailand TOR Intelligence Platform (2026)')}
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contract.id}_TOR_Specification.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        onOpenProfile={() => setProfileModalOpen(true)}
        notificationCount={notificationCount}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* VIEW 1: DASHBOARD TAB (Desktop - 1) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5 animate-fadeIn">
            
            {/* Banner Section (Dash board) */}
            <DashboardHero
              totalTORs={totalAll}
              totalBudgetFormatted={totalBudgetFormatted}
            />

            {/* Dashboard Stats */}
            <DashboardStats />

          </div>
        )}

        {/* VIEW 2: FIND TAB (Search & Filter) */}
        {activeTab === 'find' && (
          <div className="space-y-5 animate-fadeIn">

            {/* 2x2 Filter Dropdowns */}
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              onResetFilters={handleResetFilters}
              resultCount={total}
              departments={facets.departments}
              methods={facets.methods}
              onRefresh={() => setTorRefreshKey(key => key + 1)}
              isLoading={isLoadingTors}
            />

            {/* TOR Contract Cards Listing */}
            <div>
              <div id="project-results" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 scroll-mt-24">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-sky-600" />{t("Nationwide Projects")}</h2>
                  <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()}{t("items · Select a project to view announcements and documents")}</p>
                </div>
                <label className="text-sm flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">{t("Sort by:")} <select aria-label={t("Sort by")} className="theme-input rounded-lg p-2" value={filters.sort}
                    onChange={e => setFilters(prev => ({ ...prev, sort: e.target.value as FilterState['sort'] }))}>
                    <option value="latest">{t("Latest Date")}</option>
                    <option value="oldest">{t("Oldest Date")}</option>
                    <option value="relevance" disabled={!filters.searchQuery.trim()}>{t("Relevance")}</option>
                  </select>
                </label>
              </div>

              {isLoadingTors ? (
                <div className="theme-card p-10 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("Loading live TOR announcements...")}</p>
                </div>
              ) : torLoadError ? (
                <div className="theme-card p-8 text-center rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900">
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("Could not load live TOR announcements.")}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t(torLoadError)}</p>
                  <button
                    onClick={() => setTorRefreshKey((key) => key + 1)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold rounded-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />{t("Retry")} </button>
                </div>
              ) : filteredContracts.length > 0 ? (
                <div className="space-y-4">
                  {filteredContracts.map((contract) => (
                    <TORCard
                      key={contract.id}
                      contract={contract}
                      onSelect={(c) => setSelectedContract(c)}
                    />
                  ))}
                </div>
              ) : (
                <div className="theme-card p-8 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <Search className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{t("No matching TOR projects found")}</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">{t("Try adjusting criteria or clear all filters")}</p>
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-sky-600 dark:text-sky-400 text-xs font-semibold rounded-xl transition-all"
                  >{t("Clear All Filters")} </button>
                </div>
              )}
              {!isLoadingTors && !torLoadError && total > 0 && (
                <nav aria-label={t("Search result pages")} className="flex flex-wrap items-center justify-between gap-3 mt-6 text-sm">
                  <span className="text-slate-500">{(effectivePage - 1) * 25 + 1}–{Math.min(effectivePage * 25, total)}{t("of")} {total.toLocaleString()}{t("items")}</span>
                  <div className="flex items-center gap-3">
                    <button className="theme-input rounded-lg px-3 py-2 disabled:opacity-40" disabled={effectivePage === 1} onClick={() => changePage(effectivePage - 1)}>{t("Previous")}</button>
                    <span>{effectivePage} / {Math.max(1, Math.ceil(total / 25))}</span>
                    <button className="theme-input rounded-lg px-3 py-2 disabled:opacity-40" disabled={effectivePage >= Math.ceil(total / 25)} onClick={() => changePage(effectivePage + 1)}>{t("Next")}</button>
                  </div>
                </nav>
              )}
            </div>

          </div>
        )}

        {/* VIEW 3: RECOMMENDATION TAB (Desktop - data) */}
        {activeTab === 'recommendations' && (
          currentUser ? (
            <AIRecommendationView
              recommendations={recommendations}
              status={recommendationStatus}
              isLoading={recommendationLoading}
              error={recommendationError}
              onViewMatches={() => setActiveTab('matching-setup')}
              onSelectProject={(projectId) => {
                torApi.getTor(projectId).then((tor) => setSelectedContract(torApi.toTorContract(tor)))
                  .catch((error) => setRecommendationError((error as Error).message));
              }}
            />
          ) : (
            <div className="theme-card p-10 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 my-8 shadow-sm">
              <Bot className="w-16 h-16 text-sky-600 dark:text-sky-400 mx-auto mb-4" />
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t("Log in to view recommendations")}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 mb-6">{t("Log in to see AI project recommendations for your company.")} </p>
              <button
                onClick={() => handleOpenAuth('login')}
                className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-sm text-sm transition-all"
              >{t("Log In / Sign Up")} </button>
            </div>
          )
        )}

        {activeTab === 'matching-setup' && currentUser && <MatchingResultsView
          currentUser={currentUser}
          onSelectContract={(contract) => setSelectedContract(contract)}
          onEditProfile={() => setProfileModalOpen(true)}
          onViewRecommendations={() => setActiveTab('recommendations')}
        />}

        {/* VIEW 4: PROFILE TAB (Desktop - data profile) */}
        {activeTab === 'profile' && (
          currentUser ? (
            <div className="theme-card p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <img src={currentUser.avatar} alt={currentUser.companyName} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-sky-500/50" />
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{currentUser.companyName}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("Tax ID:")} {currentUser.taxId} • {currentUser.district}</p>
                  </div>
                </div>
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm"
                >{t("Edit qualifications")} </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">{t("Company qualifications")} </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentUser.properties.map((prop, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>{prop}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <button onClick={() => handleOpenAuth('login')} className="px-6 py-3 bg-sky-600 text-white font-bold rounded-xl">{t("Log In / Sign Up")} </button>
            </div>
          )
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-6 mt-12 bg-white dark:bg-slate-950 text-xs text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{t("Thailand TOR Intelligence Software Platform")}</span>
          </div>
          <p>{t("© 2026 Software Requirement Specification & Technical Design Mockup.")}</p>
        </div>
      </footer>

      {/* MODAL 1: TOR Detail & PDF Reader (Desktop - 2) */}
      <TORDetailModal
        contract={contracts.find(project => project.projectId === selectedContract?.projectId) ?? selectedContract}
        onClose={() => setSelectedContract(null)}
        onDownloadPDF={handleDownloadPDF}
      />

      {/* MODAL 2: Auth LogIn / SignIn (Desktop - LogIn & Desktop - SignIn) */}
      <AuthModal
        isOpen={authModalOpen}
        mode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user) => setCurrentUser(user)}
      />

      {/* MODAL 3: Software House Profile (Desktop - data form) */}
      {currentUser && (
        <SoftwareHouseProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          currentUser={currentUser}
          onSave={saveCompanyProfile}
        />
      )}

      {/* Notification Toast Alert */}
      <NotificationToast
        contract={activeNotification}
        onClose={() => setActiveNotification(null)}
        onViewContract={(c) => setSelectedContract(c)}
      />

    </div>
  );
}
