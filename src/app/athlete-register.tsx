import { GuestRoute } from '@/components/auth/auth-route';
import { AthleteRegisterScreen } from '@/screens/auth/athlete-register-screen';

export default function AthleteRegisterRoute() {
  return (
    <GuestRoute>
      <AthleteRegisterScreen />
    </GuestRoute>
  );
}
