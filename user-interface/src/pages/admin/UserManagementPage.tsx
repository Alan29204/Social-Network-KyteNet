import React, { useCallback, useEffect, useState } from 'react';
import { adminService, AdminUser } from '@services/apis/admin.service';

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; total_pages: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    adminService.listUsers({ page, limit: 15, search: search || undefined })
      .then((res: any) => {
        const d = res?.data ?? res;
        setUsers(d.data ?? []);
        setMeta(d.meta ?? null);
      })
      .catch(() => setFeedback('Failed to load users'))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleBan = async (user: AdminUser) => {
    setActionLoading(user.id);
    try {
      const isBanned = user.role === 'banned';
      if (isBanned) await adminService.unbanUser(user.id);
      else await adminService.banUser(user.id);
      showFeedback(isBanned ? `✅ ${user.username} unbanned` : `🚫 ${user.username} banned`);
      fetchUsers();
    } catch { showFeedback('Action failed') }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Delete account @${user.username}? This cannot be undone.`)) return;
    setActionLoading(user.id);
    try {
      await adminService.deleteUser(user.id);
      showFeedback(`🗑️ ${user.username} deleted`);
      fetchUsers();
    } catch { showFeedback('Delete failed') }
    finally { setActionLoading(null); }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>👥 User Management</h1>
      <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Manage user accounts</p>

      {feedback && (
        <div style={{ padding: '12px 20px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', marginBottom: 20, fontSize: 14 }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Search by username or email..."
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #2d3148',
            background: '#1a1d2e', color: '#e2e8f0', fontSize: 14, outline: 'none',
          }}
        />
      </div>

      <div style={{ background: '#1a1d2e', borderRadius: 16, border: '1px solid #2d3148', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0f1117', color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
              {['User', 'Email', 'Role', 'Joined', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>⏳ Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>No users found</td></tr>
            ) : users.map((user, idx) => (
              <tr key={user.id} style={{ borderTop: '1px solid #1e293b', background: idx % 2 === 0 ? 'transparent' : '#1e2235' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#2d3148', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', fontSize: 16, flexShrink: 0,
                    }}>
                      {user.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                    </div>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>@{user.username}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', color: '#94a3b8' }}>{user.email}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: user.role === 'admin' ? '#818cf822' : user.role === 'banned' ? '#f8717122' : '#34d39922',
                    color: user.role === 'admin' ? '#818cf8' : user.role === 'banned' ? '#f87171' : '#34d399',
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', color: '#64748b' }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleBan(user)}
                        disabled={actionLoading === user.id}
                        style={{
                          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          background: user.role === 'banned' ? '#34d39922' : '#f8717122',
                          color: user.role === 'banned' ? '#34d399' : '#f87171',
                        }}
                      >
                        {actionLoading === user.id ? '...' : user.role === 'banned' ? 'Unban' : 'Ban'}
                      </button>
                    )}
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={actionLoading === user.id}
                        style={{
                          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          background: '#1e293b', color: '#94a3b8',
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {meta && meta.total_pages > 1 && (
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>
              Page {page} of {meta.total_pages} ({meta.total} total)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#94a3b8', cursor: 'pointer' }}>
                ← Prev
              </button>
              <button onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))} disabled={page >= meta.total_pages}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#94a3b8', cursor: 'pointer' }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage;
