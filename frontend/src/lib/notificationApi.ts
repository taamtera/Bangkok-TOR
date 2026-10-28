import { resolveApiUrl } from './api';
import { fetchWithSessionRefresh } from './authApi';

export interface NotificationItem {
  id: string;
  type: 'new_match' | 'tor_updated' | 'deadline_reminder' | 'system';
  title: string;
  message: string;
  projectId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationPage {
  items: NotificationItem[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
async function request<T>(path: string, method = 'GET', signal?: AbortSignal): Promise<T> {
  const response = await fetchWithSessionRefresh(resolveApiUrl(`/api/notifications${path}`)!, {
    method, signal, cache: 'no-store'
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Notifications are temporarily unavailable.');
  return body;
}
export const listNotifications = (page = 1, limit = 20, signal?: AbortSignal) =>
  request<NotificationPage>(`?page=${page}&limit=${limit}`, 'GET', signal);
export const markNotificationRead = (id: string) => request(`/${encodeURIComponent(id)}/read`, 'PATCH');
export const markAllNotificationsRead = () => request('/read-all', 'PATCH');

export interface NotificationPreferences { emailAlerts: boolean; emailAvailable: boolean }
export const getNotificationPreferences = (signal?: AbortSignal) => request<NotificationPreferences>('/preferences', 'GET', signal);
export async function updateNotificationPreferences(emailAlerts: boolean): Promise<NotificationPreferences> {
  const response = await fetchWithSessionRefresh(resolveApiUrl('/api/notifications/preferences')!, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emailAlerts })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Could not save notification preferences.');
  return body;
}
