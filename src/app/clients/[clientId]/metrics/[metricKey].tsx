import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientHistoryMetricDetailScreen } from '@/screens/clients/client-history-metric-detail-screen';

export default function ClientMetricDetailRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[]; metricKey?: string | string[]; preparation?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const metricKey = Array.isArray(params.metricKey) ? params.metricKey[0] : params.metricKey;
  const preparationId = Array.isArray(params.preparation) ? params.preparation[0] : params.preparation;

  return (
    <ProtectedRoute>
      <ClientHistoryMetricDetailScreen clientId={clientId ?? ''} metricKey={metricKey ?? ''} preparationId={preparationId ?? null} />
    </ProtectedRoute>
  );
}
