import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/auth-store';

export function AuthGuard() {
  const { accessToken } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function GuestGuard() {
  const { accessToken, user } = useAuthStore();

  if (accessToken) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/'} replace />;
  }

  return <Outlet />;
}
