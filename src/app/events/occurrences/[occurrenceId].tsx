import { useLocalSearchParams } from 'expo-router';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { EventOccurrenceDetailScreen } from '@/screens/events/event-occurrence-detail-screen';

export default function EventOccurrenceRoute() {
  const params = useLocalSearchParams<{ occurrenceId?: string | string[] }>();
  const occurrenceId = Array.isArray(params.occurrenceId) ? params.occurrenceId[0] : params.occurrenceId;

  return (
    <ProtectedRoute>
      <EventOccurrenceDetailScreen occurrenceId={occurrenceId} />
    </ProtectedRoute>
  );
}