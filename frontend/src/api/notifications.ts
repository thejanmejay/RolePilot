import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: 'automation' | 'applications' | 'profile' | 'account' | 'system';
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string | null;
  is_read: boolean;
  is_archived: boolean;
  dedup_key?: string | null;
  metadata_json?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export async function fetchNotifications(
  filter: 'all' | 'unread' | 'read' | 'updates' = 'all',
  limit = 50,
  offset = 0
): Promise<NotificationListResponse> {
  const query = new URLSearchParams({
    filter,
    limit: String(limit),
    offset: String(offset),
  }).toString();
  return apiClient.get<NotificationListResponse>(`/api/v1/notifications?${query}`, {
    bypassCache: true,
  });
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const response = await apiClient.get<UnreadCountResponse>('/api/v1/notifications/unread-count', {
      bypassCache: true,
    });
    return response.unread_count;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  return apiClient.post<NotificationItem>(`/api/v1/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; count: number }> {
  return apiClient.post<{ success: boolean; count: number }>('/api/v1/notifications/mark-all-read');
}

export async function archiveNotification(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/api/v1/notifications/${id}`);
}
