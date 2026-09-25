import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { StatusBanner } from '@/components/feedback/status-banner';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { BillingFrequency, Client, ClientPayment } from '@/types/domain';
import { calculateClientPaymentStatus, ClientPaymentStatus, formatBillingFrequencyLabel } from '@/utils/client-payments';

type PaymentsClientData = {
  client: Client;
  payments: ClientPayment[];
  paymentStatus: ClientPaymentStatus;
};

type TrendPoint = {
  label: string;
  shortLabel: string;
  value: number;
};

type PaymentEntry = {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentDate: string;
  frequency: BillingFrequency;
};

type PaymentSectionView = 'history' | 'pending' | 'upcoming';

function isPaymentSectionView(value: string | string[] | undefined): value is PaymentSectionView {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === 'history' || normalized === 'pending' || normalized === 'upcoming';
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1, 0, 0, 0, 0);
}

function getMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function parseDateOnly(value: string) {
  const parsed = new Date(value);
  return startOfDay(parsed);
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString('es-ES')} €`;
}

function formatShortDate(value: string) {
  return parseDateOnly(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMonthShort(value: Date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'short' })
    .format(value)
    .replace('.', '')
    .replace(/^(.)/, (match) => match.toUpperCase());
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getPercentChange(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function buildMonthlyTrend(entries: PaymentEntry[], referenceDate: Date) {
  const currentMonth = startOfMonth(referenceDate);
  const months = Array.from({ length: 6 }, (_, index) => addMonths(currentMonth, index - 5));
  const totals = new Map<string, number>();

  entries.forEach((entry) => {
    const paymentDate = parseDateOnly(entry.paymentDate);
    const monthKey = getMonthKey(paymentDate);
    totals.set(monthKey, (totals.get(monthKey) ?? 0) + entry.amount);
  });

  return months.map((month) => {
    const monthKey = getMonthKey(month);

    return {
      label: formatLongDate(month).split(' ')[1],
      shortLabel: formatMonthShort(month),
      value: totals.get(monthKey) ?? 0,
    } satisfies TrendPoint;
  });
}

function resolveTrendPath(points: TrendPoint[], width: number) {
  const chartWidth = Math.max(width, 240);
  const chartHeight = 150;
  const topPadding = 14;
  const bottomPadding = 28;
  const horizontalPadding = 10;
  const drawableWidth = chartWidth - (horizontalPadding * 2);
  const drawableHeight = chartHeight - topPadding - bottomPadding;
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || Math.max(Math.abs(maximum) * 0.08, 1);
  const paddedMin = minimum - (span * 0.12);
  const paddedMax = maximum + (span * 0.12);
  const range = paddedMax - paddedMin || 1;
  const stepX = points.length > 1 ? drawableWidth / (points.length - 1) : drawableWidth;

  const resolvedPoints = points.map((point, index) => {
    const normalized = (point.value - paddedMin) / range;
    return {
      ...point,
      x: horizontalPadding + (stepX * index),
      y: topPadding + drawableHeight - (normalized * drawableHeight),
    };
  });

  const linePath = resolvedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const baseY = topPadding + drawableHeight;
  const fillPath = resolvedPoints.length > 0
    ? `${linePath} L ${resolvedPoints[resolvedPoints.length - 1].x} ${baseY} L ${resolvedPoints[0].x} ${baseY} Z`
    : '';

  return {
    chartWidth,
    chartHeight,
    resolvedPoints,
    linePath,
    fillPath,
    baseY,
    labelY: chartHeight - 6,
  };
}

function PaymentTrendCard({ points, currentValueLabel, deltaLabel, deltaColor }: {
  points: TrendPoint[];
  currentValueLabel: string;
  deltaLabel: string;
  deltaColor: string;
}) {
  const { width } = useWindowDimensions();
  const chart = useMemo(() => resolveTrendPath(points, Math.min(width - (Spacing.four * 2), 430)), [points, width]);

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendHeaderCopy}>
          <ThemedText type="label" style={styles.trendLabel}>Tendencia mensual</ThemedText>
          <ThemedText style={styles.trendValue}>{currentValueLabel}</ThemedText>
        </View>
        <View style={[styles.trendBadge, { backgroundColor: deltaColor === Accent.success ? '#EAF8EF' : '#FFF4E9' }]}>
          <Ionicons name={deltaColor === Accent.success ? 'trending-up' : 'trending-down'} size={14} color={deltaColor} />
          <ThemedText type="smallBold" style={{ color: deltaColor }}>{deltaLabel}</ThemedText>
        </View>
      </View>

      <View style={styles.chartWrap}>
        <Svg width={chart.chartWidth} height={chart.chartHeight}>
          {chart.fillPath ? <Path d={chart.fillPath} fill="rgba(33, 100, 255, 0.10)" /> : null}
          {chart.linePath ? <Path d={chart.linePath} fill="none" stroke={Accent.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}

          {chart.resolvedPoints.map((point) => (
            <React.Fragment key={`${point.shortLabel}-${point.x}`}>
              <SvgText
                x={point.x}
                y={point.y - 10}
                fill="#4A5E81"
                fontSize="11"
                textAnchor="middle">
                {formatMoney(point.value)}
              </SvgText>
              <Circle cx={point.x} cy={point.y} r={4.5} fill="#FFFFFF" stroke={Accent.primary} strokeWidth={2.5} />
              <SvgText
                x={point.x}
                y={chart.labelY}
                fill="#4A5E81"
                fontSize="11"
                textAnchor="middle">
                {point.shortLabel}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </View>
    </View>
  );
}

function SummaryMetricCard({ icon, iconColor, iconBackground, label, value }: {
  icon: React.ReactNode;
  iconColor: string;
  iconBackground: string;
  label: string;
  value: string;
}) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.metricCard}>
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIcon, { backgroundColor: iconBackground }]}>
          {icon}
        </View>
        <ThemedText style={[styles.metricValue, { color: iconColor }]}>{value}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.metricLabel}>{label}</ThemedText>
    </View>
  );
}

function PaymentSectionHeader({ title, actionLabel, onPress }: { title: string; actionLabel: string; onPress?: () => void; }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="smallBold" style={styles.sectionAction}>{actionLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

export function PaymentsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const [clientData, setClientData] = useState<PaymentsClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sectionPage, setSectionPage] = useState(1);

  const loadContent = useCallback(async () => {
    if (!user?.id) {
      setClientData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClients = await clientsService.listByOwner(user.id);
      const nextClientData = await Promise.all(
        nextClients.map(async (client) => {
          const payments = await clientPaymentsService.listByClient(client.id);
          const paymentStatus = calculateClientPaymentStatus(client, payments, new Date());

          return {
            client,
            payments,
            paymentStatus,
          } satisfies PaymentsClientData;
        })
      );

      setClientData(nextClientData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los pagos.';
      setErrorMessage(message);
      setClientData([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadContent();
    }, [loadContent])
  );

  const today = useMemo(() => startOfDay(new Date()), []);
  const paymentEntries = useMemo<PaymentEntry[]>(() => {
    return clientData.flatMap(({ client, payments }) => payments.map((payment) => ({
      id: payment.id,
      clientId: client.id,
      clientName: client.name,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      frequency: client.billingFrequency,
    })));
  }, [clientData]);

  const paymentSnapshots = useMemo(() => {
    return clientData.map(({ client, payments, paymentStatus }) => ({ client, payments, paymentStatus }));
  }, [clientData]);

  const currentMonthRevenue = useMemo(() => {
    const currentMonthKey = getMonthKey(today);

    return paymentEntries.reduce((total, payment) => {
      const monthKey = getMonthKey(parseDateOnly(payment.paymentDate));
      return monthKey === currentMonthKey ? total + payment.amount : total;
    }, 0);
  }, [paymentEntries, today]);

  const previousMonthRevenue = useMemo(() => {
    const previousMonthKey = getMonthKey(addMonths(startOfMonth(today), -1));

    return paymentEntries.reduce((total, payment) => {
      const monthKey = getMonthKey(parseDateOnly(payment.paymentDate));
      return monthKey === previousMonthKey ? total + payment.amount : total;
    }, 0);
  }, [paymentEntries, today]);

  const monthlyTrend = useMemo(() => buildMonthlyTrend(paymentEntries, today), [paymentEntries, today]);
  const trendDeltaValue = getPercentChange(currentMonthRevenue, previousMonthRevenue);
  const trendDeltaLabel = trendDeltaValue >= 0 ? `▲ ${Math.round(trendDeltaValue)}% vs. mes anterior` : `▼ ${Math.abs(Math.round(trendDeltaValue))}% vs. mes anterior`;
  const trendDeltaColor = trendDeltaValue >= 0 ? Accent.success : Accent.warning;

  const pendingClients = useMemo(() => {
    return paymentSnapshots
      .filter(({ paymentStatus }) => paymentStatus.isPending)
      .map(({ client, paymentStatus }) => ({ client, paymentStatus }))
      .sort((left, right) => {
        const leftDate = left.paymentStatus.nextPaymentDate?.getTime() ?? 0;
        const rightDate = right.paymentStatus.nextPaymentDate?.getTime() ?? 0;
        return rightDate - leftDate;
      });
  }, [paymentSnapshots]);

  const upcomingClients = useMemo(() => {
    return paymentSnapshots
      .filter(({ paymentStatus }) => paymentStatus.nextPaymentDate !== null && !paymentStatus.isPending)
      .map(({ client, paymentStatus }) => ({ client, paymentStatus }))
      .filter(({ paymentStatus }) => paymentStatus.nextPaymentDate !== null && paymentStatus.nextPaymentDate! > today)
      .sort((left, right) => {
        const leftDate = left.paymentStatus.nextPaymentDate?.getTime() ?? 0;
        const rightDate = right.paymentStatus.nextPaymentDate?.getTime() ?? 0;
        return rightDate - leftDate;
      });
  }, [paymentSnapshots, today]);

  const filteredPaymentEntries = paymentEntries;
  const filteredPendingClients = pendingClients;
  const filteredUpcomingClients = upcomingClients;

  const sortedHistoryEntries = useMemo(() => {
    return [...filteredPaymentEntries].sort((left, right) => {
      const leftDate = parseDateOnly(left.paymentDate).getTime();
      const rightDate = parseDateOnly(right.paymentDate).getTime();
      return rightDate - leftDate;
    });
  }, [filteredPaymentEntries]);

  const metrics = useMemo(() => {
    const pendingTotal = filteredPendingClients.reduce((total, item) => total + item.client.coachingPrice, 0);
    const upcomingTotal = filteredUpcomingClients.reduce((total, item) => total + item.client.coachingPrice, 0);

    return {
      currentMonthRevenue,
      pendingTotal,
      upcomingTotal,
    };
  }, [currentMonthRevenue, filteredPendingClients, filteredUpcomingClients]);

  function openClientPayments(clientId: string) {
    router.push(`/clients/${clientId}/payments`);
  }

  function goToClients() {
    router.push('/clients');
  }

  function goToSection(section: PaymentSectionView) {
    router.push(`/pagos?section=${section}`);
  }

  function goToOverview() {
    router.push('/pagos');
  }

  const activeSection = isPaymentSectionView(params.section) ? params.section : null;
  const isSectionView = activeSection !== null;
  const sectionTitle = activeSection === 'history'
    ? 'Historial de pagos'
    : activeSection === 'pending'
      ? 'Pendientes'
      : activeSection === 'upcoming'
        ? 'Próximos pagos'
        : 'Pagos';
  const headerAction = isSectionView ? 'Resumen' : 'Clientes';
  const onHeaderActionPress = isSectionView ? goToOverview : goToClients;

  useEffect(() => {
    setSectionPage(1);
  }, [activeSection]);

  const activeSectionItems = useMemo(() => {
    if (activeSection === 'history') {
      return sortedHistoryEntries.map((entry) => ({
        id: entry.id,
        clientId: entry.clientId,
        clientName: entry.clientName,
        amount: entry.amount,
        dateLabel: formatShortDate(entry.paymentDate),
        secondaryLabel: formatBillingFrequencyLabel(entry.frequency),
        dateValue: parseDateOnly(entry.paymentDate).getTime(),
        kind: 'history' as const,
      }));
    }

    if (activeSection === 'pending') {
      return filteredPendingClients.map(({ client, paymentStatus }) => ({
        id: client.id,
        clientId: client.id,
        clientName: client.name,
        amount: client.coachingPrice,
        dateLabel: paymentStatus.nextPaymentDate ? formatShortDate(paymentStatus.nextPaymentDate.toISOString()) : 'Sin fecha',
        secondaryLabel: paymentStatus.nextPaymentDate ? `Vence el ${formatShortDate(paymentStatus.nextPaymentDate.toISOString())}` : 'Sin fecha',
        dateValue: paymentStatus.nextPaymentDate?.getTime() ?? 0,
        kind: 'pending' as const,
      }));
    }

    if (activeSection === 'upcoming') {
      return filteredUpcomingClients.map(({ client, paymentStatus }) => ({
        id: client.id,
        clientId: client.id,
        clientName: client.name,
        amount: client.coachingPrice,
        dateLabel: paymentStatus.nextPaymentDate ? formatShortDate(paymentStatus.nextPaymentDate.toISOString()) : 'Sin fecha',
        secondaryLabel: paymentStatus.nextPaymentDate ? `Cargo el ${formatShortDate(paymentStatus.nextPaymentDate.toISOString())}` : 'Sin fecha',
        dateValue: paymentStatus.nextPaymentDate?.getTime() ?? 0,
        kind: 'upcoming' as const,
      }));
    }

    return [];
  }, [activeSection, filteredPendingClients, filteredUpcomingClients, sortedHistoryEntries]);

  const itemsPerPage = 10;
  const totalSectionPages = Math.max(1, Math.ceil(activeSectionItems.length / itemsPerPage));
  const currentSectionPage = Math.min(sectionPage, totalSectionPages);
  const sectionPageItems = activeSectionItems.slice((currentSectionPage - 1) * itemsPerPage, currentSectionPage * itemsPerPage);
  const sectionHasPagination = activeSectionItems.length > itemsPerPage;

  function goToPreviousSectionPage() {
    setSectionPage((current) => Math.max(1, current - 1));
  }

  function goToNextSectionPage() {
    setSectionPage((current) => Math.min(totalSectionPages, current + 1));
  }

  const hasResults = sortedHistoryEntries.length > 0 || filteredPendingClients.length > 0 || filteredUpcomingClients.length > 0;
  const renderHistoryPreview = () => (
    <View style={styles.sectionCard}>
      <PaymentSectionHeader title="Historial de pagos" actionLabel="Ver todos" onPress={() => goToSection('history')} />

      {isLoading ? (
        <StatusBanner tone="info" loading message="Sincronizando pagos." />
      ) : sortedHistoryEntries.length === 0 ? (
        <StatusBanner tone="info" message="Aún no hay pagos registrados." />
      ) : (
        <View style={styles.listShell}>
          {sortedHistoryEntries.slice(0, 4).map((entry, index) => (
            <Pressable
              key={entry.id}
              onPress={() => openClientPayments(entry.clientId)}
              accessibilityRole="button"
              accessibilityLabel={`${entry.clientName}, ${formatBillingFrequencyLabel(entry.frequency)}, ${formatMoney(entry.amount)}, ${formatShortDate(entry.paymentDate)}`}
              style={({ pressed }) => [styles.historyRow, index === Math.min(sortedHistoryEntries.length, 4) - 1 && styles.historyRowLast, pressed && styles.rowPressed]}>
              <View style={styles.avatarCircle}>
                <ThemedText type="smallBold" style={styles.avatarText}>{getInitials(entry.clientName) || 'P'}</ThemedText>
              </View>
              <View style={styles.rowCopy}>
                <ThemedText type="smallBold" style={styles.rowTitle} numberOfLines={1}>{entry.clientName}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{formatBillingFrequencyLabel(entry.frequency)}</ThemedText>
              </View>
              <View style={styles.rowMeta}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.rowDate}>{formatShortDate(entry.paymentDate)}</ThemedText>
                <ThemedText type="smallBold" style={styles.rowAmount}>{formatMoney(entry.amount)}</ThemedText>
                <View style={styles.statusPaidPill}>
                  <ThemedText type="smallBold" style={styles.statusPaidText}>Pagado</ThemedText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
  const renderPaymentQueues = () => (
    <View style={styles.dualGrid}>
      <View style={styles.sectionCardHalf}>
        <PaymentSectionHeader title="Pendientes" actionLabel="Ver todos" onPress={() => goToSection('pending')} />

        {isLoading ? (
          <StatusBanner tone="info" loading message="Sincronizando pagos." />
        ) : filteredPendingClients.length === 0 ? (
          <StatusBanner tone="info" message="No hay pagos pendientes." />
        ) : (
          <View style={styles.compactList}>
            {filteredPendingClients.slice(0, 3).map(({ client, paymentStatus }) => (
              <Pressable
                key={client.id}
                onPress={() => openClientPayments(client.id)}
                accessibilityRole="button"
                accessibilityLabel={`${client.name}, pago pendiente, ${formatMoney(client.coachingPrice)}`}
                style={({ pressed }) => [styles.compactRow, pressed && styles.rowPressed]}>
                <View style={styles.avatarCircleSmall}>
                  <ThemedText type="smallBold" style={styles.avatarText}>{getInitials(client.name) || 'C'}</ThemedText>
                </View>
                <View style={styles.rowCopySmall}>
                  <ThemedText type="smallBold" style={styles.rowTitleSmall} numberOfLines={1}>{client.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {paymentStatus.nextPaymentDate ? `Vence el ${formatShortDate(paymentStatus.nextPaymentDate.toISOString())}` : 'Sin fecha'}
                  </ThemedText>
                </View>
                <View style={styles.rowMetaSmall}>
                  <ThemedText type="smallBold" style={styles.rowAmountSmall}>{formatMoney(client.coachingPrice)}</ThemedText>
                  <View style={styles.statusPendingPill}>
                    <ThemedText type="smallBold" style={styles.statusPendingText}>Pendiente</ThemedText>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.sectionCardHalf}>
        <PaymentSectionHeader title="Próximos" actionLabel="Ver todos" onPress={() => goToSection('upcoming')} />

        {isLoading ? (
          <StatusBanner tone="info" loading message="Sincronizando pagos." />
        ) : filteredUpcomingClients.length === 0 ? (
          <StatusBanner tone="info" message="No hay próximos cobros." />
        ) : (
          <View style={styles.compactList}>
            {filteredUpcomingClients.slice(0, 3).map(({ client, paymentStatus }) => (
              <Pressable
                key={client.id}
                onPress={() => openClientPayments(client.id)}
                accessibilityRole="button"
                accessibilityLabel={`${client.name}, próximo pago, ${formatMoney(client.coachingPrice)}`}
                style={({ pressed }) => [styles.compactRow, pressed && styles.rowPressed]}>
                <View style={styles.avatarCircleSmall}>
                  <ThemedText type="smallBold" style={styles.avatarText}>{getInitials(client.name) || 'C'}</ThemedText>
                </View>
                <View style={styles.rowCopySmall}>
                  <ThemedText type="smallBold" style={styles.rowTitleSmall} numberOfLines={1}>{client.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {paymentStatus.nextPaymentDate ? formatShortDate(paymentStatus.nextPaymentDate.toISOString()) : 'Sin fecha'}
                  </ThemedText>
                </View>
                <View style={styles.rowMetaSmall}>
                  <ThemedText type="smallBold" style={styles.rowAmountSmall}>{formatMoney(client.coachingPrice)}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.headerPanel}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="card-outline" size={25} color={Accent.primary} />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText style={styles.title}>{sectionTitle}</ThemedText>
          </View>

          <Pressable
            onPress={onHeaderActionPress}
            style={({ pressed }) => [styles.headerActionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={headerAction}>
            <ThemedText type="smallBold" style={styles.headerActionText}>{headerAction}</ThemedText>
            <Ionicons name={isSectionView ? 'grid-outline' : 'people-outline'} size={17} color={Accent.primary} />
          </Pressable>
        </View>
      </View>

      {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

      {isSectionView ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderTop}>
            <View style={styles.sectionHeaderMeta}>
              <ThemedText type="small" themeColor="textSecondary">
                {activeSectionItems.length} resultados
              </ThemedText>
              <ThemedText type="smallBold" style={styles.sectionPageText}>
                Página {currentSectionPage} de {totalSectionPages}
              </ThemedText>
            </View>
          </View>

          {isLoading ? (
            <StatusBanner tone="info" loading message="Sincronizando pagos." />
          ) : activeSectionItems.length === 0 ? (
            <StatusBanner
              tone="info"
              message={
                activeSection === 'history'
                  ? 'Aún no hay pagos registrados.'
                  : activeSection === 'pending'
                    ? 'No hay pagos pendientes.'
                    : 'No hay próximos cobros.'
              }
            />
          ) : activeSection === 'history' ? (
            <View style={styles.listShell}>
              {sectionPageItems.map((entry, index) => (
                <Pressable
                  key={entry.id}
                  onPress={() => openClientPayments(entry.clientId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.clientName}, ${entry.secondaryLabel}, ${formatMoney(entry.amount)}, ${entry.dateLabel}`}
                  style={({ pressed }) => [styles.historyRow, index === sectionPageItems.length - 1 && styles.historyRowLast, pressed && styles.rowPressed]}>
                  <View style={styles.avatarCircle}>
                    <ThemedText type="smallBold" style={styles.avatarText}>{getInitials(entry.clientName) || 'P'}</ThemedText>
                  </View>
                  <View style={styles.rowCopy}>
                    <ThemedText type="smallBold" style={styles.rowTitle} numberOfLines={1}>{entry.clientName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{entry.secondaryLabel}</ThemedText>
                  </View>
                  <View style={styles.rowMeta}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.rowDate}>{entry.dateLabel}</ThemedText>
                    <ThemedText type="smallBold" style={styles.rowAmount}>{formatMoney(entry.amount)}</ThemedText>
                    <View style={styles.statusPaidPill}>
                      <ThemedText type="smallBold" style={styles.statusPaidText}>Pagado</ThemedText>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.compactList}>
              {sectionPageItems.map((entry, index) => (
                <Pressable
                  key={entry.id}
                  onPress={() => openClientPayments(entry.clientId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.clientName}, ${entry.secondaryLabel}, ${formatMoney(entry.amount)}`}
                  style={({ pressed }) => [styles.compactRow, index === sectionPageItems.length - 1 && styles.compactRowLast, pressed && styles.rowPressed]}>
                  <View style={styles.avatarCircleSmall}>
                    <ThemedText type="smallBold" style={styles.avatarText}>{getInitials(entry.clientName) || 'C'}</ThemedText>
                  </View>
                  <View style={styles.rowCopySmall}>
                    <ThemedText type="smallBold" style={styles.rowTitleSmall} numberOfLines={1}>{entry.clientName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{entry.secondaryLabel}</ThemedText>
                  </View>
                  <View style={styles.rowMetaSmall}>
                    <ThemedText type="smallBold" style={styles.rowAmountSmall}>{formatMoney(entry.amount)}</ThemedText>
                    {activeSection === 'pending' ? (
                      <View style={styles.statusPendingPill}>
                        <ThemedText type="smallBold" style={styles.statusPendingText}>Pendiente</ThemedText>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {sectionHasPagination ? (
            <View style={styles.paginationRow}>
              <Pressable
                onPress={goToPreviousSectionPage}
                disabled={currentSectionPage === 1}
                accessibilityRole="button"
                accessibilityLabel="Página anterior"
                accessibilityState={{ disabled: currentSectionPage === 1 }}
                style={({ pressed }) => [styles.paginationButton, currentSectionPage === 1 && styles.paginationButtonDisabled, pressed && currentSectionPage > 1 && styles.pressed]}>
                <ThemedText type="smallBold" style={[styles.paginationButtonText, currentSectionPage === 1 && styles.paginationButtonTextDisabled]}>
                  Anterior
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={goToNextSectionPage}
                disabled={currentSectionPage === totalSectionPages}
                accessibilityRole="button"
                accessibilityLabel="Página siguiente"
                accessibilityState={{ disabled: currentSectionPage === totalSectionPages }}
                style={({ pressed }) => [styles.paginationButton, currentSectionPage === totalSectionPages && styles.paginationButtonDisabled, pressed && currentSectionPage < totalSectionPages && styles.pressed]}>
                <ThemedText type="smallBold" style={[styles.paginationButtonText, currentSectionPage === totalSectionPages && styles.paginationButtonTextDisabled]}>
                  Siguiente
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.metricRow}>
            <SummaryMetricCard
              icon={<Ionicons name="cash" size={18} color="#1D4ED8" />}
              iconColor="#10203B"
              iconBackground="#EAF2FF"
              label="Ingresos del mes"
              value={formatMoney(metrics.currentMonthRevenue)}
            />
            <SummaryMetricCard
              icon={<Ionicons name="time" size={18} color="#EA580C" />}
              iconColor="#10203B"
              iconBackground="#FFF1E8"
              label="Pagos pendientes"
              value={formatMoney(metrics.pendingTotal)}
            />
            <SummaryMetricCard
              icon={<Ionicons name="calendar" size={18} color="#1D4ED8" />}
              iconColor="#10203B"
              iconBackground="#EAF2FF"
              label="Próximos pagos"
              value={formatMoney(metrics.upcomingTotal)}
            />
          </View>

          <PaymentTrendCard
            points={monthlyTrend}
            currentValueLabel={formatMoney(metrics.currentMonthRevenue)}
            deltaLabel={trendDeltaLabel}
            deltaColor={trendDeltaColor}
          />

          {renderPaymentQueues()}
          {renderHistoryPreview()}
        </>
      )}

      {!isLoading && !hasResults && !isSectionView ? (
        <StatusBanner tone="info" message="Aún no hay pagos para mostrar." />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  headerPanel: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    borderWidth: 1,
    borderColor: '#D2E0FA',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: '#10203B',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerActionButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4F6',
  },
  headerActionText: {
    color: Accent.primary,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 13,
    gap: 11,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    lineHeight: 16,
    color: '#607086',
  },
  metricValue: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  trendCard: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    width: '100%',
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  trendHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  trendLabel: {
    color: Accent.primary,
    lineHeight: 18,
  },
  trendValue: {
    color: '#10203B',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
    width: '100%',
  },
  sectionHeaderTop: {
    alignItems: 'flex-end',
  },
  sectionHeaderMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  sectionPageText: {
    color: '#10203B',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionAction: {
    color: Accent.primary,
  },
  listShell: {
    gap: 0,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 78,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF5',
  },
  rowPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.993 }],
  },
  historyRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D3E1FA',
  },
  avatarCircleSmall: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D3E1FA',
  },
  avatarText: {
    color: Accent.primary,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowCopySmall: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    color: '#10203B',
    fontSize: 16,
    lineHeight: 20,
  },
  rowTitleSmall: {
    color: '#10203B',
    fontSize: 15,
    lineHeight: 19,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowMetaSmall: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowDate: {
    lineHeight: 16,
    fontSize: 12,
  },
  rowAmount: {
    color: '#10203B',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
  },
  rowAmountSmall: {
    color: '#10203B',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '800',
  },
  statusPaidPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#C7EFDC',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPaidText: {
    color: '#14734C',
    fontSize: 11,
    lineHeight: 13,
  },
  dualGrid: {
    flexDirection: 'column',
    gap: 14,
    alignItems: 'stretch',
    width: '100%',
  },
  sectionCardHalf: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
    minWidth: 0,
  },
  compactList: {
    gap: 0,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF5',
  },
  compactRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  statusPendingPill: {
    backgroundColor: '#FFF7ED',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPendingText: {
    color: '#9A3412',
    fontSize: 11,
    lineHeight: 13,
  },
  paginationRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  paginationButton: {
    minWidth: 104,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4F6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  paginationButtonDisabled: {
    opacity: 0.45,
  },
  paginationButtonText: {
    color: Accent.primary,
  },
  paginationButtonTextDisabled: {
    color: '#8EA0B7',
  },
});
