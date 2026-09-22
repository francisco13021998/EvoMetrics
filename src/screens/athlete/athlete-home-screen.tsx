import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { ScreenContainer } from '@/components/layout/screen-container';
import { AthleteCalendar, AthleteCalendarItem } from '@/components/surface/athlete-calendar';
import { RevisionRow } from '@/components/surface/revision-row';
import { ThemedText } from '@/components/themed-text';
import { formatAthleteLevelLabel } from '@/constants/athlete-level';
import { Accent, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { eventsService } from '@/services/events';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPayment, Event, EventOccurrence, Revision } from '@/types/domain';
import { formatClientAge } from '@/utils/client-age';
import { calculateClientPaymentStatus } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';

const REVISIONS_PER_PAGE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  return '-';
}

function isoToLocalDay(value: string) {
  const parsed = new Date(value);
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function formatDate(value: Date) {
  return value.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Trend = 'good' | 'bad' | 'neutral';

function buildDelta(current: number | null, previous: number | null, unit: string, lowerIsBetter: boolean | null) {
  if (current === null || previous === null) {
    return null;
  }

  const diff = Math.round((current - previous) * 10) / 10;

  if (diff === 0) {
    return { label: 'Sin cambios', trend: 'neutral' as Trend, icon: 'remove' as const };
  }

  const trend: Trend = lowerIsBetter === null ? 'neutral' : (diff < 0) === lowerIsBetter ? 'good' : 'bad';

  return {
    label: `${diff > 0 ? '+' : ''}${diff.toLocaleString('es-ES')} ${unit}`,
    trend,
    icon: (diff > 0 ? 'arrow-up' : 'arrow-down') as 'arrow-up' | 'arrow-down',
  };
}

const TREND_COLOR: Record<Trend, string> = {
  good: '#1FA971',
  bad: '#DC5B5B',
  neutral: '#6D7E98',
};

type KpiCardProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  delta: ReturnType<typeof buildDelta>;
};

function KpiCard({ icon, label, value, delta }: KpiCardProps) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${delta ? `, ${delta.label}` : ''}`} style={styles.kpiCard}>
      <View style={styles.kpiIcon}>
        <Ionicons name={icon} size={17} color={Accent.primary} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.kpiLabel}>{label}</ThemedText>
      <ThemedText style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</ThemedText>
      {delta ? (
        <View style={styles.kpiDelta}>
          <Ionicons name={delta.icon} size={12} color={TREND_COLOR[delta.trend]} />
          <ThemedText type="small" style={[styles.kpiDeltaText, { color: TREND_COLOR[delta.trend] }]}>{delta.label}</ThemedText>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.kpiDeltaText}>Sin comparativa</ThemedText>
      )}
    </View>
  );
}

export function AthleteHomeScreen() {
  const { user, signOut } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [revisionPage, setRevisionPage] = useState(1);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = await clientsService.getByAthleteUserId(user.id);
      setClient(nextClient);

      if (nextClient) {
        const [nextRevisions, nextPayments, nextEvents, nextOccurrences] = await Promise.all([
          revisionsService.listByClient(nextClient.id),
          // Pagos y eventos son secundarios: si las políticas de acceso no los permiten, el resto sigue funcionando.
          clientPaymentsService.listByClient(nextClient.id).catch(() => [] as ClientPayment[]),
          eventsService.listByClient(nextClient.id).catch(() => [] as Event[]),
          eventsService.listOccurrencesByClient(nextClient.id).catch(() => [] as EventOccurrence[]),
        ]);

        setRevisions(nextRevisions);
        setPayments(nextPayments);
        setEvents(nextEvents);
        setOccurrences(nextOccurrences);
        setRevisionPage(1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar tus datos.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  async function handleLogout() {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  const revisionStatus = useMemo(() => calculateClientRevisionStatus(client, revisions), [client, revisions]);
  const paymentStatus = useMemo(() => calculateClientPaymentStatus(client, payments), [client, payments]);

  const calendarItems = useMemo(() => {
    const items: AthleteCalendarItem[] = revisions.map((revision) => ({
      id: `revision-${revision.id}`,
      kind: 'revision-done',
      date: isoToLocalDay(revision.reviewedAt),
      title: 'Revisión realizada',
      subtitle: revision.weightKg ? `Peso: ${revision.weightKg} kg` : undefined,
    }));

    if (revisionStatus.nextRevisionDate) {
      items.push({
        id: 'revision-next',
        kind: 'revision-next',
        date: revisionStatus.nextRevisionDate,
        title: 'Próxima revisión',
        subtitle: revisionStatus.isPending ? 'Pendiente de realizar' : 'Programada por tu entrenador',
      });
    }

    if (client?.billingFrequency && paymentStatus.nextPaymentDate) {
      items.push({
        id: 'payment-next',
        kind: 'payment',
        date: paymentStatus.nextPaymentDate,
        title: 'Próximo pago',
        subtitle: paymentStatus.isPending ? 'Pendiente de pago' : 'Vencimiento de tu cuota',
      });
    }

    const eventById = new Map(events.map((event) => [event.id, event]));

    occurrences
      .filter((occurrence) => occurrence.status !== 'cancelled' && occurrence.status !== 'rescheduled')
      .forEach((occurrence) => {
        const event = eventById.get(occurrence.eventId);
        const start = new Date(occurrence.plannedStartAt);

        items.push({
          id: `event-${occurrence.id}`,
          kind: 'event',
          date: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
          title: event?.title ?? 'Evento',
          subtitle: `${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${event?.location ? ` · ${event.location}` : ''}`,
        });
      });

    return items;
  }, [client?.billingFrequency, events, occurrences, paymentStatus, revisionStatus, revisions]);

  if (isLoading && !client) {
    return (
      <ScreenContainer>
        <StatusBanner tone="info" loading message="Cargando tu perfil..." />
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <StatusBanner tone="danger" message={errorMessage} />
        <AppButton label="Reintentar" variant="secondary" onPress={() => void loadData()} />
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Perfil no encontrado"
          description="No se encontró un perfil vinculado a tu cuenta. Contacta con tu entrenador."
          actionLabel="Cerrar sesión"
          onAction={() => { void handleLogout(); }}
        />
      </ScreenContainer>
    );
  }

  const latest = revisions[0] ?? null;
  const previous = revisions[1] ?? null;
  const totalPages = Math.max(1, Math.ceil(revisions.length / REVISIONS_PER_PAGE));
  const currentPage = Math.min(revisionPage, totalPages);
  const pageStart = (currentPage - 1) * REVISIONS_PER_PAGE;
  const pageRevisions = revisions.slice(pageStart, pageStart + REVISIONS_PER_PAGE);
  const canGoBack = currentPage > 1;
  const canGoForward = currentPage < totalPages;

  const daysToNextRevision = revisionStatus.nextRevisionDate
    ? Math.round((revisionStatus.nextRevisionDate.getTime() - revisionStatus.referenceDate.getTime()) / DAY_MS)
    : null;
  const nextRevisionLabel = !revisionStatus.isConfigured
    ? 'Sin frecuencia definida'
    : revisionStatus.isPending
      ? 'Revisión pendiente'
      : daysToNextRevision === 0
        ? 'Tu revisión es hoy'
        : `Próxima revisión en ${daysToNextRevision} ${daysToNextRevision === 1 ? 'día' : 'días'}`;
  const nextRevisionTone = revisionStatus.isPending ? '#D97706' : '#1FA971';

  const firstName = client.name.trim().split(/\s+/)[0];
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 20 ? 'Buenas tardes' : 'Buenas noches';

  const summaryItems = [
    { label: 'Sexo', value: formatSex(client.sex) },
    { label: 'Edad', value: formatClientAge(client) },
    { label: 'Altura', value: client.heightCm ? `${client.heightCm} cm` : '-' },
  ];

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBrand}>
            <Ionicons name="pulse" size={16} color="#BFD3F7" />
            <ThemedText type="label" style={styles.heroBrandText}>Mi resumen</ThemedText>
          </View>
          <Pressable
            onPress={() => { void handleLogout(); }}
            disabled={isSigningOut}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText type="small" style={styles.heroGreeting}>{greeting},</ThemedText>
          <ThemedText style={styles.heroName} numberOfLines={1} adjustsFontSizeToFit>{firstName}</ThemedText>
        </View>

        <View style={styles.heroChips}>
          <View style={styles.heroChip}>
            <Ionicons name="ribbon-outline" size={13} color="#FFFFFF" />
            <ThemedText type="small" style={styles.heroChipText}>{formatAthleteLevelLabel(client.athleteLevel)}</ThemedText>
          </View>
          <View style={styles.heroChip}>
            <Ionicons name="calendar-outline" size={13} color="#FFFFFF" />
            <ThemedText type="small" style={styles.heroChipText}>
              {latest ? `Última: ${formatDate(isoToLocalDay(latest.reviewedAt))}` : 'Sin revisiones'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.nextRevisionBanner}>
          <View style={[styles.nextRevisionDot, { backgroundColor: nextRevisionTone }]} />
          <ThemedText type="smallBold" style={styles.nextRevisionText}>{nextRevisionLabel}</ThemedText>
          {revisionStatus.nextRevisionDate ? (
            <ThemedText type="small" style={styles.nextRevisionDate}>{formatDate(revisionStatus.nextRevisionDate)}</ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.summaryRow}>
        {summaryItems.map((item) => (
          <View key={item.label} style={styles.summaryItem}>
            <ThemedText type="small" themeColor="textSecondary">{item.label}</ThemedText>
            <ThemedText type="smallBold" style={styles.summaryValue}>{item.value}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Mi composición</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{latest ? 'Última revisión' : 'Sin datos'}</ThemedText>
      </View>
      <View style={styles.kpiGrid}>
        <KpiCard
          icon="scale-outline"
          label="Peso"
          value={latest?.weightKg != null ? `${latest.weightKg} kg` : '-'}
          delta={buildDelta(latest?.weightKg ?? null, previous?.weightKg ?? null, 'kg', null)}
        />
        <KpiCard
          icon="water-outline"
          label="% graso"
          value={latest?.bodyFatPct != null ? `${latest.bodyFatPct.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : '-'}
          delta={buildDelta(latest?.bodyFatPct ?? null, previous?.bodyFatPct ?? null, '%', true)}
        />
        <KpiCard
          icon="barbell-outline"
          label="Masa magra"
          value={latest?.leanMassKg != null ? `${latest.leanMassKg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg` : '-'}
          delta={buildDelta(latest?.leanMassKg ?? null, previous?.leanMassKg ?? null, 'kg', false)}
        />
        <KpiCard
          icon="flame-outline"
          label="Masa grasa"
          value={latest?.fatMassKg != null ? `${latest.fatMassKg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg` : '-'}
          delta={buildDelta(latest?.fatMassKg ?? null, previous?.fatMassKg ?? null, 'kg', true)}
        />
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => router.push(`/clients/${client.id}/photos`)}
          accessibilityRole="button"
          accessibilityLabel="Ver mis fotos de progreso"
          style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
          <View style={styles.actionIcon}><Ionicons name="images-outline" size={22} color={Accent.primary} /></View>
          <View style={styles.actionCopy}>
            <ThemedText type="smallBold" style={styles.actionTitle}>Fotos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Mi progreso visual</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9DB0D1" />
        </Pressable>
        <Pressable
          onPress={() => router.push(`/clients/${client.id}/metrics`)}
          accessibilityRole="button"
          accessibilityLabel="Ver mi análisis de evolución"
          style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
          <View style={styles.actionIcon}><Ionicons name="stats-chart-outline" size={22} color={Accent.primary} /></View>
          <View style={styles.actionCopy}>
            <ThemedText type="smallBold" style={styles.actionTitle}>Análisis</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Mi evolución</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9DB0D1" />
        </Pressable>
      </View>

      <AthleteCalendar items={calendarItems} />

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Revisiones</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {revisions.length} {revisions.length === 1 ? 'revisión' : 'revisiones'}
        </ThemedText>
      </View>

      <View style={styles.revisionsPanel}>
        {revisions.length === 0 ? (
          <View style={styles.emptyRevisions}>
            <ThemedText type="small" themeColor="textSecondary">Sin revisiones registradas todavía.</ThemedText>
          </View>
        ) : (
          pageRevisions.map((revision, index) => (
            <RevisionRow
              key={revision.id}
              phase={revision.phase}
              date={new Date(revision.reviewedAt).toLocaleDateString('es-ES')}
              weight={revision.weightKg ? `${revision.weightKg} kg` : '-'}
              onPress={() => router.push(`/revisions/${revision.id}`)}
              last={index === pageRevisions.length - 1}
            />
          ))
        )}
      </View>

      {revisions.length > REVISIONS_PER_PAGE ? (
        <View style={styles.pagination} accessibilityLabel={`Página ${currentPage} de ${totalPages}`}>
          <Pressable
            onPress={() => setRevisionPage(Math.max(1, currentPage - 1))}
            disabled={!canGoBack}
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
            accessibilityState={{ disabled: !canGoBack }}
            hitSlop={8}
            style={({ pressed }) => [styles.paginationButton, !canGoBack && styles.paginationButtonDisabled, pressed && canGoBack && styles.pressed]}>
            <Ionicons name="chevron-back" size={19} color={canGoBack ? Accent.primary : '#9AA5B5'} />
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.paginationText}>
            {pageStart + 1}-{pageStart + pageRevisions.length} de {revisions.length}
          </ThemedText>

          <Pressable
            onPress={() => setRevisionPage(Math.min(totalPages, currentPage + 1))}
            disabled={!canGoForward}
            accessibilityRole="button"
            accessibilityLabel="Página siguiente"
            accessibilityState={{ disabled: !canGoForward }}
            hitSlop={8}
            style={({ pressed }) => [styles.paginationButton, !canGoForward && styles.paginationButtonDisabled, pressed && canGoForward && styles.pressed]}>
            <Ionicons name="chevron-forward" size={19} color={canGoForward ? Accent.primary : '#9AA5B5'} />
          </Pressable>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  hero: {
    borderRadius: 26,
    backgroundColor: Accent.primary,
    padding: 18,
    gap: 14,
    shadowColor: '#12336E',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBrandText: {
    color: '#BFD3F7',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    gap: 0,
  },
  heroGreeting: {
    color: '#D6E4FF',
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  heroChipText: {
    color: '#FFFFFF',
  },
  nextRevisionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nextRevisionDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  nextRevisionText: {
    flex: 1,
    color: '#10203B',
  },
  nextRevisionDate: {
    color: '#6D7E98',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.medium,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  summaryValue: {
    color: '#10203B',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.5%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 4,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kpiLabel: {
    lineHeight: 16,
  },
  kpiValue: {
    color: '#10203B',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  kpiDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiDeltaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: '#10203B',
  },
  revisionsPanel: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  emptyRevisions: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pagination: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  paginationButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8E4F6',
    backgroundColor: '#FFFFFF',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F6F8FB',
    borderColor: '#E4EAF2',
  },
  paginationText: {
    minWidth: 76,
    textAlign: 'center',
  },
});
