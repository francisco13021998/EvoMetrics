import { GuestRoute } from '@/components/auth/auth-route';
import { TrainerRequestScreen } from '@/screens/auth/trainer-request-screen';

export default function TrainerRequestRoute() {
  return (
    <GuestRoute>
      <TrainerRequestScreen />
    </GuestRoute>
  );
}
