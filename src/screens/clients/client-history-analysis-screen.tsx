import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { ScreenContainer } from '@/components/layout/screen-container';
import { HistoryLineChart } from '@/components/surface/history-line-chart';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client } from '@/types/domain';
import {
    type HistoricalComparisonMode,
    HistoricalRevisionMetrics,
    buildHistoricalRevisionMetrics,
    resolveHistoricalMetricComparison,
} from '@/utils/client-history';

type ClientHistoryAnalysisScreenProps = {
  clientId: string;
};

type HistoryRange = 'all' | '5' | '10';
type TrendDirection = 'decrease-better' | 'increase-better' | 'neutral';
type MetricUnit = 'kg' | 'pct' | 'cm' | 'mm' | 'bmi';

type MetricConfig = {
  key: string;
  label: string;
  unit: MetricUnit;
  direction: TrendDirection;
  comparisonMode: HistoricalComparisonMode;
  accessor: (revision: HistoricalRevisionMetrics | null) => number | null;
};

type ChartMetricConfig = MetricConfig & {
  strokeColor: string;
};

const RANGE_OPTIONS: { label: string; value: HistoryRange }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Últimas 5', value: '5' },
  { label: 'Últimas 10', value: '10' },
];

const SUMMARY_METRICS: MetricConfig[] = [
  {
    key: 'bodyFatAveragePct',
    label: '% grasa medio',
    unit: 'pct',
    direction: 'decrease-better',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.bodyFatAveragePct ?? null,
  },
  {
    key: 'weightKg',
    label: 'Peso',
    unit: 'kg',
    direction: 'neutral',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.weightKg ?? null,
  },
  {
    key: 'fatMassKg',
    label: 'Masa grasa',
    unit: 'kg',
    direction: 'decrease-better',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.fatMassKg ?? null,
  },
  {
    key: 'leanMassKg',
    label: 'Masa libre',
    unit: 'kg',
    direction: 'increase-better',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.leanMassKg ?? null,
  },
];

const CHART_METRICS: ChartMetricConfig[] = [
  {
    key: 'weightKg',
    label: 'Peso',
    unit: 'kg',
    direction: 'neutral',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.weightKg ?? null,
    strokeColor: Accent.primary,
  },
  {
    key: 'bodyFatAveragePct',
    label: '% grasa medio',
    unit: 'pct',
    direction: 'decrease-better',
    comparisonMode: 'average-homogeneous',
    accessor: (revision) => revision?.bodyFatAveragePct ?? null,
    strokeColor: '#2F7CF6',
  },
  {
    key: 'fatMassKg',
    label: 'Masa grasa',
    unit: 'kg',
    direction: 'decrease-better',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.fatMassKg ?? null,
    strokeColor: '#DC5B5B',
  },
  {
    key: 'leanMassKg',
    label: 'Masa libre',
    unit: 'kg',
    direction: 'increase-better',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.leanMassKg ?? null,
    strokeColor: Accent.success,
  },
];

const SECONDARY_METRICS: MetricConfig[] = [
  {
    key: 'bmi',
    label: 'IMC',
    unit: 'bmi',
    direction: 'neutral',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.bmi ?? null,
  },
  {
    key: 'bellyCm',
    label: 'Abdomen',
    unit: 'cm',
    direction: 'decrease-better',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.bellyCm ?? null,
  },
  {
    key: 'gluteCm',
    label: 'Gluteo',
    unit: 'cm',
    direction: 'neutral',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.gluteCm ?? null,
  },
  {
    key: 'sumSkinfoldsMm',
    label: 'Suma pliegues',
    unit: 'mm',
    direction: 'decrease-better',
    comparisonMode: 'skinfold-formula',
    accessor: (revision) => revision?.sumSkinfoldsMm ?? null,
  },
  {
    key: 'bodyFatSkinfoldsPct',
    label: '% pliegues',
    unit: 'pct',
    direction: 'decrease-better',
    comparisonMode: 'skinfold-formula',
    accessor: (revision) => revision?.bodyFatSkinfoldsPct ?? null,
  },
  {
    key: 'bodyFatPerimetersPct',
    label: '% perimetros',
    unit: 'pct',
    direction: 'decrease-better',
    comparisonMode: 'perimeter-formula',
    accessor: (revision) => revision?.bodyFatPerimetersPct ?? null,
  },
  {
    key: 'bodyFatVisualPct',
    label: '% visual',
    unit: 'pct',
    direction: 'decrease-better',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.bodyFatVisualPct ?? null,
  },
];

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

function formatDeltaValue(value: number | null, unit: MetricUnit, emptyLabel = 'Sin referencia') {
  if (value === null) {
    return emptyLabel;
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

function truncateNotes(value: string | null, length = 72) {
  const trimmedValue = value?.trim() ?? '';

  if (!trimmedValue) {
    return '';
  }

  if (trimmedValue.length <= length) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, length - 1)}...`;
}

export function ClientHistoryAnalysisScreen({ clientId }: ClientHistoryAnalysisScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [client, setClient] = useState<Client | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('all');
  const [historicalRevisions, setHistoricalRevisions] = useState<HistoricalRevisionMetrics[]>([]);
  const [isSecondaryExpanded, setIsSecondaryExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isWide = width >= 960;
  const isMedium = width >= 720;
  const summaryCardWidth = isMedium ? '48.6%' : '48.2%';
  const chartCardWidth = isWide ? Math.max((width - 88) / 2, 280) : width - 48;

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
      const nextClient = await clientsService.getById(clientId, user.id);
      setClient(nextClient);

      if (!nextClient) {
        setHistoricalRevisions([]);
        return;
      }

      const revisions = await revisionsService.listByClient(nextClient.id);
      setHistoricalRevisions(buildHistoricalRevisionMetrics(nextClient, revisions));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el análisis histórico.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, user?.id]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const filteredHistory = useMemo(() => {
    if (historyRange === 'all') {
      return historicalRevisions;
    }

    return historicalRevisions.slice(0, Number(historyRange));
  }, [historicalRevisions, historyRange]);

  const currentRevision = filteredHistory[0] ?? null;
  const latestRevision = historicalRevisions[0] ?? null;
  const chartSeries = useMemo(() => filteredHistory.slice().reverse(), [filteredHistory]);
  const secondaryRows = useMemo(
    () => SECONDARY_METRICS.filter((metric) => metric.accessor(currentRevision) !== null),
    [currentRevision]
  );

  if (isLoading) {
    return (
      <ScreenContainer>
        <StatusBanner tone="info" loading message="Preparando analisis historico..." />
        <StatusBanner tone="info" loading message="Preparando análisis histórico..." />
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <StatusBanner tone="danger" message={errorMessage} />
        <AppButton label="Reintentar" onPress={() => void loadContent()} variant="secondary" />
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Cliente no encontrado"
          description="No se ha podido acceder a este cliente para construir el análisis histórico."
          actionLabel="Volver a clientes"
          onAction={() => router.replace('/clients')}
        />
      </ScreenContainer>
    );
  }

  if (historicalRevisions.length === 0) {
    return (
      <ScreenContainer>
        <View style={styles.headerShell}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" style={styles.backButtonText}>← Volver</ThemedText>
          </Pressable>
          <View style={styles.heroCopy}>
            <ThemedText type="headline" style={styles.heroTitle}>{client.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Análisis histórico</ThemedText>
          </View>
        </View>
        <EmptyState
          title="Todavía no hay revisiones para analizar"
          description="Cuando registres la primera revisión aparecerán aquí el resumen, las gráficas y la comparativa histórica del cliente."
          actionLabel="Crear primera revisión"
          onAction={() => router.push(`/revisions/new?clientId=${client.id}`)}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.headerShell}>
        <View style={styles.heroTopRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#F6F9FE' : 'transparent',
              },
            ]}>
            <ThemedText type="smallBold" style={styles.backButtonText}>← Volver</ThemedText>
          </Pressable>

          <View style={styles.rangeSwitch}>
            {RANGE_OPTIONS.map((option) => {
              const isActive = historyRange === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setHistoryRange(option.value)}
                  style={[
                    styles.rangeChip,
                    {
                      backgroundColor: isActive ? Accent.primary : '#FFFFFF',
                      borderColor: isActive ? Accent.primary : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: isActive ? '#FFFFFF' : '#10203B' }}>{option.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText type="headline" style={styles.heroTitle}>{client.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Análisis histórico</ThemedText>
        </View>
      </View>

      <View style={[styles.summaryPanel, { borderColor: theme.backgroundSelected }]}> 
        <View style={styles.sectionCopy}>
          <ThemedText type="headline">Resumen principal</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Actual y cambio válido</ThemedText>
        </View>
        <View style={styles.summaryGridCompact}>
          {SUMMARY_METRICS.map((metric) => {
            const comparison = resolveHistoricalMetricComparison({
              client,
              history: historicalRevisions,
              currentRevision: historicalRevisions[0] ?? currentRevision,
              mode: metric.comparisonMode,
              accessor: metric.accessor,
            });
            const tone = getDeltaTone(comparison.delta, metric.direction);

            return (
              <View
                key={metric.key}
                style={[
                  styles.summaryCardCompact,
                  { width: summaryCardWidth, borderColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="small" themeColor="textSecondary">{metric.label}</ThemedText>
                <ThemedText type="headline" style={styles.summaryValue}>{formatMetricValue(comparison.currentValue, metric.unit)}</ThemedText>
                <ThemedText type="smallBold" style={{ color: tone.color }}>
                  {formatDeltaValue(comparison.delta, metric.unit, comparison.missingReferenceLabel)}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionCopy}>
          <ThemedText type="headline">Tendencias</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Peso, composición y evolución reciente</ThemedText>
        </View>
        <View style={styles.chartsGrid}>
          {CHART_METRICS.map((metric) => {
            const comparison = resolveHistoricalMetricComparison({
              client,
              history: historicalRevisions,
              currentRevision: latestRevision,
              mode: 'history-start',
              accessor: metric.accessor,
            });
            const tone = getDeltaTone(comparison.delta, metric.direction);
            const points = chartSeries.map((revision) => ({
              label: formatDate(revision.reviewedAt),
              shortLabel: formatShortDate(revision.reviewedAt),
              value: metric.accessor(revision),
            }));

            return (
              <HistoryLineChart
                key={metric.key}
                title={metric.label}
                subtitle={points.length > 1 ? `${points.length} revisiones visibles` : 'Añade más revisiones para ver evolución'}
                valueLabel={formatMetricValue(comparison.currentValue, metric.unit)}
                deltaLabel={formatDeltaValue(comparison.delta, metric.unit, comparison.missingReferenceLabel)}
                deltaColor={tone.color}
                strokeColor={metric.strokeColor}
                width={chartCardWidth}
                points={points}
                yUnitSuffix={metric.unit === 'pct' ? '%' : metric.unit === 'bmi' ? '' : ` ${metric.unit}`}
              />
            );
          })}
        </View>
      </View>

      <View style={[styles.secondaryPanel, { borderColor: theme.backgroundSelected }]}> 
        <Pressable
          onPress={() => setIsSecondaryExpanded((currentValue) => !currentValue)}
          style={[styles.historyToggle, { borderColor: theme.backgroundSelected }]}> 
          <View style={styles.sectionCopy}>
            <ThemedText type="smallBold">Lectura secundaria</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Métricas útiles, pero no protagonistas</ThemedText>
          </View>
          <ThemedText type="smallBold" style={styles.historyToggleIcon}>{isSecondaryExpanded ? '-' : '+'}</ThemedText>
        </Pressable>

        {isSecondaryExpanded ? (
          <>
            {secondaryRows.length > 0 ? (
              <View style={styles.secondaryMetricsWrap}>
                {secondaryRows.map((metric, index) => {
                  const comparison = resolveHistoricalMetricComparison({
                    client,
                    history: filteredHistory,
                    currentRevision,
                    mode: metric.comparisonMode,
                    accessor: metric.accessor,
                  });
                  const tone = getDeltaTone(comparison.delta, metric.direction);

                  return (
                    <View
                      key={metric.key}
                      style={[
                        styles.secondaryMetricRow,
                        {
                          borderTopColor: theme.backgroundSelected,
                          borderTopWidth: index === 0 ? 0 : 1,
                        },
                      ]}>
                      <ThemedText type="smallBold" style={styles.secondaryMetricLabel}>{metric.label}</ThemedText>
                      <View style={styles.secondaryMetricValues}>
                        <ThemedText type="small">{formatMetricValue(comparison.currentValue, metric.unit)}</ThemedText>
                        <ThemedText type="smallBold" style={{ color: tone.color }}>
                          {formatDeltaValue(comparison.delta, metric.unit, comparison.missingReferenceLabel)}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Pressable
              onPress={() => setIsHistoryExpanded((currentValue) => !currentValue)}
              style={[styles.historyToggle, { borderColor: theme.backgroundSelected }]}> 
              <View style={styles.sectionCopy}>
                <ThemedText type="smallBold">Historial detallado</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Secundario y colapsable</ThemedText>
              </View>
              <ThemedText type="smallBold" style={styles.historyToggleIcon}>{isHistoryExpanded ? '-' : '+'}</ThemedText>
            </Pressable>

            {isHistoryExpanded ? (
              <View style={styles.historyListCompact}>
                {filteredHistory.map((revision, index) => (
                  <Pressable
                    key={revision.id}
                    onPress={() => router.push(`/revisions/${revision.id}`)}
                    style={({ pressed }) => [
                      styles.historyRow,
                      {
                        borderTopColor: theme.backgroundSelected,
                        borderTopWidth: index === 0 ? 0 : 1,
                        backgroundColor: pressed ? '#F8FBFF' : 'transparent',
                      },
                    ]}>
                    <View style={styles.historyRowPrimary}>
                      <ThemedText type="smallBold">{formatDate(revision.reviewedAt)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{revision.phaseLabel}</ThemedText>
                    </View>
                    <View style={styles.historyRowMetrics}>
                      <ThemedText type="small" themeColor="textSecondary">{formatMetricValue(revision.weightKg, 'kg')}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{formatMetricValue(revision.bodyFatAveragePct, 'pct')}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{truncateNotes(revision.notes) || 'Sin notas'}</ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 18,
  },
  headerShell: {
    gap: 10,
    paddingTop: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  backButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#10203B',
  },
  rangeSwitch: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  rangeChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroCopy: {
    gap: 2,
    paddingHorizontal: 2,
  },
  heroTitle: {
    color: '#10203B',
  },
  heroMeta: {
    lineHeight: 22,
  },
  sectionWrap: {
    gap: 12,
  },
  sectionCopy: {
    gap: 2,
    flex: 1,
  },
  summaryPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#F8FBFF',
    padding: 14,
    gap: 12,
    ...Shadows.soft,
  },
  summaryGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  summaryCardCompact: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    minHeight: 96,
  },
  summaryValue: {
    color: '#10203B',
  },
  summaryDeltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chartsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  secondaryPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  secondaryMetricsWrap: {
    borderWidth: 1,
    borderColor: '#E3EBF6',
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#FAFCFF',
  },
  secondaryMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryMetricLabel: {
    color: '#10203B',
  },
  secondaryMetricValues: {
    alignItems: 'flex-end',
    gap: 2,
  },
  historyToggle: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  historyToggleIcon: {
    color: Accent.primary,
    fontSize: 22,
    lineHeight: 24,
  },
  historyListCompact: {
    borderWidth: 1,
    borderColor: '#E3EBF6',
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  historyRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  historyRowPrimary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  historyRowMetrics: {
    gap: 2,
  },
}
);