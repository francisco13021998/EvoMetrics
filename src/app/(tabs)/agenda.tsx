import React from 'react';

import { TrainerRoute } from '@/components/auth/auth-route';
import { AgendaScreen } from '@/screens/agenda/agenda-screen';

export default function AgendaTab() {
  return (
    <TrainerRoute>
      <AgendaScreen />
    </TrainerRoute>
  );
}
