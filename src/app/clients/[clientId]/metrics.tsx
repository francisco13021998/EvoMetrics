import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientHistoryAnalysisScreen } from '@/screens/clients/client-history-analysis-screen';

export default function ClientMetricsRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <ClientHistoryAnalysisScreen clientId={clientId ?? ''} />
    </ProtectedRoute>
  );
}