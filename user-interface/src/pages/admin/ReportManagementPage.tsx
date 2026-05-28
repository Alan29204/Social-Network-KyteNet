import React, { useCallback, useEffect, useState } from 'react';
import { adminService, AdminReport } from '@services/apis/admin.service';

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fb923c22', text: '#fb923c' },
  resolved: { bg: '#34d39922', text: '#34d399' },
  rejected: { bg: '#f8717122', text: '#f87171' },
};

const ReportManagementPage: React.FC = () => {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; total_pages: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ reportId: string; action: 'resolved' | 'rejected' } | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchReports = useCallback(() => {
    setLoading(true);
    adminService.listReports({ status: statusFilter || undefined, page, limit: 15 })
      .then((res: any) => {
        const d = res?.data ?? res;
        setReports(d.data ?? []);
        setMeta(d.meta ?? null);
      })
      .catch(() => setFeedback('Failed to load reports'))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleResolve = async () => {
    if (!noteModal) return;
    setActionLoading(noteModal.reportId);
    try {
      await adminService.resolveReport(noteModal.reportId, noteModal.action, adminNote);
      showFeedback(`✅ Report ${noteModal.action}`);
      setNoteModal(null);
      setAdminNote('');
      fetchReports();
    } catch { showFeedback('Action failed') }
    finally { setActionLoading(null); }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>🚩 Report Management</h1>
      <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Review and resolve user reports</p>

      {feedback && (
        <div style={{ padding: '12px 20px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', marginBottom: 20, fontSize: 14 }}>
          {feedback}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'pending', 'resolved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: statusFilter === s ? '#818cf8' : '#1e293b',
              color: statusFilter === s ? '#fff' : '#94a3b8',
            }}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ background: '#1a1d2e', borderRadius: 16, border: '1px solid #2d3148', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0f1117', color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
              {['Reporter', 'Type', 'Reason', 'Target', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>⏳ Loading...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>No reports found</td></tr>
            ) : reports.map((report, idx) => (
              <tr key={report.id} style={{ borderTop: '1px solid #1e293b', background: idx % 2 === 0 ? 'transparent' : '#1e2235' }}>
                <td style={{ padding: '14px 20px', color: '#94a3b8' }}>@{report.reporter?.username ?? '?'}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: '#818cf822', color: '#818cf8', fontSize: 12 }}>
                    {report.type}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>{report.reason}</td>
                <td style={{ padding: '14px 20px', color: '#94a3b8', maxWidth: 200 }}>
                  {report.type === 'post'
                    ? <span style={{ fontSize: 12, color: '#64748b' }}>{report.reported_post?.content?.slice(0, 40) ?? '—'}...</span>
                    : <span>@{report.reported_user?.username ?? '?'}</span>
                  }
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: statusColors[report.status]?.bg,
                    color: statusColors[report.status]?.text,
                  }}>
                    {report.status}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', color: '#64748b', fontSize: 13 }}>
                  {new Date(report.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  {report.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setNoteModal({ reportId: report.id, action: 'resolved' })}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#34d39922', color: '#34d399' }}>
                        Resolve
                      </button>
                      <button
                        onClick={() => setNoteModal({ reportId: report.id, action: 'rejected' })}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#f8717122', color: '#f87171' }}>
                        Reject
                      </button>
                    </div>
                  )}
                  {report.status !== 'pending' && (
                    <span style={{ color: '#475569', fontSize: 12, fontStyle: 'italic' }}>{report.admin_note ?? '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {meta && meta.total_pages > 1 && (
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>Page {page} of {meta.total_pages}</span>
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

      {/* Note modal */}
      {noteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{ background: '#1a1d2e', borderRadius: 16, padding: 32, width: 480, border: '1px solid #2d3148' }}>
            <h3 style={{ margin: '0 0 16px', color: '#e2e8f0', textTransform: 'capitalize' }}>
              {noteModal.action} Report
            </h3>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Admin note (optional)..."
              rows={4}
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: '1px solid #2d3148',
                background: '#0f1117', color: '#e2e8f0', fontSize: 14, resize: 'vertical',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setNoteModal(null); setAdminNote(''); }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #2d3148', background: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!!actionLoading}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: noteModal.action === 'resolved' ? '#34d399' : '#f87171', color: '#fff',
                }}>
                {actionLoading ? '...' : `Confirm ${noteModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportManagementPage;
