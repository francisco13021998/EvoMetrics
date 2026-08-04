import React from 'react';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { AgendaScreen } from '@/screens/agenda/agenda-screen';

export default function AgendaTab() {
  return (
    <ProtectedRoute>
      <AgendaScreen />
    </ProtectedRoute>
  );
}
