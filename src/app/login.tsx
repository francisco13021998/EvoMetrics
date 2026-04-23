import { GuestRoute } from '@/components/auth/auth-route';
import { LoginScreen } from '@/screens/auth/login-screen';

export default function LoginRoute() {
  return (
    <GuestRoute>
      <LoginScreen />
    </GuestRoute>
  );
}