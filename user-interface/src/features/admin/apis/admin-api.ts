import AXIOS_INSTANCE from '@/services/apis/axios-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ═══════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════

const adminApi = {
  getStats: async () => {
    const res = await AXIOS_INSTANCE.get('/admins/stats');
    return res.data;
  },

  listUsers: async (params: { page?: number; limit?: number; search?: string }) => {
    const res = await AXIOS_INSTANCE.get('/admins/users', { params });
    return res.data;
  },

  banUser: async (userId: string) => {
    const res = await AXIOS_INSTANCE.patch(`/admins/users/${userId}/ban`);
    return res.data;
  },

  unbanUser: async (userId: string) => {
    const res = await AXIOS_INSTANCE.patch(`/admins/users/${userId}/unban`);
    return res.data;
  },

  deleteUser: async (userId: string) => {
    const res = await AXIOS_INSTANCE.delete(`/admins/users/${userId}`);
    return res.data;
  },

  addAdmin: async (userId: string) => {
    const res = await AXIOS_INSTANCE.post('/admins/add-admin', { user_id: userId });
    return res.data;
  },

  listPosts: async (params: { page?: number; limit?: number }) => {
    const res = await AXIOS_INSTANCE.get('/admins/posts', { params });
    return res.data;
  },

  deletePost: async (postId: string) => {
    const res = await AXIOS_INSTANCE.delete(`/admins/posts/${postId}`);
    return res.data;
  },

  listReports: async (params: { status?: string; page?: number; limit?: number }) => {
    const res = await AXIOS_INSTANCE.get('/admins/reports', { params });
    return res.data;
  },

  resolveReport: async (data: { id: string; status: string; admin_note: string }) => {
    const res = await AXIOS_INSTANCE.patch(`/admins/reports/${data.id}/resolve`, {
      status: data.status,
      admin_note: data.admin_note,
    });
    return res.data;
  },
};

// ═══════════════════════════════════════════
// React Query Hooks
// ═══════════════════════════════════════════

export const ADMIN_QUERY_KEYS = {
  stats: ['admin', 'stats'] as const,
  users: (params: any) => ['admin', 'users', params] as const,
  posts: (params: any) => ['admin', 'posts', params] as const,
  reports: (params: any) => ['admin', 'reports', params] as const,
};

// ── Queries ──────────────────────────────────
export const useAdminStats = () =>
  useQuery({
    queryKey: ADMIN_QUERY_KEYS.stats,
    queryFn: adminApi.getStats,
  });

export const useAdminUsers = (params: { page?: number; limit?: number; search?: string }) =>
  useQuery({
    queryKey: ADMIN_QUERY_KEYS.users(params),
    queryFn: () => adminApi.listUsers(params),
  });

export const useAdminPosts = (params: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: ADMIN_QUERY_KEYS.posts(params),
    queryFn: () => adminApi.listPosts(params),
  });

export const useAdminReports = (params: { status?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: ADMIN_QUERY_KEYS.reports(params),
    queryFn: () => adminApi.listReports(params),
  });

// ── Mutations ────────────────────────────────
export const useBanUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.banUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats });
    },
  });
};

export const useUnbanUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.unbanUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats });
    },
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats });
    },
  });
};

export const useAddAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.addAdmin,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.deletePost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats });
    },
  });
};

export const useResolveReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.resolveReport,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats });
    },
  });
};
