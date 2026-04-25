import { useState, useMemo, useCallback } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useForecast, type ForecastResult } from '@/lib/hooks/use-ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ForecastPanelProps {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  /** Historical cell values for the block, ordered chronologically. */
  historicalValues?: number[];
}

interface ForecastTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function ForecastTooltipContent({ active, payload, label }: ForecastTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-popover-foreground">{label}</p>
      {payload
        .filter((entry) => entry.dataKey !== 'confidenceLower')
        .map((entry) => {
          const displayName =
            entry.dataKey === 'confidenceUpper'
              ? 'Confidence range'
              : entry.name;

          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{displayName}:</span>
              <span className="font-medium text-popover-foreground">
                {typeof entry.value === 'number'
                  ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : entry.value}
              </span>
            </div>
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METHOD_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'linear', label: 'Linear' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'moving_average', label: 'Moving Avg' },
];

const TREND_ICONS = {
  increasing: TrendingUp,
  decreasing: TrendingDown,
  stable: Minus,
} as const;

const TREND_COLORS = {
  increasing: 'text-green-600 dark:text-green-400',
  decreasing: 'text-red-600 dark:text-red-400',
  stable: 'text-muted-foreground',
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ForecastPanel({
  workspaceSlug,
  appSlug,
  blockId,
  historicalValues = [],
}: ForecastPanelProps) {
  const [periods, setPeriods] = useState(6);
  const [method, setMethod] = useState('auto');

  const forecast = useForecast();
  const result = forecast.data?.data as ForecastResult | undefined;

  const handleGenerate = useCallback(() => {
    forecast.mutate({
      workspaceSlug,
      appSlug,
      blockId,
      periods,
      method: method === 'auto' ? undefined : method,
    });
  }, [workspaceSlug, appSlug, blockId, periods, method, forecast]);

  // Build chart data combining historical + forecasted points
  const chartData = useMemo(() => {
    const data: Array<{
      label: string;
      historical: number | null;
      forecast: number | null;
      confidenceLower: number | null;
      confidenceUpper: number | null;
    }> = [];

    // Historical
    for (let i = 0; i < historicalValues.length; i++) {
      data.push({
        label: `P${i + 1}`,
        historical: historicalValues[i] ?? null,
        forecast: null,
        confidenceLower: null,
        confidenceUpper: null,
      });
    }

    // Forecasted
    if (result) {
      // Overlap: last historical = first forecast
      const lastIdx = data.length - 1;
      if (lastIdx >= 0 && data[lastIdx]) {
        data[lastIdx].forecast = data[lastIdx].historical;
      }

      for (let i = 0; i < result.forecasted.length; i++) {
        const conf = result.confidence[i];
        data.push({
          label: `F${i + 1}`,
          historical: null,
          forecast: result.forecasted[i] ?? null,
          confidenceLower: conf?.lower ?? null,
          confidenceUpper: conf?.upper ?? null,
        });
      }
    }

    return data;
  }, [historicalValues, result]);

  const TrendIcon = result ? TREND_ICONS[result.trend] : null;
  const trendColor = result ? TREND_COLORS[result.trend] : '';

  return (
    <div className="px-4 py-4" role="region" aria-label="Forecast panel">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Forecast</span>
        {result && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-100 px-1.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
            {result.forecasted.length}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Periods slider */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Periods:</span>
          <input
            type="range"
            min={1}
            max={12}
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
            className="h-1.5 w-24 cursor-pointer accent-violet-500"
            aria-label="Number of forecast periods"
          />
          <span className="w-5 text-center font-medium text-foreground">
            {periods}
          </span>
        </label>

        {/* Method selector */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Method:</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={cn(
              'rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm px-2.5 py-1 text-xs text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:ring-offset-1',
              'transition-all duration-200',
            )}
            aria-label="Forecast method"
          >
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={forecast.isPending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-2xl px-4 py-1.5 text-xs font-medium transition-all duration-200',
            'bg-violet-600 text-white hover:bg-violet-700 shadow-win hover:shadow-win-lg',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <RefreshCw
            className={cn(
              'h-3 w-3',
              forecast.isPending && 'animate-spin',
            )}
            aria-hidden="true"
          />
          {forecast.isPending ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {/* Loading */}
      {forecast.isPending && !result && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500" />
        </div>
      )}

      {/* Empty state */}
      {!forecast.isPending && !result && (
        <div className="py-8 text-center rounded-3xl border border-border/50 bg-background/60 backdrop-blur-sm">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            Generate a forecast to see predicted values and trends.
          </p>
        </div>
      )}

      {/* Chart + stats */}
      {result && (
        <>
          {/* Chart */}
          <div
            className="mb-4 rounded-3xl border border-border/50 bg-background/60 backdrop-blur-sm p-3 shadow-win"
            role="img"
            aria-label="Forecast chart showing historical and predicted values"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="forecast-confidence"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#7c3aed"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="100%"
                      stopColor="#7c3aed"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 11,
                    fill: 'var(--color-muted-foreground)',
                  }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: 'var(--color-muted-foreground)',
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ForecastTooltipContent />} />

                {/* Confidence interval shaded area */}
                <Area
                  dataKey="confidenceLower"
                  stroke="none"
                  fill="transparent"
                  activeDot={false}
                  dot={false}
                />
                <Area
                  dataKey="confidenceUpper"
                  stroke="none"
                  fill="url(#forecast-confidence)"
                  activeDot={false}
                  dot={false}
                />

                {/* Historical line (solid) */}
                <Line
                  dataKey="historical"
                  type="monotone"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />

                {/* Forecast line (dashed) */}
                <Line
                  dataKey="forecast"
                  type="monotone"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />

                {/* Divider between historical and forecast */}
                {historicalValues.length > 0 && (
                  <ReferenceLine
                    x={`P${historicalValues.length}`}
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded-full bg-[#2563eb]" />
                Historical
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded-full bg-[#7c3aed]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #7c3aed 0, #7c3aed 4px, transparent 4px, transparent 7px)' }} />
                Forecast
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-sm bg-violet-500/15" />
                Confidence
              </span>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-muted/40 backdrop-blur-sm border border-border/30 px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Method:</span>
              <span className="font-medium text-foreground">
                {result.method}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">MAE:</span>
              <span className="font-medium text-foreground">
                {result.accuracy.mae.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">MAPE:</span>
              <span className="font-medium text-foreground">
                {result.accuracy.mape.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Trend:</span>
              {TrendIcon && (
                <TrendIcon
                  className={cn('h-3.5 w-3.5', trendColor)}
                  aria-hidden="true"
                />
              )}
              <span className={cn('font-medium capitalize', trendColor)}>
                {result.trend}
              </span>
            </div>

            {result.seasonality && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Seasonal
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
