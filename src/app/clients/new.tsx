import { TrainerRoute } from '@/components/auth/auth-route';
import { ClientFormScreen } from '@/screens/clients/client-form-screen';

export default function NewClientRoute() {
  return (
    <TrainerRoute>
      <ClientFormScreen mode="create" />
    </TrainerRoute>
  );
}