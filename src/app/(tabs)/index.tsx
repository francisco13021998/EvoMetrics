import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientsScreen } from '@/screens/clients/clients-screen';

export default function InicioRoute() {
  return (
    <ProtectedRoute>
      <ClientsScreen />
    </ProtectedRoute>
  );
}
