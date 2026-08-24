import { Slot } from 'expo-router';

import { TrainerRoute } from '@/components/auth/auth-route';
import { PersistentTabShell } from '@/components/layout/persistent-tab-shell';

export default function EventsAreaLayout() {
  return (
    <TrainerRoute>
      <PersistentTabShell activeTab="agenda">
        <Slot />
      </PersistentTabShell>
    </TrainerRoute>
  );
}
