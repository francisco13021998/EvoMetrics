import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { RevisionFormScreen } from '@/screens/revisions/revision-form-screen';

export default function EditRevisionRoute() {
  const params = useLocalSearchParams<{
    revisionId?: string | string[];
    clientId?: string | string[];
  }>();

  const revisionId = Array.isArray(params.revisionId) ? params.revisionId[0] : params.revisionId;
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <RevisionFormScreen mode="edit" revisionId={revisionId} clientId={clientId} />
    </ProtectedRoute>
  );
}