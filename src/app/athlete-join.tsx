import { GuestRoute } from '@/components/auth/auth-route';
import { AthleteJoinScreen } from '@/screens/auth/athlete-join-screen';

export default function AthleteJoinRoute() {
  return (
    <GuestRoute>
      <AthleteJoinScreen />
    </GuestRoute>
  );
}
