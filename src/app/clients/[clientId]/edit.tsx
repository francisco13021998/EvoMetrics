import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientFormScreen } from '@/screens/clients/client-form-screen';

export default function EditClientRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <ClientFormScreen mode="edit" clientId={clientId} />
    </ProtectedRoute>
  );
}