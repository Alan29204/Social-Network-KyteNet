import React, { useCallback, useEffect, useState } from 'react';
import { adminService, AdminPost } from '@services/apis/admin.service';

const PostManagementPage: React.FC = () => {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; total_pages: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    adminService.listPosts({ page, limit: 15 })
      .then((res: any) => {
        const d = res?.data ?? res;
        setPosts(d.data ?? []);
        setMeta(d.meta ?? null);
      })
      .catch(() => setFeedback('Failed to load posts'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = async (post: AdminPost) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setActionLoading(post.id);
    try {
      await adminService.deletePost(post.id);
      showFeedback('🗑️ Post deleted');
      fetchPosts();
    } catch { showFeedback('Delete failed') }
    finally { setActionLoading(null); }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>📝 Post Management</h1>
      <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Review and moderate posts</p>

      {feedback && (
        <div style={{ padding: '12px 20px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', marginBottom: 20, fontSize: 14 }}>
          {feedback}
        </div>
      )}

      <div style={{ background: '#1a1d2e', borderRadius: 16, border: '1px solid #2d3148', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0f1117', color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
              {['Author', 'Content Preview', 'Media', 'Privacy', 'Date', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>⏳ Loading...</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>No posts found</td></tr>
            ) : posts.map((post, idx) => (
              <tr key={post.id} style={{ borderTop: '1px solid #1e293b', background: idx % 2 === 0 ? 'transparent' : '#1e2235' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>👤</span>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>@{post.user?.username ?? 'unknown'}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', maxWidth: 280 }}>
                  <p style={{ margin: 0, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.content || <em style={{ color: '#475569' }}>No text content</em>}
                  </p>
                </td>
                <td style={{ padding: '14px 20px', color: '#64748b' }}>
                  {post.medias && post.medias.length > 0 ? (
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: '#34d39922', color: '#34d399', fontSize: 12 }}>
                      {post.medias.length} file(s)
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: post.privacy === 'public' ? '#818cf822' : '#f8717122',
                    color: post.privacy === 'public' ? '#818cf8' : '#f87171',
                  }}>
                    {post.privacy}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', color: '#64748b', fontSize: 13 }}>
                  {new Date(post.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <button
                    onClick={() => handleDelete(post)}
                    disabled={actionLoading === post.id}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: '#f8717122', color: '#f87171',
                    }}
                  >
                    {actionLoading === post.id ? '...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {meta && meta.total_pages > 1 && (
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>Page {page} of {meta.total_pages} ({meta.total} total)</span>
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

export default PostManagementPage;
