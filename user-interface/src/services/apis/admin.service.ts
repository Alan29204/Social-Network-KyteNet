import { axiosInstance } from '@services/apis/axios-client';

export interface AdminStats {
  total_users: number;
  total_posts: number;
  recent_posts_7d: number;
  pending_reports: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
  privacy: string;
  created_at: string;
}

export interface AdminPost {
  id: string;
  user_id: string;
  content?: string;
  medias?: string[];
  privacy: string;
  created_at: string;
  user?: { username: string; avatar?: string };
}

export interface AdminReport {
  id: string;
  type: 'post' | 'user';
  reason: string;
  description?: string;
  status: 'pending' | 'resolved' | 'rejected';
  reporter_id: string;
  reported_post_id?: string;
  reported_user_id?: string;
  admin_note?: string;
  created_at: string;
  reporter?: { username: string };
  reported_post?: { content?: string };
  reported_user?: { username: string };
}

const API = '/admins';

export const adminService = {
  getStats: (): Promise<{ data: AdminStats }> =>
    axiosInstance.get(`${API}/stats`),

  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    axiosInstance.get(`${API}/users`, { params }),

  banUser: (id: string) => axiosInstance.patch(`${API}/users/${id}/ban`),
  unbanUser: (id: string) => axiosInstance.patch(`${API}/users/${id}/unban`),
  deleteUser: (id: string) => axiosInstance.delete(`${API}/users/${id}`),

  listPosts: (params?: { page?: number; limit?: number }) =>
    axiosInstance.get(`${API}/posts`, { params }),

  deletePost: (id: string) => axiosInstance.delete(`${API}/posts/${id}`),

  listReports: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get(`${API}/reports`, { params }),

  resolveReport: (id: string, status: string, admin_note?: string) =>
    axiosInstance.patch(`${API}/reports/${id}/resolve`, { status, admin_note }),
};
