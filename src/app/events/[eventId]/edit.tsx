import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { EventFormScreen } from '@/screens/events/event-form-screen';

export default function EditEventRoute() {
  const params = useLocalSearchParams<{ eventId?: string | string[]; clientId?: string | string[] }>();
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

  return (
    <ProtectedRoute>
      <EventFormScreen mode="edit" eventId={eventId} clientId={clientId} />
    </ProtectedRoute>
  );
}