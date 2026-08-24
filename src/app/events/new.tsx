import { TrainerRoute } from '@/components/auth/auth-route';
import { EventFormScreen } from '@/screens/events/event-form-screen';

export default function NewEventRoute() {
  return (
    <TrainerRoute>
      <EventFormScreen mode="create" />
    </TrainerRoute>
  );
}