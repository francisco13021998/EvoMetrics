import { ProtectedRoute } from '@/components/auth/auth-route';
import { EventFormScreen } from '@/screens/events/event-form-screen';

export default function NewEventRoute() {
  return (
    <ProtectedRoute>
      <EventFormScreen mode="create" />
    </ProtectedRoute>
  );
}