import React, { useEffect, useState } from 'react';
import { adminService, AdminStats } from '@services/apis/admin.service';

const StatCard: React.FC<{ label: string; value: number | string; icon: string; color: string }> = ({ label, value, icon, color }) => (
  <div style={{
    background: '#1a1d2e',
    borderRadius: 16,
    padding: '24px',
    border: `1px solid ${color}33`,
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    flex: 1,
    minWidth: 180,
    boxShadow: `0 4px 24px ${color}22`,
    transition: 'transform 0.2s',
  }}>
    <div style={{
      width: 56,
      height: 56,
      borderRadius: 14,
      background: `${color}22`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 28,
    }}>
      {icon}
    </div>
    <div>
      <p style={{ margin: 0, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 700, color: '#f1f5f9' }}>{value.toLocaleString()}</p>
    </div>
  </div>
);

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminService.getStats()
      .then((res: any) => setStats(res?.data ?? res))
      .catch(() => setError('Failed to load statistics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#818cf8', fontSize: 18 }}>
      ⏳ Loading dashboard...
    </div>
  );

  if (error) return (
    <div style={{ color: '#f87171', textAlign: 'center', marginTop: 60, fontSize: 16 }}>❌ {error}</div>
  );

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>📊 Dashboard</h1>
      <p style={{ margin: '0 0 32px', color: '#64748b', fontSize: 14 }}>System overview & statistics</p>

      {/* Stats Grid */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
        <StatCard label="Total Users" value={stats?.total_users ?? 0} icon="👥" color="#818cf8" />
        <StatCard label="Total Posts" value={stats?.total_posts ?? 0} icon="📝" color="#34d399" />
        <StatCard label="Posts (7 days)" value={stats?.recent_posts_7d ?? 0} icon="🔥" color="#fb923c" />
        <StatCard label="Pending Reports" value={stats?.pending_reports ?? 0} icon="🚩" color="#f87171" />
      </div>

      {/* Quick Actions */}
      <div style={{ background: '#1a1d2e', borderRadius: 16, padding: 24, border: '1px solid #2d3148' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#e2e8f0' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: '👥 Manage Users', href: '/admin/users', color: '#818cf8' },
            { label: '📝 Manage Posts', href: '/admin/posts', color: '#34d399' },
            { label: '🚩 Review Reports', href: '/admin/reports', color: '#f87171' },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                background: `${action.color}22`,
                border: `1px solid ${action.color}44`,
                color: action.color,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
                transition: 'background 0.2s',
              }}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
