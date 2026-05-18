import { GuestRoute } from '@/components/auth/auth-route';
import { JoinScreen } from '@/screens/auth/join-screen';

export default function JoinRoute() {
  return (
    <GuestRoute>
      <JoinScreen />
    </GuestRoute>
  );
}
