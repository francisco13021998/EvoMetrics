import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { HistoryLineChart } from '@/components/surface/history-line-chart';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
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
  }, [clientId, user?.id]);

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

  return (
    <ScreenContainer>
      <PageHeader
        eyebrow={`Cliente: ${client.name}`}
        title={metric.label}
        subtitle="Detalle histórico"
        rightSlot={<AppButton label="← Volver" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} />}
      />

      <PageSection first label="Resumen">
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary">Valor actual</ThemedText>
            <ThemedText type="headline" style={styles.summaryValue}>{formatMetricValue(currentEntry?.value ?? null, metric.unit)}</ThemedText>
          </View>
          <View style={[styles.summaryCard, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary">Progreso total</ThemedText>
            <ThemedText type="headline" style={{ color: trendTone.color }}>
              {formatDeltaValue(currentEntry?.deltaFromFirst ?? null, metric.unit)}
            </ThemedText>
          </View>
        </View>
      </PageSection>

      <PageSection label="Tendencia">
        <HistoryLineChart
          title={metric.label}
          subtitle={`${metricEntries.length} registros con valor`}
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
      </PageSection>

      <PageSection label="Índices">
        <View style={[styles.tableCard, { borderColor: theme.backgroundSelected }]}>
          <View style={[styles.tableHeader, { borderBottomColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" style={[styles.tableHeaderCell, styles.cellDate]}>Fecha</ThemedText>
            <ThemedText type="smallBold" style={[styles.tableHeaderCell, styles.cellValue]}>Valor</ThemedText>
            <ThemedText type="smallBold" style={[styles.tableHeaderCell, styles.cellDelta]}>Δ sesión</ThemedText>
            <ThemedText type="smallBold" style={[styles.tableHeaderCell, styles.cellDelta]}>Δ total</ThemedText>
          </View>
          {metricEntries.map((entry, index) => {
            const sessionTone = getDeltaTone(entry.deltaFromPrevious, metric.direction);
            const totalTone = getDeltaTone(entry.deltaFromFirst, metric.direction);

            return (
              <View
                key={entry.revisionId}
                style={[
                  styles.tableRow,
                  {
                    borderTopColor: theme.backgroundSelected,
                    borderTopWidth: index === 0 ? 0 : 1,
                  },
                ]}>
                <ThemedText type="small" style={[styles.cellDate, styles.tableCell]}>{formatDate(entry.reviewedAt)}</ThemedText>
                <ThemedText type="small" style={[styles.cellValue, styles.tableCell]}>{formatMetricValue(entry.value, metric.unit)}</ThemedText>
                <ThemedText type="smallBold" style={[styles.cellDelta, styles.tableCell, { color: sessionTone.color }]}>
                  {formatDeltaValue(entry.deltaFromPrevious, metric.unit)}
                </ThemedText>
                <ThemedText type="smallBold" style={[styles.cellDelta, styles.tableCell, { color: totalTone.color }]}>
                  {formatDeltaValue(entry.deltaFromFirst, metric.unit)}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </PageSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.medium,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 4,
  },
  summaryValue: {
    color: '#10203B',
  },
  tableCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    backgroundColor: '#F8FBFF',
  },
  tableHeaderCell: {
    color: '#10203B',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tableCell: {
    lineHeight: 18,
  },
  cellDate: {
    flex: 1.25,
  },
  cellValue: {
    flex: 1,
    textAlign: 'right',
  },
  cellDelta: {
    flex: 1,
    textAlign: 'right',
  },
});
