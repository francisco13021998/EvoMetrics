import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { RevisionFormScreen } from '@/screens/revisions/revision-form-screen';

export default function NewRevisionRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <RevisionFormScreen mode="create" clientId={clientId} />
    </ProtectedRoute>
  );
}