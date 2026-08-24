import React from 'react';

import { TrainerRoute } from '@/components/auth/auth-route';
import { ClientListScreen } from '@/screens/clients/client-list-screen';

export default function ClientesTab() {
  return (
    <TrainerRoute>
      <ClientListScreen />
    </TrainerRoute>
  );
}
