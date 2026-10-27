'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationTab } from '@/server/notifications/tabs';

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};
type ListResponse = { ok: true; items: NotificationItem[]; unread: number };

const KEY = ['notifications'] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function useNotifications(tab: NotificationTab, limit: number) {
  return useQuery({
    queryKey: [...KEY, tab, limit],
    queryFn: () => request<ListResponse>(`/api/notifications?tab=${tab}&limit=${limit}`),
    // The bell stays fresh without a socket: poll while the tab is visible.
    refetchInterval: 60_000
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/api/notifications/${id}/read`, { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY })
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request('/api/notifications/read-all', { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY })
  });
}

/** "3 unread notifications", or "No unread notifications" (DESIGN_SYSTEM: announced to screen readers). */
export function unreadLabel(n: number): string {
  if (n === 0) return 'No unread notifications';
  return `${n} unread notification${n === 1 ? '' : 's'}`;
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
