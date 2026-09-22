import { Redirect, Slot, usePathname } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { PersistentTabShell } from '@/components/layout/persistent-tab-shell';
import { useAuth } from '@/hooks/use-auth';

// Un atleta solo puede consultar el detalle de sus revisiones, no crearlas ni editarlas.
const ATHLETE_ALLOWED_PATH = /^\/revisions\/(?!new$)[^/]+$/;

function RevisionsAreaContent() {
  const { userRole } = useAuth();
  const pathname = usePathname();

  if (userRole === 'athlete' && !ATHLETE_ALLOWED_PATH.test(pathname)) {
    return <Redirect href="/athlete" />;
  }

  return (
    <PersistentTabShell activeTab="clients">
      <Slot />
    </PersistentTabShell>
  );
}

export default function RevisionsAreaLayout() {
  return (
    <ProtectedRoute>
      <RevisionsAreaContent />
    </ProtectedRoute>
  );
}
