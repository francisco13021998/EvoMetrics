import { useLocalSearchParams } from 'expo-router';

import { TrainerRoute } from '@/components/auth/auth-route';
import { RevisionFormScreen } from '@/screens/revisions/revision-form-screen';

export default function NewRevisionRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <TrainerRoute>
      <RevisionFormScreen mode="create" clientId={clientId} />
    </TrainerRoute>
  );
}