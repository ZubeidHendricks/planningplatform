import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  title: string;
  value: number | string;
  format?: 'number' | 'currency' | 'percent';
  previousValue?: number;
  trendDirection?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  description?: string;
  sparklineData?: number[];
  color?: string;
  className?: string;
}

function abbreviateNumber(num: number): string {
  const absNum = Math.abs(num);
  if (absNum >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (absNum >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (absNum >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatValue(
  value: number | string,
  format: 'number' | 'currency' | 'percent'
): string {
  if (typeof value === 'string') {
    return value;
  }

  switch (format) {
    case 'currency':
      return `R${value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    case 'percent':
      return `${value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;
    case 'number':
    default:
      return abbreviateNumber(value);
  }
}

function computePercentChange(
  current: number | string,
  previous: number
): number | null {
  if (typeof current !== 'number' || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function TrendArrowUp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn('h-3.5 w-3.5', className)}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8 3.5a.5.5 0 0 1 .354.146l4 4a.5.5 0 0 1-.708.708L8.5 5.207V12a.5.5 0 0 1-1 0V5.207L4.354 8.354a.5.5 0 1 1-.708-.708l4-4A.5.5 0 0 1 8 3.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrendArrowDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn('h-3.5 w-3.5', className)}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8 12.5a.5.5 0 0 1-.354-.146l-4-4a.5.5 0 0 1 .708-.708L7.5 10.793V4a.5.5 0 0 1 1 0v6.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4A.5.5 0 0 1 8 12.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrendFlat({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn('h-3.5 w-3.5', className)}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrendIndicator({
  direction,
  label,
  percentChange,
}: {
  direction: 'up' | 'down' | 'flat';
  label?: string;
  percentChange: number | null;
}) {
  const colorClass =
    direction === 'up'
      ? 'text-success'
      : direction === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  const Arrow =
    direction === 'up'
      ? TrendArrowUp
      : direction === 'down'
        ? TrendArrowDown
        : TrendFlat;

  const displayText =
    label ??
    (percentChange !== null
      ? `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`
      : null);

  if (!displayText) return null;

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', colorClass)}>
      <Arrow />
      {displayText}
    </span>
  );
}

function Sparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data]
  );

  return (
    <ResponsiveContainer width="100%" height={30}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function KpiCard({
  title,
  value,
  format = 'number',
  previousValue,
  trendDirection,
  trendLabel,
  description,
  sparklineData,
  color = '#7c3aed',
  className,
}: KpiCardProps) {
  const formattedValue = formatValue(value, format);

  const percentChange = useMemo(() => {
    if (previousValue === undefined) return null;
    return computePercentChange(value, previousValue);
  }, [value, previousValue]);

  const resolvedDirection: 'up' | 'down' | 'flat' | undefined = useMemo(() => {
    if (trendDirection) return trendDirection;
    if (percentChange === null) return undefined;
    if (percentChange > 0) return 'up';
    if (percentChange < 0) return 'down';
    return 'flat';
  }, [trendDirection, percentChange]);

  const trimmedDescription = description
    ? description.length > 70
      ? `${description.slice(0, 67)}...`
      : description
    : null;

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm',
        className
      )}
    >
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold leading-none tracking-tight">
          {formattedValue}
        </span>
        {resolvedDirection && (
          <TrendIndicator
            direction={resolvedDirection}
            label={trendLabel}
            percentChange={percentChange}
          />
        )}
      </div>
      {trimmedDescription && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {trimmedDescription}
        </p>
      )}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2">
          <Sparkline data={sparklineData} color={color} />
        </div>
      )}
    </div>
  );
}
