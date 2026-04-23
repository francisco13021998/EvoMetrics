import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientFormScreen } from '@/screens/clients/client-form-screen';

export default function NewClientRoute() {
  return (
    <ProtectedRoute>
      <ClientFormScreen mode="create" />
    </ProtectedRoute>
  );
}