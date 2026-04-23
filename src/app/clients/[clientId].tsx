import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientDetailScreen } from '@/screens/clients/client-detail-screen';

export default function ClientDetailRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <ClientDetailScreen clientId={clientId ?? 'client-1'} />
    </ProtectedRoute>
  );
}