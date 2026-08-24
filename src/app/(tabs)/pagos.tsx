import React from 'react';

import { TrainerRoute } from '@/components/auth/auth-route';
import { PaymentsScreen } from '@/screens/payments/payments-screen';

export default function PagosTab() {
  return (
    <TrainerRoute>
      <PaymentsScreen />
    </TrainerRoute>
  );
}
