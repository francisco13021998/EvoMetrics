import React from 'react';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { ClientListScreen } from '@/screens/clients/client-list-screen';

export default function ClientesTab() {
  return (
    <ProtectedRoute>
      <ClientListScreen />
    </ProtectedRoute>
  );
}
