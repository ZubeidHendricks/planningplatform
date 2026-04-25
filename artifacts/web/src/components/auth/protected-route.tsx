import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/auth';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const [restoring, setRestoring] = useState(!user && isAuthenticated);

  useEffect(() => {
    if (!user && isAuthenticated) {
      restoreSession().finally(() => setRestoring(false));
    }
  }, [user, isAuthenticated, restoreSession]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (restoring) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return children ?? <Outlet />;
}
