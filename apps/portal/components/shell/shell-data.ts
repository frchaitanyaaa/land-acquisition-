'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type Me } from '@/lib/api';
import { PREF_KEYS, readPref, writePref } from './prefs';

/** The signed-in officer and their posts. `null` data + isError means signed out. */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), retry: false, staleTime: 60_000 });
}

/** One row of GET /projects (v_project_kpis + project columns — snake_case from the API). */
export interface ProjectListRow {
  project_id: string;
  code: string;
  name: string;
  state_code: string;
  status: string;
  current_stage: string | null;
  district_codes: string[] | null;
}

export function useProjectList(enabled: boolean) {
  return useQuery({
    queryKey: ['projects', 'switcher'],
    queryFn: () => api<ProjectListRow[]>('/projects?limit=500'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * The project the officer is working on. Priority: the /project/[id] route, then `?project=`,
 * then the last choice remembered in this browser. Selecting writes `?project=` and remembers it.
 *
 * `?project=` is read from window.location on every navigation rather than with useSearchParams,
 * which would force a Suspense boundary around the whole shell.
 */
export function useSelectedProject(): [string | null, (id: string | null) => void] {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const routeId = pathname.startsWith('/project/') ? (params.id ?? null) : null;
  const [queryId, setQueryId] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setQueryId(new URLSearchParams(window.location.search).get('project'));
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [pathname]);
  useEffect(() => setRemembered(readPref(PREF_KEYS.project)), []);
  useEffect(() => {
    const id = routeId ?? queryId;
    if (id) {
      writePref(PREF_KEYS.project, id);
      setRemembered(id);
    }
  }, [routeId, queryId]);

  const select = useCallback(
    (id: string | null) => {
      writePref(PREF_KEYS.project, id);
      setRemembered(id);
      if (routeId && id) {
        // Inside a project workspace: switch to the same tab of the newly chosen project.
        router.push(pathname.replace(`/project/${routeId}`, `/project/${id}`));
        return;
      }
      const next = new URLSearchParams(window.location.search);
      if (id) next.set('project', id);
      else next.delete('project');
      setQueryId(id);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, routeId, router],
  );

  return [routeId ?? queryId ?? remembered, select];
}

export interface NotificationRow {
  id: string;
  trigger: string;
  severity: 'info' | 'warn' | 'critical';
  entityType: string | null;
  entityId: string | null;
  title: string;
  body: string | null;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications(enabled: boolean, unread: number | null) {
  return useQuery({
    // The SSE unread count is part of the key, so the list refetches when the count moves.
    queryKey: ['notifications', unread],
    queryFn: () => api<{ unread: number; items: NotificationRow[] }>('/notifications?limit=50'),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/** Switching post changes RLS scope, redaction and role checks at once, so every cache is dropped. */
export function useSwitchPost() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (postId: string) => api<Me>('/auth/switch-post', { method: 'POST', body: JSON.stringify({ postId }) }),
    onSuccess: async () => {
      await qc.resetQueries();
      router.refresh();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.clear();
      router.replace('/login');
    },
  });
}
