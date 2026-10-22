'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageProvider';
import * as api from '@/lib/notificationApi';
import { getTor, toTorContract } from '@/lib/torApi';
import { TORContract } from '@/types';

interface Props {
  onClose: () => void;
  onChanged: () => void;
  onViewProject: (project: TORContract) => void;
}

export function NotificationInbox({ onClose, onChanged, onViewProject }: Props) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<api.NotificationPage | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => { mounted.current = false; previous?.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.listNotifications(page, 20, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, result.pagination.totalPages);
      if (page > lastPage) { setPage(lastPage); return; }
      setData(result);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load notifications.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, refresh]);

  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      if (mounted.current) { onChanged(); setRefresh(value => value + 1); }
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'Could not update notifications.');
    } finally { if (mounted.current) setBusy(false); }
  }

  async function openProject(item: api.NotificationItem) {
    if (!item.projectId) return;
    await action(async () => {
      const project = await getTor(item.projectId!);
      await api.markNotificationRead(item.id);
      if (mounted.current) { onChanged(); onViewProject(toTorContract(project)); }
    });
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="notifications-heading" tabIndex={-1}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
          if (!controls?.length) return;
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }} className="theme-card flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl shadow-xl outline-none">
      <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
        <h2 id="notifications-heading" className="flex items-center gap-2 text-lg font-bold"><Bell className="h-5 w-5" />{t('Notifications')}</h2>
        <button onClick={onClose} aria-label={t('Close notifications')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 text-sm dark:border-slate-700">
        <span>{data?.unreadCount ?? 0} {t('unread')}</span>
        <div className="flex gap-3">
          <button disabled={busy || loading} onClick={() => setRefresh(value => value + 1)} aria-label={t('Refresh notifications')} className="flex items-center gap-1 disabled:opacity-40"><RefreshCw className="h-4 w-4" />{t('Refresh')}</button>
          <button disabled={busy || loading || !data?.unreadCount} onClick={() => void action(async () => { await api.markAllNotificationsRead(); })} className="font-semibold text-sky-600 disabled:opacity-40">{t('Mark all as read')}</button>
        </div>
      </div>
      <div className="overflow-y-auto p-5" aria-busy={loading}>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{t(error)}</p>}
        {loading ? <p role="status" className="py-8 text-center text-slate-500">{t('Loading notifications...')}</p>
          : !data?.items.length ? <p className="py-8 text-center text-sm text-slate-500">{t('No notifications yet. New requirement matches will appear here.')}</p>
          : <ul className="space-y-3">{data.items.map(item => <li key={item.id} className={`rounded-xl border p-4 ${item.isRead ? 'border-slate-200 dark:border-slate-700' : 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30'}`}>
            <h3 className="font-semibold">{t(item.title)}{!item.isRead && <span className="ml-2 text-xs text-sky-600">{t('Unread')}</span>}</h3>
            <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
            <time dateTime={item.createdAt} className="mt-2 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB')}</time>
            <div className="mt-3 flex gap-4 text-sm">
              {item.projectId ? <button disabled={busy} onClick={() => void openProject(item)} className="font-semibold text-sky-600 disabled:opacity-40">{t('View TOR')}</button> : <span className="text-slate-500">{t('This TOR is no longer available.')}</span>}
              {!item.isRead && <button disabled={busy} onClick={() => void action(async () => { await api.markNotificationRead(item.id); })} className="text-slate-500 disabled:opacity-40">{t('Mark as read')}</button>}
            </div>
          </li>)}</ul>}
      </div>
      {data && data.pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm dark:border-slate-700">
        <button disabled={loading || busy || page === 1} onClick={() => setPage(value => value - 1)} className="disabled:opacity-40">{t('Previous')}</button>
        <span>{page} / {data.pagination.totalPages}</span>
        <button disabled={loading || busy || page >= data.pagination.totalPages} onClick={() => setPage(value => value + 1)} className="disabled:opacity-40">{t('Next')}</button>
      </div>}
    </div>
  </div>;
}
