import { Client, ClientPayment, Revision } from '@/types/domain';

import { calculateClientPaymentStatus } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';

export type DashboardNotificationKind = 'payment' | 'revision';

export type DashboardNotificationItem = {
  kind: DashboardNotificationKind;
  clientId: string;
  clientName: string;
  lastDate: string | null;
  nextDate: string | null;
};

export type ClientDashboardData = {
  client: Client;
  payments: ClientPayment[];
  revisions: Revision[];
};

export function buildDashboardNotifications(clientData: ClientDashboardData[], referenceDate = new Date()) {
  return clientData.flatMap(({ client, payments, revisions }) => {
    const paymentStatus = calculateClientPaymentStatus(client, payments, referenceDate);
    const revisionStatus = calculateClientRevisionStatus(client, revisions, referenceDate);
    const items: DashboardNotificationItem[] = [];

    if (paymentStatus.isPending) {
      items.push({
        kind: 'payment',
        clientId: client.id,
        clientName: client.name,
        lastDate: paymentStatus.lastPaymentDate ? paymentStatus.lastPaymentDate.toISOString() : null,
        nextDate: paymentStatus.nextPaymentDate ? paymentStatus.nextPaymentDate.toISOString() : null,
      });
    }

    if (revisionStatus.isPending) {
      items.push({
        kind: 'revision',
        clientId: client.id,
        clientName: client.name,
        lastDate: revisionStatus.lastRevisionDate ? revisionStatus.lastRevisionDate.toISOString() : null,
        nextDate: revisionStatus.nextRevisionDate ? revisionStatus.nextRevisionDate.toISOString() : null,
      });
    }

    return items;
  });
}

export function formatDashboardNotificationDate(value: string | null) {
  if (!value) {
    return 'Sin datos';
  }

  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}