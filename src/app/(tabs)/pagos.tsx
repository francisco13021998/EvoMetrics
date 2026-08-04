import React from 'react';

import { ProtectedRoute } from '@/components/auth/auth-route';
import { PaymentsScreen } from '@/screens/payments/payments-screen';

export default function PagosTab() {
  return (
    <ProtectedRoute>
      <PaymentsScreen />
    </ProtectedRoute>
  );
}
