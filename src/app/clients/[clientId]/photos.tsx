import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientPhotosScreen } from '@/screens/clients/client-photos-screen';

export default function ClientPhotosRoute() {
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <ClientPhotosScreen clientId={clientId ?? ''} />
    </ProtectedRoute>
  );
}