import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * AdminGuard — protects all /admin/* routes.
 * Reads the JWT from localStorage, decodes payload, checks role === 'admin'.
 */
const AdminGuard: React.FC = () => {
  const token = localStorage.getItem('accessToken');

  if (!token) return <Navigate to="/login" replace />;

  try {
    // Decode JWT payload (base64url)
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadBase64));
    if (payload?.role !== 'admin') {
      return <Navigate to="/" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default AdminGuard;
