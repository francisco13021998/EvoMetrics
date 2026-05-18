import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type ChartPoint = {
  label: string;
  shortLabel: string;
  value: number | null;
};

type HistoryLineChartProps = {
  title: string;
  subtitle?: string;
  valueLabel: string;
  deltaLabel: string;
  deltaColor: string;
  strokeColor?: string;
  width: number;
  points: ChartPoint[];
  yUnitSuffix?: string;
};

type ResolvedPoint = ChartPoint & {
  x: number;
  y: number;
};

function roundTo(value: number, decimals = 1) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

export function HistoryLineChart({
  title,
  subtitle,
  valueLabel,
  deltaLabel,
  deltaColor,
  strokeColor = Accent.primary,
  width,
  points,
  yUnitSuffix = '',
}: HistoryLineChartProps) {
  const theme = useTheme();
  const chartWidth = Math.max(width, 220);
  const chartHeight = 214;
  const topPadding = 18;
  const leftAxisWidth = 42;
  const rightPadding = 16;
  const bottomAxisHeight = 34;
  const drawableWidth = chartWidth - leftAxisWidth - rightPadding;
  const drawableHeight = chartHeight - topPadding - bottomAxisHeight;

  const resolvedChart = useMemo(() => {
    const validValues = points.map((point) => point.value).filter((value): value is number => value !== null);

    if (validValues.length === 0) {
      return null;
    }

    const minimum = Math.min(...validValues);
    const maximum = Math.max(...validValues);
    const span = maximum - minimum || Math.max(Math.abs(maximum) * 0.08, 1);
    const paddedMin = roundTo(minimum - (span * 0.12), 1);
    const paddedMax = roundTo(maximum + (span * 0.12), 1);
    const range = paddedMax - paddedMin || 1;
    const stepX = points.length > 1 ? drawableWidth / (points.length - 1) : drawableWidth;
    const resolvedPoints: ResolvedPoint[] = points.map((point, index) => {
      const normalizedValue = point.value === null ? null : (point.value - paddedMin) / range;
      const x = leftAxisWidth + (stepX * index);
      const y = point.value === null ? topPadding + drawableHeight : topPadding + drawableHeight - (normalizedValue! * drawableHeight);

      return {
        ...point,
        x,
        y,
      };
    });

    const pathSegments = resolvedPoints.reduce<string[]>((segments, point) => {
      if (point.value === null) {
        return segments;
      }

      if (segments.length === 0) {
        return [`M ${point.x} ${point.y}`];
      }

      return [...segments, `L ${point.x} ${point.y}`];
    }, []);

    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount }, (_, index) => {
      const ratio = index / (tickCount - 1);
      const value = roundTo(paddedMax - ((paddedMax - paddedMin) * ratio), 1);
      const y = topPadding + (drawableHeight * ratio);

      return {
        value,
        y,
      };
    });

    const labelIndexes = points.length <= 4
      ? points.map((_, index) => index)
      : Array.from(new Set([0, Math.round((points.length - 1) / 2), points.length - 1]));

    return {
      resolvedPoints,
      path: pathSegments.join(' '),
      yTicks,
      labelIndexes,
    };
  }, [drawableHeight, drawableWidth, leftAxisWidth, points, topPadding]);

  return (
    <View style={[styles.card, { borderColor: theme.backgroundSelected }]}> 
      <View style={styles.headerRow}>
        <View style={styles.copyWrap}>
          <ThemedText type="small" themeColor="textSecondary">{title}</ThemedText>
          <ThemedText type="headline" style={styles.valueText}>{valueLabel}</ThemedText>
          {subtitle ? <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText> : null}
        </View>
        <View style={styles.deltaPill}>
          <ThemedText type="smallBold" style={{ color: deltaColor }}>{deltaLabel}</ThemedText>
        </View>
      </View>

      {resolvedChart ? (
        <Svg width={chartWidth} height={chartHeight}>
          {resolvedChart.yTicks.map((tick) => (
            <React.Fragment key={`tick-${tick.y}`}>
              <Line
                x1={leftAxisWidth}
                y1={tick.y}
                x2={chartWidth - rightPadding}
                y2={tick.y}
                stroke={theme.backgroundSelected}
                strokeWidth={1}
              />
              <SvgText
                x={leftAxisWidth - 6}
                y={tick.y + 4}
                fill={theme.textSecondary}
                fontSize="11"
                textAnchor="end">
                {`${tick.value}${yUnitSuffix}`}
              </SvgText>
            </React.Fragment>
          ))}

          <Line
            x1={leftAxisWidth}
            y1={topPadding + drawableHeight}
            x2={chartWidth - rightPadding}
            y2={topPadding + drawableHeight}
            stroke={theme.backgroundSelected}
            strokeWidth={1.2}
          />

          {resolvedChart.path ? <Path d={resolvedChart.path} fill="none" stroke={strokeColor} strokeWidth={3} /> : null}

          {resolvedChart.resolvedPoints.map((point) => (
            point.value !== null ? (
              <Circle
                key={`${point.label}-${point.x}`}
                cx={point.x}
                cy={point.y}
                r={4.5}
                fill="#FFFFFF"
                stroke={strokeColor}
                strokeWidth={2.5}
              />
            ) : null
          ))}

          {resolvedChart.labelIndexes.map((index) => {
            const point = resolvedChart.resolvedPoints[index];

            return (
              <SvgText
                key={`label-${index}-${point.label}`}
                x={point.x}
                y={chartHeight - 8}
                fill={theme.textSecondary}
                fontSize="11"
                textAnchor="middle">
                {point.shortLabel}
              </SvgText>
            );
          })}
        </Svg>
      ) : (
        <View style={styles.emptyChart}>
          <ThemedText type="small" themeColor="textSecondary">No hay datos suficientes para dibujar la tendencia.</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  copyWrap: {
    flex: 1,
    gap: 2,
  },
  valueText: {
    color: '#10203B',
  },
  deltaPill: {
    minHeight: 32,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F5F8FD',
  },
  emptyChart: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});