import { useLocalSearchParams } from 'expo-router';

import { TrainerRoute } from '@/components/auth/auth-route';
import { ClientPaymentsScreen } from '@/screens/clients/client-payments-screen';

export default function ClientPaymentsRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <TrainerRoute>
      <ClientPaymentsScreen clientId={clientId ?? ''} />
    </TrainerRoute>
  );
}