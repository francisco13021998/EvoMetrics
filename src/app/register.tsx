import { GuestRoute } from '@/components/auth/auth-route';
import { RegisterScreen } from '@/screens/auth/register-screen';

export default function RegisterRoute() {
  return (
    <GuestRoute>
      <RegisterScreen />
    </GuestRoute>
  );
}