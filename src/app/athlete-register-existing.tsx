import { GuestRoute } from '@/components/auth/auth-route';
import { AthleteRegisterExistingScreen } from '@/screens/auth/athlete-register-existing-screen';

export default function AthleteRegisterExistingRoute() {
  return (
    <GuestRoute>
      <AthleteRegisterExistingScreen />
    </GuestRoute>
  );
}
