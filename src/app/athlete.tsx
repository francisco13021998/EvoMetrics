import { AthleteRoute } from '@/components/auth/auth-route';
import { PersistentTabShell } from '@/components/layout/persistent-tab-shell';
import { AthleteHomeScreen } from '@/screens/athlete/athlete-home-screen';

export default function AthleteIndexRoute() {
  return (
    <AthleteRoute>
      <PersistentTabShell activeTab="athlete-home">
        <AthleteHomeScreen />
      </PersistentTabShell>
    </AthleteRoute>
  );
}
