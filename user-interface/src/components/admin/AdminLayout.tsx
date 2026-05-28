import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/admin', label: '📊 Dashboard', end: true },
  { to: '/admin/users', label: '👥 Users' },
  { to: '/admin/posts', label: '📝 Posts' },
  { to: '/admin/reports', label: '🚩 Reports' },
];

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 240,
        background: '#1a1d2e',
        borderRight: '1px solid #2d3148',
        transition: 'width 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🛡️</span>
          {!collapsed && <span style={{ fontWeight: 700, fontSize: 16, color: '#818cf8' }}>SNet Admin</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                textDecoration: 'none',
                color: isActive ? '#818cf8' : '#94a3b8',
                background: isActive ? 'rgba(129,140,248,0.1)' : 'transparent',
                borderLeft: isActive ? '3px solid #818cf8' : '3px solid transparent',
                transition: 'all 0.2s',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
              })}
            >
              <span style={{ fontSize: 20 }}>{item.label.split(' ')[0]}</span>
              {!collapsed && <span>{item.label.split(' ').slice(1).join(' ')}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #2d3148', fontSize: 12, color: '#475569' }}>
          {!collapsed && 'SNet Admin Panel v1.0'}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
