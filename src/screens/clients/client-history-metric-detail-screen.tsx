import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { HistoryLineChart } from '@/components/surface/history-line-chart';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client } from '@/types/domain';
import { getSecondaryAnalysisMetricByKey } from '@/utils/analysis-metrics';
import { HistoricalRevisionMetrics, buildHistoricalRevisionMetrics } from '@/utils/client-history';

type ClientHistoryMetricDetailScreenProps = {
  clientId: string;
  metricKey: string;
};

type MetricUnit = 'kg' | 'pct' | 'cm' | 'mm' | 'bmi';
type TrendDirection = 'decrease-better' | 'increase-better' | 'neutral';

type MetricHistoryEntry = {
  revisionId: string;
  reviewedAt: string;
  value: number;
  deltaFromPrevious: number | null;
  deltaFromFirst: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES');
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatMetricValue(value: number | null, unit: MetricUnit) {
  if (value === null) {
    return '—';
  }

  const formattedValue = value.toLocaleString('es-ES', {
    minimumFractionDigits: unit === 'mm' ? 0 : 1,
    maximumFractionDigits: unit === 'mm' ? 0 : 1,
  });

  if (unit === 'pct') {
    return `${formattedValue}%`;
  }

  if (unit === 'bmi') {
    return formattedValue;
  }

  return `${formattedValue} ${unit}`;
}

function formatDeltaValue(value: number | null, unit: MetricUnit) {
  if (value === null) {
    return '—';
  }

  if (value === 0) {
    return unit === 'pct' ? '0.0%' : unit === 'bmi' ? '0.0' : `0.0 ${unit}`;
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${formatMetricValue(value, unit)}`;
}

function getDeltaTone(delta: number | null, direction: TrendDirection) {
  if (delta === null || delta === 0) {
    return { color: '#5C6B86' };
  }

  if (direction === 'neutral') {
    return { color: Accent.primary };
  }

  const favorable = direction === 'decrease-better' ? delta < 0 : delta > 0;
  return { color: favorable ? Accent.success : Accent.danger };
}

function getMetricIcon(unit: MetricUnit): keyof typeof Ionicons.glyphMap {
  if (unit === 'kg') return 'scale-outline';
  if (unit === 'pct') return 'water-outline';
  if (unit === 'cm' || unit === 'mm') return 'resize-outline';
  return 'analytics-outline';
}

export function ClientHistoryMetricDetailScreen({ clientId, metricKey }: ClientHistoryMetricDetailScreenProps) {
  const { user, userRole } = useAuth();
  const isAthlete = userRole === 'athlete';
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [client, setClient] = useState<Client | null>(null);
  const [historicalRevisions, setHistoricalRevisions] = useState<HistoricalRevisionMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const metric = useMemo(() => getSecondaryAnalysisMetricByKey(metricKey), [metricKey]);

  const loadContent = useCallback(async () => {
    if (!user?.id) {
      setClient(null);
      setHistoricalRevisions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = isAthlete
        ? await clientsService.getByIdForViewer(clientId)
        : await clientsService.getById(clientId, user.id!);
      setClient(nextClient);

      if (!nextClient) {
        setHistoricalRevisions([]);
        return;
      }

      const revisions = await revisionsService.listByClient(nextClient.id);
      setHistoricalRevisions(buildHistoricalRevisionMetrics(nextClient, revisions));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el detalle de la métrica.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, isAthlete, user?.id]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const metricEntries = useMemo<MetricHistoryEntry[]>(() => {
    if (!metric) {
      return [];
    }

    const timeline = [...historicalRevisions]
      .reverse()
      .map((revision) => ({
        revision,
        value: metric.accessor(revision),
      }))
      .filter((entry): entry is { revision: HistoricalRevisionMetrics; value: number } => entry.value !== null);

    if (timeline.length === 0) {
      return [];
    }

    const firstValue = timeline[0].value;

    return timeline.map((entry, index) => {
      const previousValue = index > 0 ? timeline[index - 1].value : null;

      return {
        revisionId: entry.revision.id,
        reviewedAt: entry.revision.reviewedAt,
        value: entry.value,
        deltaFromPrevious: previousValue === null ? null : entry.value - previousValue,
        deltaFromFirst: entry.value - firstValue,
      };
    });
  }, [historicalRevisions, metric]);

  const currentEntry = metricEntries[metricEntries.length - 1] ?? null;
  const historyEntries = useMemo(() => [...metricEntries].reverse(), [metricEntries]);
  const chartWidth = Math.max(width - 48, 260);

  if (isLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Preparando detalle de métrica..." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <PageHeader title="Error" />
        <PageSection first>
          <StatusBanner tone="danger" message={errorMessage} />
          <AppButton label="Reintentar" onPress={() => void loadContent()} variant="secondary" />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!client || !metric) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Métrica no disponible"
          description="No se pudo cargar esta métrica en el análisis histórico."
          actionLabel="Volver al análisis"
          onAction={() => router.replace(`/clients/${clientId}/metrics`)}
        />
      </ScreenContainer>
    );
  }

  if (metricEntries.length === 0) {
    return (
      <ScreenContainer>
        <PageHeader
          eyebrow={`Cliente: ${client.name}`}
          title={metric.label}
          rightSlot={<AppButton label="← Volver" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} />}
        />
        <PageSection first>
          <EmptyState
            title="No hay valores guardados"
            description="Esta métrica todavía no tiene datos numéricos en las revisiones del cliente."
            actionLabel="Volver al análisis"
            onAction={() => router.replace(`/clients/${clientId}/metrics`)}
          />
        </PageSection>
      </ScreenContainer>
    );
  }

  const trendTone = getDeltaTone(currentEntry?.deltaFromFirst ?? null, metric.direction);
  const trendIcon = (currentEntry?.deltaFromFirst ?? 0) < 0 ? 'trending-down' : 'trending-up';

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al análisis"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.backButtonText}>Análisis</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.clientName}>{client.name}</ThemedText>
      </View>

      <View style={styles.metricHero}>
        <View style={styles.metricHeroTop}>
          <View style={styles.metricIcon}>
            <Ionicons name={getMetricIcon(metric.unit)} size={26} color="#FFFFFF" />
          </View>
          <View style={styles.metricHeroCopy}>
            <ThemedText type="label" style={styles.metricEyebrow}>Evolución de métrica</ThemedText>
            <ThemedText type="headline" style={styles.metricTitle}>{metric.label}</ThemedText>
          </View>
        </View>
        <View style={styles.metricHeroDivider} />
        <View style={styles.metricValueRow}>
          <View>
            <ThemedText type="small" style={styles.metricValueLabel}>Valor actual</ThemedText>
            <ThemedText type="headline" style={styles.metricValue}>{formatMetricValue(currentEntry?.value ?? null, metric.unit)}</ThemedText>
          </View>
          <View style={styles.metricProgressWrap}>
            <ThemedText type="small" style={styles.metricValueLabel}>Desde el inicio</ThemedText>
            <View style={styles.metricProgressPill}>
              <Ionicons name={trendIcon} size={15} color={trendTone.color} />
              <ThemedText type="smallBold" style={{ color: trendTone.color }}>
                {formatDeltaValue(currentEntry?.deltaFromFirst ?? null, metric.unit)}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <ThemedText type="headline" style={styles.sectionTitle}>Evolución</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{metricEntries.length} mediciones registradas</ThemedText>
        </View>
      </View>

      <HistoryLineChart
        hideHeader
        title={metric.label}
        valueLabel={formatMetricValue(currentEntry?.value ?? null, metric.unit)}
        deltaLabel={formatDeltaValue(currentEntry?.deltaFromFirst ?? null, metric.unit)}
        deltaColor={trendTone.color}
        width={chartWidth}
        points={metricEntries.map((entry) => ({
          label: formatDate(entry.reviewedAt),
          shortLabel: formatShortDate(entry.reviewedAt),
          value: entry.value,
        }))}
        yUnitSuffix={metric.unit === 'pct' ? '%' : metric.unit === 'bmi' ? '' : ` ${metric.unit}`}
      />

      <View style={styles.sectionHeader}>
        <View>
          <ThemedText type="headline" style={styles.sectionTitle}>Historial</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Últimos registros primero</ThemedText>
        </View>
      </View>

      <View style={[styles.historyCard, { borderColor: theme.backgroundSelected }]}>
        {historyEntries.map((entry, index) => {
          const sessionTone = getDeltaTone(entry.deltaFromPrevious, metric.direction);
          const isLatest = index === 0;

          return (
            <View key={entry.revisionId} style={[styles.historyRow, index > 0 && { borderTopColor: theme.backgroundSelected, borderTopWidth: 1 }]}>
              <View style={[styles.historyMarker, isLatest && styles.historyMarkerLatest]}>
                <Ionicons name={isLatest ? 'star' : 'ellipse'} size={isLatest ? 12 : 8} color={isLatest ? '#FFFFFF' : '#7A9CC4'} />
              </View>
              <View style={styles.historyCopy}>
                <View style={styles.historyTitleRow}>
                  <ThemedText type="smallBold" style={styles.historyDate}>{formatDate(entry.reviewedAt)}</ThemedText>
                  {isLatest ? <ThemedText type="smallBold" style={styles.currentTag}>Actual</ThemedText> : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.deltaFromPrevious === null ? 'Registro inicial' : `Cambio respecto a la anterior: ${formatDeltaValue(entry.deltaFromPrevious, metric.unit)}`}
                </ThemedText>
              </View>
              <View style={styles.historyValueWrap}>
                <ThemedText type="smallBold" style={styles.historyValue}>{formatMetricValue(entry.value, metric.unit)}</ThemedText>
                {entry.deltaFromPrevious !== null ? <ThemedText type="smallBold" style={{ color: sessionTone.color }}>{formatDeltaValue(entry.deltaFromPrevious, metric.unit)}</ThemedText> : null}
              </View>
            </View>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 16,
    paddingTop: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
  },
  backButtonText: {
    color: '#10203B',
  },
  clientName: {
    flex: 1,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  metricHero: {
    borderRadius: 24,
    backgroundColor: '#163A82',
    padding: 18,
    gap: 16,
    shadowColor: '#12336E',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  metricHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  metricHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  metricEyebrow: {
    color: '#AFC8FF',
    letterSpacing: 0.5,
  },
  metricTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 30,
  },
  metricHeroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricValueLabel: {
    color: '#AFC8FF',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 35,
    marginTop: 3,
  },
  metricProgressWrap: {
    alignItems: 'flex-end',
    gap: 5,
  },
  metricProgressPill: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 21,
    lineHeight: 26,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  historyMarker: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FC',
  },
  historyMarkerLatest: {
    backgroundColor: Accent.primary,
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  historyDate: {
    color: '#10203B',
  },
  currentTag: {
    borderRadius: Radius.pill,
    backgroundColor: '#E8F0FF',
    color: Accent.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    lineHeight: 12,
  },
  historyValueWrap: {
    alignItems: 'flex-end',
    gap: 3,
  },
  historyValue: {
    color: '#10203B',
    textAlign: 'right',
  },
});
