import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { RevisionDetailScreen } from '@/screens/revisions/revision-detail-screen';

export default function RevisionDetailRoute() {
  const params = useLocalSearchParams<{ revisionId?: string | string[] }>();
  const revisionId = Array.isArray(params.revisionId) ? params.revisionId[0] : params.revisionId;

  return (
    <ProtectedRoute>
      <RevisionDetailScreen revisionId={revisionId ?? 'revision-1'} />
    </ProtectedRoute>
  );
}