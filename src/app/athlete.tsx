import { AthleteRoute } from '@/components/auth/auth-route';
import { AthleteHomeScreen } from '@/screens/athlete/athlete-home-screen';

export default function AthleteIndexRoute() {
  return (
    <AthleteRoute>
      <AthleteHomeScreen />
    </AthleteRoute>
  );
}
