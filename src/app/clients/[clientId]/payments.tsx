import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientPaymentsScreen } from '@/screens/clients/client-payments-screen';

export default function ClientPaymentsRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <ClientPaymentsScreen clientId={clientId ?? ''} />
    </ProtectedRoute>
  );
}