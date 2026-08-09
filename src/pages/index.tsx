import { Navigate } from 'react-router-dom';
import { useSession } from '@/lib/auth/auth-client';
import { Loader2 } from 'lucide-react';

/**
 * The entire site is sign-in -> tool. This page has no content of its
 * own — it just decides which of those two you land on.
 */
export default function RootPage() {
  const { isAuthenticated, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0d14' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#1d8cf8' }} />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/players' : '/login'} replace />;
}
