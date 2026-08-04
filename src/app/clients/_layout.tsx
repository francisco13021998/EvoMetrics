import { Slot } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { PersistentTabShell } from '@/components/layout/persistent-tab-shell';

export default function ClientsAreaLayout() {
  return (
    <ProtectedRoute>
      <PersistentTabShell activeTab="clients">
        <Slot />
      </PersistentTabShell>
    </ProtectedRoute>
  );
}