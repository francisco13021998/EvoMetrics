import { Redirect, Slot, usePathname } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { PersistentTabShell } from '@/components/layout/persistent-tab-shell';
import { useAuth } from '@/hooks/use-auth';

// Un atleta solo puede ver sus fotos y su análisis; el resto de /clients es del entrenador.
const ATHLETE_ALLOWED_PATH = /^\/clients\/[^/]+\/(photos|metrics)(\/[^/]+)?$/;

function ClientsAreaContent() {
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

export default function ClientsAreaLayout() {
  return (
    <ProtectedRoute>
      <ClientsAreaContent />
    </ProtectedRoute>
  );
}
