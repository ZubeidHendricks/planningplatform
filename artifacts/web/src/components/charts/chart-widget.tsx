import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { cn } from '@/lib/utils';

const DEFAULT_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#06b6d4',
  '#d946ef',
  '#84cc16',
];

export interface ChartData {
  label: string;
  [key: string]: string | number;
}

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
}

export interface ChartWidgetProps {
  type: 'bar' | 'line' | 'pie' | 'waterfall' | 'combined' | 'area';
  data: ChartData[];
  series: ChartSeries[];
  title?: string;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showGrid?: boolean;
  stacked?: boolean;
  height?: number;
  className?: string;
}

function getSeriesColor(series: ChartSeries, index: number): string {
  return series.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? '#7c3aed';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltipContent({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-popover-foreground">{label}</p>
      {payload
        .filter((entry) => entry.dataKey !== '_waterfallBase')
        .map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-popover-foreground">
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
    </div>
  );
}

const LEGEND_LAYOUT_MAP: Record<string, 'horizontal' | 'vertical'> = {
  top: 'horizontal',
  bottom: 'horizontal',
  left: 'vertical',
  right: 'vertical',
};

function SharedCartesianElements({
  showGrid,
  showLegend,
  legendPosition,
}: {
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <>
      {showGrid && (
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
      )}
      <XAxis
        dataKey="label"
        tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        axisLine={{ stroke: 'var(--color-border)' }}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<CustomTooltipContent />} />
      {showLegend && (
        <Legend
          verticalAlign={
            legendPosition === 'top' || legendPosition === 'bottom'
              ? legendPosition
              : undefined
          }
          align={
            legendPosition === 'left' || legendPosition === 'right'
              ? legendPosition
              : undefined
          }
          layout={LEGEND_LAYOUT_MAP[legendPosition]}
          wrapperStyle={{ fontSize: 12 }}
        />
      )}
    </>
  );
}

function BarChartContent({
  data,
  series,
  stacked,
  showGrid,
  showLegend,
  legendPosition,
}: {
  data: ChartData[];
  series: ChartSeries[];
  stacked: boolean;
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <BarChart data={data}>
      <SharedCartesianElements
        showGrid={showGrid}
        showLegend={showLegend}
        legendPosition={legendPosition}
      />
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.name}
          fill={getSeriesColor(s, i)}
          stackId={stacked ? 'stack' : undefined}
          radius={[4, 4, 0, 0]}
        />
      ))}
    </BarChart>
  );
}

function LineChartContent({
  data,
  series,
  showGrid,
  showLegend,
  legendPosition,
}: {
  data: ChartData[];
  series: ChartSeries[];
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <LineChart data={data}>
      <SharedCartesianElements
        showGrid={showGrid}
        showLegend={showLegend}
        legendPosition={legendPosition}
      />
      {series.map((s, i) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.name}
          stroke={getSeriesColor(s, i)}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      ))}
    </LineChart>
  );
}

function AreaChartContent({
  data,
  series,
  stacked,
  showGrid,
  showLegend,
  legendPosition,
}: {
  data: ChartData[];
  series: ChartSeries[];
  stacked: boolean;
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <AreaChart data={data}>
      <defs>
        {series.map((s, i) => {
          const color = getSeriesColor(s, i);
          return (
            <linearGradient
              key={s.key}
              id={`gradient-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.1} />
            </linearGradient>
          );
        })}
      </defs>
      <SharedCartesianElements
        showGrid={showGrid}
        showLegend={showLegend}
        legendPosition={legendPosition}
      />
      {series.map((s, i) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.name}
          stroke={getSeriesColor(s, i)}
          strokeWidth={2}
          fill={`url(#gradient-${s.key})`}
          stackId={stacked ? 'stack' : undefined}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      ))}
    </AreaChart>
  );
}

function renderPieLabel(props: PieLabelRenderProps) {
  const { name, percent, x, y, midAngle } = props;
  const displayName = name ?? '';
  const displayPercent = typeof percent === 'number' ? percent : 0;
  const posX = typeof x === 'number' ? x : 0;
  const posY = typeof y === 'number' ? y : 0;
  const angle = typeof midAngle === 'number' ? midAngle : 0;
  const textAnchor = angle > 90 && angle < 270 ? 'end' : 'start';
  return (
    <text
      x={posX}
      y={posY}
      textAnchor={textAnchor}
      dominantBaseline="central"
      className="text-xs"
      fill="var(--color-muted-foreground)"
    >
      {displayName} ({(displayPercent * 100).toFixed(0)}%)
    </text>
  );
}

function PieChartContent({
  data,
  series,
  showLegend,
  legendPosition,
}: {
  data: ChartData[];
  series: ChartSeries[];
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}) {
  const primarySeries = series[0];
  if (!primarySeries) return null;

  const pieData = data.map((d) => ({
    name: d.label,
    value: typeof d[primarySeries.key] === 'number' ? d[primarySeries.key] : 0,
  }));

  return (
    <PieChart>
      <Pie
        data={pieData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius="60%"
        outerRadius="80%"
        paddingAngle={2}
        label={renderPieLabel}
        labelLine={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1 }}
      >
        {pieData.map((_, index) => (
          <Cell
            key={`cell-${index}`}
            fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
          />
        ))}
      </Pie>
      <Tooltip content={<CustomTooltipContent />} />
      {showLegend && (
        <Legend
          verticalAlign={
            legendPosition === 'top' || legendPosition === 'bottom'
              ? legendPosition
              : undefined
          }
          align={
            legendPosition === 'left' || legendPosition === 'right'
              ? legendPosition
              : undefined
          }
          layout={LEGEND_LAYOUT_MAP[legendPosition]}
          wrapperStyle={{ fontSize: 12 }}
        />
      )}
    </PieChart>
  );
}

interface WaterfallDatum {
  label: string;
  value: number;
  _waterfallBase: number;
  _waterfallDelta: number;
}

function WaterfallChartContent({
  data,
  series,
  showGrid,
  showLegend,
  legendPosition,
}: {
  data: ChartData[];
  series: ChartSeries[];
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}) {
  const primarySeries = series[0];
  if (!primarySeries) return null;

  const color = getSeriesColor(primarySeries, 0);

  const waterfallData: WaterfallDatum[] = useMemo(() => {
    let cumulative = 0;
    return data.map((d) => {
      const rawValue = d[primarySeries.key];
      const value = typeof rawValue === 'number' ? rawValue : 0;
      const base = value >= 0 ? cumulative : cumulative + value;
      const delta = Math.abs(value);
      cumulative += value;
      return {
        label: d.label,
        value,
        _waterfallBase: base,
        _waterfallDelta: delta,
      };
    });
  }, [data, primarySeries.key]);

  return (
    <BarChart data={waterfallData}>
      {showGrid && (
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
      )}
      <XAxis
        dataKey="label"
        tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        axisLine={{ stroke: 'var(--color-border)' }}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<CustomTooltipContent />} />
      {showLegend && (
        <Legend
          verticalAlign={
            legendPosition === 'top' || legendPosition === 'bottom'
              ? legendPosition
              : undefined
          }
          align={
            legendPosition === 'left' || legendPosition === 'right'
              ? legendPosition
              : undefined
          }
          layout={LEGEND_LAYOUT_MAP[legendPosition]}
          wrapperStyle={{ fontSize: 12 }}
        />
      )}
      <Bar
        dataKey="_waterfallBase"
        stackId="waterfall"
        fill="transparent"
        radius={0}
        name=""
        legendType="none"
      />
      <Bar
        dataKey="_waterfallDelta"
        stackId="waterfall"
        name={primarySeries.name}
        radius={[4, 4, 0, 0]}
      >
        {waterfallData.map((entry, index) => (
          <Cell
            key={`wf-cell-${index}`}
            fill={entry.value >= 0 ? color : 'var(--color-destructive)'}
          />
        ))}
      </Bar>
    </BarChart>
  );
}

function CombinedChartContent({
  data,
  series,
  stacked,
  showGrid,
  showLegend,
  legendPosition,
}: {
  data: ChartData[];
  series: ChartSeries[];
  stacked: boolean;
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
}) {
  const barSeries = series.filter((_, i) => i % 2 === 0);
  const lineSeries = series.filter((_, i) => i % 2 !== 0);

  return (
    <ComposedChart data={data}>
      {showGrid && (
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
      )}
      <XAxis
        dataKey="label"
        tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        axisLine={{ stroke: 'var(--color-border)' }}
        tickLine={false}
      />
      <YAxis
        yAxisId="left"
        tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<CustomTooltipContent />} />
      {showLegend && (
        <Legend
          verticalAlign={
            legendPosition === 'top' || legendPosition === 'bottom'
              ? legendPosition
              : undefined
          }
          align={
            legendPosition === 'left' || legendPosition === 'right'
              ? legendPosition
              : undefined
          }
          layout={LEGEND_LAYOUT_MAP[legendPosition]}
          wrapperStyle={{ fontSize: 12 }}
        />
      )}
      {barSeries.map((s, i) => (
        <Bar
          key={s.key}
          yAxisId="left"
          dataKey={s.key}
          name={s.name}
          fill={getSeriesColor(s, i * 2)}
          stackId={stacked ? 'stack' : undefined}
          radius={[4, 4, 0, 0]}
        />
      ))}
      {lineSeries.map((s, i) => (
        <Line
          key={s.key}
          yAxisId="right"
          type="monotone"
          dataKey={s.key}
          name={s.name}
          stroke={getSeriesColor(s, i * 2 + 1)}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      ))}
    </ComposedChart>
  );
}

export function ChartWidget({
  type,
  data,
  series,
  title,
  showLegend = false,
  legendPosition = 'bottom',
  showGrid = true,
  stacked = false,
  height = 300,
  className,
}: ChartWidgetProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {title && (
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {type === 'bar' ? (
          <BarChartContent
            data={data}
            series={series}
            stacked={stacked}
            showGrid={showGrid}
            showLegend={showLegend}
            legendPosition={legendPosition}
          />
        ) : type === 'line' ? (
          <LineChartContent
            data={data}
            series={series}
            showGrid={showGrid}
            showLegend={showLegend}
            legendPosition={legendPosition}
          />
        ) : type === 'area' ? (
          <AreaChartContent
            data={data}
            series={series}
            stacked={stacked}
            showGrid={showGrid}
            showLegend={showLegend}
            legendPosition={legendPosition}
          />
        ) : type === 'pie' ? (
          <PieChartContent
            data={data}
            series={series}
            showLegend={showLegend}
            legendPosition={legendPosition}
          />
        ) : type === 'waterfall' ? (
          <WaterfallChartContent
            data={data}
            series={series}
            showGrid={showGrid}
            showLegend={showLegend}
            legendPosition={legendPosition}
          />
        ) : type === 'combined' ? (
          <CombinedChartContent
            data={data}
            series={series}
            stacked={stacked}
            showGrid={showGrid}
            showLegend={showLegend}
            legendPosition={legendPosition}
          />
        ) : null}
      </ResponsiveContainer>
    </div>
  );
}
