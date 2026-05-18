import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientPhotosScreen } from '@/screens/clients/client-photos-screen';

export default function ClientPhotosRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[]; revisionId?: string | string[]; openUpload?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const revisionId = Array.isArray(params.revisionId) ? params.revisionId[0] : params.revisionId;
  const openUpload = Array.isArray(params.openUpload) ? params.openUpload[0] : params.openUpload;

  return (
    <ProtectedRoute>
      <ClientPhotosScreen
        clientId={clientId ?? ''}
        initialRevisionId={revisionId ?? null}
        autoOpenUpload={openUpload === '1' || openUpload === 'true'}
      />
    </ProtectedRoute>
  );
}