import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import {
  useBoard,
  useUpdateBoardLayout,
  type BoardWidget,
} from '@/lib/hooks/use-boards';
import {
  Plus,
  GripVertical,
  X,
  BarChart3,
  Table,
  Hash,
  Type,
  Zap,
  Maximize2,
  Settings,
  Pencil,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  LayoutDashboard,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  Columns2,
  Columns3,
  Columns4,
  Droplets,
  Sparkles,
} from 'lucide-react';
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
  Cell as RechartsCell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { MessageSquare as CommentIcon, X as CloseIcon } from 'lucide-react';
import { CommentThread } from '@/components/comments/comment-thread';
import { useBlocks, type Block } from '@/lib/hooks/use-blocks';
import { useCells, type Cell } from '@/lib/hooks/use-cells';
import { useDimensions, useDimensionMembers, type Dimension } from '@/lib/hooks/use-dimensions';
import { useVersions } from '@/lib/hooks/use-versions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type WidgetType = BoardWidget['type'];
type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'waterfall';
type ColumnLayout = 2 | 3 | 4;

const CHART_COLORS = ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#f59e0b'];

const WIDGET_TYPE_COLORS: Record<WidgetType, string> = {
  chart: 'text-violet-500',
  grid: 'text-blue-500',
  kpi: 'text-amber-500',
  text: 'text-gray-500',
  action: 'text-emerald-500',
};

const WIDGET_TYPE_BG: Record<WidgetType, string> = {
  chart: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800',
  grid: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  kpi: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  text: 'bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-800',
  action: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
};

const WIDGET_ICONS: Record<WidgetType, typeof BarChart3> = {
  grid: Table,
  chart: BarChart3,
  kpi: Hash,
  text: Type,
  action: Zap,
};

const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  grid: 'Data table with rows and columns',
  chart: 'Bar, line, area, pie, or waterfall chart',
  kpi: 'Key performance indicator card',
  text: 'Rich text block for notes and labels',
  action: 'Interactive card linking to boards or URLs',
};

const SAMPLE_CHART_DATA = [
  { label: 'Jan', value: 4200, budget: 5000 },
  { label: 'Feb', value: 5100, budget: 5000 },
  { label: 'Mar', value: 4800, budget: 5200 },
  { label: 'Apr', value: 6200, budget: 5500 },
  { label: 'May', value: 5800, budget: 5800 },
  { label: 'Jun', value: 7100, budget: 6000 },
];

const SAMPLE_GRID_COLUMNS = ['Product', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'];
const SAMPLE_GRID_ROWS = [
  ['Revenue', '12,400', '15,200', '14,800', '18,600', '61,000'],
  ['COGS', '6,200', '7,600', '7,400', '9,300', '30,500'],
  ['Gross Margin', '6,200', '7,600', '7,400', '9,300', '30,500'],
  ['OpEx', '3,100', '3,400', '3,200', '3,800', '13,500'],
  ['EBITDA', '3,100', '4,200', '4,200', '5,500', '17,000'],
];

const CHART_TYPE_OPTIONS: { type: ChartType; icon: typeof BarChart3; label: string }[] = [
  { type: 'bar', icon: BarChart3, label: 'Bar' },
  { type: 'line', icon: LineChartIcon, label: 'Line' },
  { type: 'area', icon: AreaChartIcon, label: 'Area' },
  { type: 'pie', icon: PieChartIcon, label: 'Pie' },
  { type: 'waterfall', icon: Droplets, label: 'Waterfall' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKpiValue(
  value: number,
  format: 'number' | 'currency' | 'percent',
): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}

function getDefaultConfig(type: WidgetType): Record<string, unknown> {
  switch (type) {
    case 'chart':
      return {
        chartType: 'bar' as ChartType,
        chartData: SAMPLE_CHART_DATA,
      };
    case 'kpi':
      return {
        value: 127500,
        previousValue: 118000,
        format: 'currency',
      };
    case 'text':
      return {
        content: '# Heading\n\nAdd your text content here.',
        mode: 'open',
        bgColor: '#f1f5f9',
      };
    case 'action':
      return {
        actionType: 'card',
        label: 'View Report',
        description: 'Navigate to the detailed report dashboard',
        icon: 'BarChart3',
        link: '',
        bgColor: '#7c3aed',
      };
    case 'grid':
      return {};
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Block-data transformation helpers
// ---------------------------------------------------------------------------

function transformCellsForChart(
  cells: Cell[],
  groupByKey: string,
): { label: string; value: number }[] {
  const groups = new Map<string, number>();
  for (const cell of cells) {
    const key = cell.coordinates?.[groupByKey] ?? 'Unknown';
    groups.set(key, (groups.get(key) ?? 0) + (cell.numericValue ?? 0));
  }
  return Array.from(groups.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function transformCellsForKpi(cells: Cell[]): {
  value: number;
  previousValue: number;
} {
  const value = cells.reduce((sum, c) => sum + (c.numericValue ?? 0), 0);
  return { value, previousValue: 0 };
}

function transformCellsForGrid(
  blockCells: { block: Block; cells: Cell[] }[],
  memberNameMap?: Map<string, string>,
): { columns: string[]; rows: string[][] } {
  let colKey = 'column';
  for (const { cells } of blockCells) {
    if (cells.length > 0 && cells[0]) {
      const keys = Object.keys(cells[0].coordinates ?? {});
      if (keys.length > 0) colKey = keys[keys.length - 1]!;
      break;
    }
  }

  const columnSet = new Set<string>();
  for (const { cells } of blockCells) {
    for (const cell of cells) {
      const col = cell.coordinates?.[colKey];
      if (col) columnSet.add(col);
    }
  }
  const sortedColumns = Array.from(columnSet).sort();
  const displayColumns = sortedColumns.map((c) => memberNameMap?.get(c) ?? c);
  const columns = ['Block', ...displayColumns];

  const rows: string[][] = blockCells.map(({ block, cells }) => {
    const colTotals = new Map<string, number>();
    for (const cell of cells) {
      const col = cell.coordinates?.[colKey];
      if (col && cell.numericValue != null) {
        colTotals.set(col, (colTotals.get(col) ?? 0) + cell.numericValue);
      }
    }
    return [
      block.name,
      ...sortedColumns.map((col) => {
        const v = colTotals.get(col);
        return v != null ? new Intl.NumberFormat('en-US').format(v) : '-';
      }),
    ];
  });

  return { columns, rows };
}

// ---------------------------------------------------------------------------
// Block-aware content wrappers
// ---------------------------------------------------------------------------

function ChartBlockDataProvider({
  config,
  workspaceSlug,
  appSlug,
  versionId,
}: {
  config: Record<string, unknown>;
  workspaceSlug: string;
  appSlug: string;
  versionId?: string;
}) {
  const { data: allBlocks } = useBlocks(workspaceSlug, appSlug);
  const { data: allDimensions } = useDimensions(workspaceSlug, appSlug);
  const blockSlug = config.blockSlug as string | undefined;
  const blockIdFromConfig = config.blockId as string | undefined;
  const dimensionSlug = config.dimensionSlug as string | undefined;

  const resolvedBlockId = useMemo(() => {
    if (blockIdFromConfig) return blockIdFromConfig;
    if (blockSlug && allBlocks) return allBlocks.find((b) => b.slug === blockSlug)?.id;
    return undefined;
  }, [blockIdFromConfig, blockSlug, allBlocks]);

  const targetDim = useMemo(() => {
    if (!dimensionSlug || !allDimensions) return undefined;
    return allDimensions.find((d) => d.slug === dimensionSlug);
  }, [dimensionSlug, allDimensions]);

  const { data: cells } = useCells(workspaceSlug, appSlug, resolvedBlockId, versionId || undefined);
  const { data: dimMembers } = useDimensionMembers(workspaceSlug, appSlug, targetDim?.id);

  const resolvedConfig = useMemo(() => {
    if (!resolvedBlockId || !cells || cells.length === 0) {
      return config;
    }
    const groupKey = dimensionSlug || 'column';
    const chartData = transformCellsForChart(cells, groupKey);
    if (dimMembers && dimMembers.length > 0) {
      const idToName = new Map(dimMembers.map((m) => [m.id, m.name]));
      for (const item of chartData) {
        item.label = idToName.get(item.label) ?? item.label;
      }
    }
    return { ...config, chartData };
  }, [resolvedBlockId, cells, dimensionSlug, dimMembers, config]);

  return <ChartWidgetContent config={resolvedConfig} />;
}

function KpiBlockDataProvider({
  config,
  workspaceSlug,
  appSlug,
  versionId,
}: {
  config: Record<string, unknown>;
  workspaceSlug: string;
  appSlug: string;
  versionId?: string;
}) {
  const { data: allBlocks } = useBlocks(workspaceSlug, appSlug);
  const blockSlug = config.blockSlug as string | undefined;
  const blockIdFromConfig = config.blockId as string | undefined;

  const resolvedBlockId = useMemo(() => {
    if (blockIdFromConfig) return blockIdFromConfig;
    if (blockSlug && allBlocks) return allBlocks.find((b) => b.slug === blockSlug)?.id;
    return undefined;
  }, [blockIdFromConfig, blockSlug, allBlocks]);

  const { data: cells } = useCells(workspaceSlug, appSlug, resolvedBlockId, versionId || undefined);

  const resolvedConfig = useMemo(() => {
    if (!resolvedBlockId || !cells || cells.length === 0) {
      return config;
    }
    const kpiData = transformCellsForKpi(cells);
    return { ...config, value: kpiData.value, previousValue: kpiData.previousValue };
  }, [resolvedBlockId, cells, config]);

  return <KpiWidgetContent config={resolvedConfig} />;
}

function GridBlockDataProvider({
  config,
  workspaceSlug,
  appSlug,
  versionId,
}: {
  config: Record<string, unknown>;
  workspaceSlug: string;
  appSlug: string;
  versionId?: string;
}) {
  const blockId = config.blockId as string | undefined;
  const blockSlugs = config.blockSlugs as string[] | undefined;
  const { data: allBlocks } = useBlocks(workspaceSlug, appSlug);
  const { data: allDimensions } = useDimensions(workspaceSlug, appSlug);

  const targetBlockIds = useMemo(() => {
    if (!allBlocks) return [];
    if (blockSlugs && blockSlugs.length > 0) {
      return allBlocks
        .filter((b) => blockSlugs.includes(b.slug))
        .map((b) => b.id);
    }
    if (blockId) return [blockId];
    return [];
  }, [allBlocks, blockSlugs, blockId]);

  const lastDimId = allDimensions && allDimensions.length > 0
    ? allDimensions[allDimensions.length - 1]!.id
    : undefined;
  const { data: colMembers } = useDimensionMembers(workspaceSlug, appSlug, lastDimId);

  const memberNameMap = useMemo(() => {
    if (!colMembers) return undefined;
    return new Map(colMembers.map((m) => [m.id, m.name]));
  }, [colMembers]);

  const effectiveVersionId = versionId || undefined;
  const { data: cells0 } = useCells(workspaceSlug, appSlug, targetBlockIds[0] ?? undefined, effectiveVersionId);
  const { data: cells1 } = useCells(workspaceSlug, appSlug, targetBlockIds[1] ?? undefined, effectiveVersionId);
  const { data: cells2 } = useCells(workspaceSlug, appSlug, targetBlockIds[2] ?? undefined, effectiveVersionId);
  const { data: cells3 } = useCells(workspaceSlug, appSlug, targetBlockIds[3] ?? undefined, effectiveVersionId);
  const { data: cells4 } = useCells(workspaceSlug, appSlug, targetBlockIds[4] ?? undefined, effectiveVersionId);

  const gridData = useMemo(() => {
    if (!allBlocks || targetBlockIds.length === 0) return null;
    const cellArrays = [cells0, cells1, cells2, cells3, cells4];
    const blockCells: { block: Block; cells: Cell[] }[] = [];
    for (let i = 0; i < targetBlockIds.length && i < 5; i++) {
      const block = allBlocks.find((b) => b.id === targetBlockIds[i]);
      const cells = cellArrays[i];
      if (block && cells) {
        blockCells.push({ block, cells });
      }
    }
    if (blockCells.length === 0) return null;
    return transformCellsForGrid(blockCells, memberNameMap);
  }, [allBlocks, targetBlockIds, cells0, cells1, cells2, cells3, cells4, memberNameMap]);

  if (!gridData) {
    return <GridWidgetContent />;
  }

  return <GridWidgetContent columns={gridData.columns} rows={gridData.rows} />;
}

// ---------------------------------------------------------------------------
// Widget Content Components
// ---------------------------------------------------------------------------

function GridWidgetContent({
  columns,
  rows,
}: {
  columns?: string[];
  rows?: string[][];
}) {
  const gridColumns = columns ?? SAMPLE_GRID_COLUMNS;
  const gridRows = rows ?? SAMPLE_GRID_ROWS;

  return (
    <div className="h-full w-full overflow-auto p-1">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr>
            {gridColumns.map((col, i) => (
              <th
                key={col}
                className={cn(
                  'px-2 py-1.5 text-left font-semibold bg-muted/80 text-foreground border-b border-border whitespace-nowrap',
                  i > 0 && 'text-right',
                )}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gridRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={cn(
                'transition-colors hover:bg-primary/5',
                rowIdx % 2 === 1 && 'bg-muted/30',
              )}
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={cn(
                    'px-2 py-1 border-b border-border/50 whitespace-nowrap',
                    cellIdx === 0
                      ? 'font-medium text-foreground'
                      : 'text-right text-muted-foreground tabular-nums',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartWidgetContent({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const chartType = (config.chartType as ChartType) ?? 'bar';
  const chartData = (config.chartData as typeof SAMPLE_CHART_DATA) ?? SAMPLE_CHART_DATA;

  const pieData = useMemo(
    () =>
      chartData.map((item, idx) => ({
        name: item.label,
        value: item.value,
        fill: CHART_COLORS[idx % CHART_COLORS.length],
      })),
    [chartData],
  );

  // Waterfall data transformation
  const waterfallData = useMemo(() => {
    if (chartType !== 'waterfall') return [];
    let cumulative = 0;
    return chartData.map((d) => {
      const value = d.value;
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
  }, [chartType, chartData]);

  const tooltipStyle = {
    fontSize: 11,
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-card)',
  };

  return (
    <div className="h-full w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'bar' ? (
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="value" name="Actual" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
            <Bar dataKey="budget" name="Budget" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="value"
              name="Actual"
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS[0] }}
            />
            <Line
              type="monotone"
              dataKey="budget"
              name="Budget"
              stroke={CHART_COLORS[1]}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: CHART_COLORS[1] }}
            />
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="value"
              name="Actual"
              stroke={CHART_COLORS[0]}
              fill={CHART_COLORS[0]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="budget"
              name="Budget"
              stroke={CHART_COLORS[1]}
              fill={CHART_COLORS[1]}
              fillOpacity={0.08}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          </AreaChart>
        ) : chartType === 'waterfall' ? (
          <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val, name) => {
                if (name === '') return [null, null];
                const numVal = typeof val === 'number' ? val : Number(val);
                return [numVal.toLocaleString(), name];
              }}
            />
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
              name="Value"
              radius={[3, 3, 0, 0]}
            >
              {waterfallData.map((entry, idx) => (
                <RechartsCell
                  key={`wf-${idx}`}
                  fill={entry.value >= 0 ? CHART_COLORS[0] : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="75%"
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1 }}
            >
              {pieData.map((entry, idx) => (
                <RechartsCell key={`cell-${idx}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function KpiWidgetContent({ config }: { config: Record<string, unknown> }) {
  const value = (config.value as number) ?? 0;
  const previousValue = (config.previousValue as number) ?? 0;
  const format = (config.format as 'number' | 'currency' | 'percent') ?? 'number';

  const changePercent =
    previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : 0;
  const isPositive = changePercent >= 0;

  return (
    <div className="h-full flex flex-col items-center justify-center gap-1 px-4">
      <span className="text-3xl font-bold text-foreground tabular-nums leading-none">
        {formatKpiValue(value, format)}
      </span>
      <div
        className={cn(
          'flex items-center gap-1 text-xs font-medium',
          isPositive ? 'text-emerald-600' : 'text-red-500',
        )}
      >
        {isPositive ? (
          <TrendingUp className="h-3.5 w-3.5" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5" />
        )}
        <span>{isPositive ? '+' : ''}{changePercent.toFixed(1)}%</span>
        <span className="text-muted-foreground font-normal ml-0.5">vs prev</span>
      </div>
      {previousValue > 0 && (
        <span className="text-[10px] text-muted-foreground">
          prev: {formatKpiValue(previousValue, format)}
        </span>
      )}
    </div>
  );
}

function TextWidgetContent({
  config,
  isEditing,
  onUpdateConfig,
}: {
  config: Record<string, unknown>;
  isEditing: boolean;
  onUpdateConfig: (updates: Record<string, unknown>) => void;
}) {
  const content = (config.content as string) ?? '';
  const mode = (config.mode as 'open' | 'filled') ?? 'open';
  const bgColor = (config.bgColor as string) ?? '#f1f5f9';
  const [localContent, setLocalContent] = useState(content);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  useEffect(() => {
    if (isTextEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, [isTextEditing]);

  const handleBlur = () => {
    setIsTextEditing(false);
    if (localContent !== content) {
      onUpdateConfig({ content: localContent });
    }
  };

  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={i} className="text-sm font-semibold text-foreground mb-1">
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} className="text-base font-bold text-foreground mb-1">
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={i} className="text-lg font-bold text-foreground mb-1">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      return (
        <p key={i} className="text-xs text-muted-foreground leading-relaxed">
          {line}
        </p>
      );
    });
  };

  const isFilled = mode === 'filled';

  return (
    <div
      className={cn(
        'h-full w-full overflow-auto',
        isFilled ? 'p-3 rounded-b-2xl' : 'px-3 py-2',
      )}
      style={isFilled ? { backgroundColor: bgColor } : undefined}
    >
      {isEditing && isTextEditing ? (
        <textarea
          ref={textareaRef}
          className="w-full h-full resize-none bg-transparent text-xs text-foreground outline-none font-mono"
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <div
          className={cn('h-full', isEditing && 'cursor-text')}
          onClick={() => isEditing && setIsTextEditing(true)}
        >
          {renderContent(localContent)}
        </div>
      )}
    </div>
  );
}

function ActionWidgetContent({
  config,
  navigate,
}: {
  config: Record<string, unknown>;
  navigate: (path: string) => void;
}) {
  const actionType = (config.actionType as 'card' | 'button') ?? 'card';
  const label = (config.label as string) ?? 'Action';
  const description = (config.description as string) ?? '';
  const link = (config.link as string) ?? '';
  const bgColor = (config.bgColor as string) ?? '#7c3aed';

  const handleClick = () => {
    if (!link) return;
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      navigate(link);
    }
  };

  const isExternal =
    link.startsWith('http://') || link.startsWith('https://');

  if (actionType === 'button') {
    return (
      <div className="h-full flex items-center justify-center p-3">
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: bgColor }}
        >
          {isExternal ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
        style={{ backgroundColor: bgColor }}
      >
        <LayoutDashboard className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed max-w-[180px]">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: bgColor }}
      >
        {isExternal ? (
          <ExternalLink className="h-3 w-3" />
        ) : (
          <ArrowRight className="h-3 w-3" />
        )}
        Open
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart Type Selector
// ---------------------------------------------------------------------------

function ChartTypeSelector({
  currentType,
  onSelect,
}: {
  currentType: ChartType;
  onSelect: (type: ChartType) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
      {CHART_TYPE_OPTIONS.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors',
            currentType === type
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Widget Dropdown
// ---------------------------------------------------------------------------

function AddWidgetDropdown({
  onAdd,
  onClose,
}: {
  onAdd: (type: WidgetType) => void;
  onClose: () => void;
}) {
  const types: WidgetType[] = ['chart', 'kpi', 'grid', 'text', 'action'];
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 z-50 w-72 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-win-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border/50">
        <p className="text-xs font-semibold text-foreground">Add Widget</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Choose a type for your board</p>
      </div>
      <div className="p-2 space-y-0.5">
        {types.map((type) => {
          const Icon = WIDGET_ICONS[type];
          return (
            <button
              key={type}
              onClick={() => {
                onAdd(type);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all hover:bg-muted/60 active:scale-[0.98] group"
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                  WIDGET_TYPE_BG[type],
                )}
              >
                <Icon className={cn('h-4 w-4', WIDGET_TYPE_COLORS[type])} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground capitalize">{type}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">
                  {WIDGET_DESCRIPTIONS[type]}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget Settings Panel (modal)
// ---------------------------------------------------------------------------

function WidgetSettingsPanel({
  widget,
  onClose,
  onUpdateConfig,
  onUpdateTitle,
  blocks,
  dimensions,
}: {
  widget: BoardWidget;
  onClose: () => void;
  onUpdateConfig: (updates: Record<string, unknown>) => void;
  onUpdateTitle: (title: string) => void;
  blocks: Block[];
  dimensions: Dimension[];
}) {
  const [title, setTitle] = useState(widget.title);
  const showBlockSelector =
    widget.type === 'chart' || widget.type === 'kpi' || widget.type === 'grid';
  const showDimensionSelector = widget.type === 'chart';
  const showBlockSlugsSelector = widget.type === 'grid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-win-lg w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
          <h2 className="text-sm font-bold text-foreground">Widget Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Title
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => onUpdateTitle(title)}
            />
          </div>

          {/* Data Source: Block selector */}
          {showBlockSelector && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Data Source (Block)
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={(widget.config.blockId as string) ?? ''}
                onChange={(e) =>
                  onUpdateConfig({
                    blockId: e.target.value || undefined,
                  })
                }
              >
                <option value="">-- Sample data (no block) --</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.blockType})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Select a block to display its cell data. Leave empty for sample data.
              </p>
            </div>
          )}

          {/* Grid: multiple blocks selector */}
          {showBlockSlugsSelector && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Grid Blocks (multi-row)
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-input rounded-xl p-2 bg-background">
                {blocks.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">No blocks available</p>
                )}
                {blocks.map((b) => {
                  const currentSlugs =
                    (widget.config.blockSlugs as string[]) ?? [];
                  const isChecked = currentSlugs.includes(b.slug);
                  return (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const next = isChecked
                            ? currentSlugs.filter((s) => s !== b.slug)
                            : [...currentSlugs, b.slug];
                          onUpdateConfig({ blockSlugs: next });
                        }}
                        className="rounded border-input"
                      />
                      {b.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chart: Dimension selector */}
          {showDimensionSelector && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Group By (X-axis dimension)
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={(widget.config.dimensionSlug as string) ?? ''}
                onChange={(e) =>
                  onUpdateConfig({
                    dimensionSlug: e.target.value || undefined,
                  })
                }
              >
                <option value="">-- column coordinate (default) --</option>
                {dimensions.map((d) => (
                  <option key={d.id} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Chart type selector */}
          {widget.type === 'chart' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Chart Type
              </label>
              <ChartTypeSelector
                currentType={(widget.config.chartType as ChartType) ?? 'bar'}
                onSelect={(type) => onUpdateConfig({ chartType: type })}
              />
            </div>
          )}

          {/* KPI format */}
          {widget.type === 'kpi' && (
            <>
              {!widget.config.blockId && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Value (manual)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={(widget.config.value as number) ?? 0}
                    onChange={(e) =>
                      onUpdateConfig({ value: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Format
                </label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={(widget.config.format as string) ?? 'number'}
                  onChange={(e) => onUpdateConfig({ format: e.target.value })}
                >
                  <option value="number">Number</option>
                  <option value="currency">Currency</option>
                  <option value="percent">Percent</option>
                </select>
              </div>
            </>
          )}

          {/* Text mode */}
          {widget.type === 'text' && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Display Mode
                </label>
                <div className="flex gap-2">
                  {(['open', 'filled'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onUpdateConfig({ mode })}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors capitalize',
                        (widget.config.mode as string) === mode
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-input hover:border-primary/50',
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              {(widget.config.mode as string) === 'filled' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Background Color
                  </label>
                  <input
                    type="color"
                    className="w-full h-8 rounded-xl border border-input cursor-pointer"
                    value={(widget.config.bgColor as string) ?? '#f1f5f9'}
                    onChange={(e) => onUpdateConfig({ bgColor: e.target.value })}
                  />
                </div>
              )}
            </>
          )}

          {/* Action settings */}
          {widget.type === 'action' && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Action Type
                </label>
                <div className="flex gap-2">
                  {(['card', 'button'] as const).map((actionType) => (
                    <button
                      key={actionType}
                      onClick={() => onUpdateConfig({ actionType })}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors capitalize',
                        (widget.config.actionType as string) === actionType
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-input hover:border-primary/50',
                      )}
                    >
                      {actionType}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Label
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={(widget.config.label as string) ?? ''}
                  onChange={(e) => onUpdateConfig({ label: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={(widget.config.description as string) ?? ''}
                  onChange={(e) =>
                    onUpdateConfig({ description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Link (URL or board slug)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={(widget.config.link as string) ?? ''}
                  onChange={(e) => onUpdateConfig({ link: e.target.value })}
                  placeholder="https://... or /workspace/apps/..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Accent Color
                </label>
                <input
                  type="color"
                  className="w-full h-8 rounded-xl border border-input cursor-pointer"
                  value={(widget.config.bgColor as string) ?? '#7c3aed'}
                  onChange={(e) => onUpdateConfig({ bgColor: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border/50 bg-muted/30 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded Widget Modal
// ---------------------------------------------------------------------------

function ExpandedWidgetModal({
  widget,
  isEditMode,
  onClose,
  onUpdateConfig,
  navigate,
  workspaceSlug,
  appSlug,
  versionId,
}: {
  widget: BoardWidget;
  isEditMode: boolean;
  onClose: () => void;
  onUpdateConfig: (id: string, updates: Record<string, unknown>) => void;
  navigate: (path: string) => void;
  workspaceSlug: string;
  appSlug: string;
  versionId?: string;
}) {
  const Icon = WIDGET_ICONS[widget.type] ?? Type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-win-lg w-full max-w-4xl mx-4 h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4', WIDGET_TYPE_COLORS[widget.type])} />
            <span className="text-sm font-semibold text-foreground">
              {widget.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <WidgetBody
            widget={widget}
            isEditMode={isEditMode}
            onUpdateConfig={(updates) => onUpdateConfig(widget.id, updates)}
            navigate={navigate}
            workspaceSlug={workspaceSlug}
            appSlug={appSlug}
            versionId={versionId}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget Body (content routing)
// ---------------------------------------------------------------------------

function WidgetBody({
  widget,
  isEditMode,
  onUpdateConfig,
  navigate,
  workspaceSlug,
  appSlug,
  versionId,
}: {
  widget: BoardWidget;
  isEditMode: boolean;
  onUpdateConfig: (updates: Record<string, unknown>) => void;
  navigate: (path: string) => void;
  workspaceSlug: string;
  appSlug: string;
  versionId?: string;
}) {
  switch (widget.type) {
    case 'grid':
      return (
        <GridBlockDataProvider
          config={widget.config}
          workspaceSlug={workspaceSlug}
          appSlug={appSlug}
          versionId={versionId}
        />
      );
    case 'chart':
      return (
        <ChartBlockDataProvider
          config={widget.config}
          workspaceSlug={workspaceSlug}
          appSlug={appSlug}
          versionId={versionId}
        />
      );
    case 'kpi':
      return (
        <KpiBlockDataProvider
          config={widget.config}
          workspaceSlug={workspaceSlug}
          appSlug={appSlug}
          versionId={versionId}
        />
      );
    case 'text':
      return (
        <TextWidgetContent
          config={widget.config}
          isEditing={isEditMode}
          onUpdateConfig={onUpdateConfig}
        />
      );
    case 'action':
      return <ActionWidgetContent config={widget.config} navigate={navigate} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
          Unknown widget type
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Widget Card (Windows 11 styled with drag handle)
// ---------------------------------------------------------------------------

function WidgetCard({
  widget,
  isEditMode,
  isFocused,
  isDragOver,
  onFocus,
  onRemove,
  onExpand,
  onOpenSettings,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  children,
}: {
  widget: BoardWidget;
  isEditMode: boolean;
  isFocused: boolean;
  isDragOver: boolean;
  onFocus: () => void;
  onRemove: () => void;
  onExpand: () => void;
  onOpenSettings: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  const Icon = WIDGET_ICONS[widget.type] ?? Type;

  return (
    <div
      className={cn(
        'rounded-3xl bg-card/70 backdrop-blur-xl border overflow-hidden flex flex-col transition-all duration-200 group',
        isFocused
          ? 'border-primary/60 shadow-win-lg ring-1 ring-primary/20'
          : 'border-border/50 shadow-win hover:shadow-win-lg',
        isDragOver && 'ring-2 ring-primary/40 border-primary/40 scale-[1.01]',
        isEditMode && 'cursor-default',
      )}
      style={{ minHeight: '200px' }}
      onClick={(e) => {
        e.stopPropagation();
        onFocus();
      }}
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isEditMode && (
            <GripVertical
              className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0 hover:text-muted-foreground transition-colors"
            />
          )}
          <Icon
            className={cn('h-3.5 w-3.5 shrink-0', WIDGET_TYPE_COLORS[widget.type])}
          />
          <span className="text-xs font-medium text-foreground truncate">
            {widget.title}
          </span>
        </div>
        <div className={cn(
          'flex items-center gap-0.5 shrink-0 transition-opacity',
          !isEditMode && 'opacity-0 group-hover:opacity-100',
        )}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Expand"
            aria-label="Expand widget"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          {isEditMode && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings();
                }}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Settings"
                aria-label="Widget settings"
              >
                <Settings className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Remove"
                aria-label="Remove widget"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Widget body */}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Selectors (global filter bar)
// ---------------------------------------------------------------------------

function PageSelectors({
  dimensions,
  versions,
  workspaceSlug,
  appSlug,
  selectedVersionId,
  onVersionChange,
}: {
  dimensions: Dimension[];
  versions: { id: string; name: string; versionType: string }[];
  workspaceSlug: string;
  appSlug: string;
  selectedVersionId: string;
  onVersionChange: (versionId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/10">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mr-1">
        Filters
      </span>
      {versions.length > 0 && (
        <select
          className="px-2.5 py-1 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={selectedVersionId}
          onChange={(e) => onVersionChange(e.target.value)}
        >
          <option value="">All Versions</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      )}
      {dimensions.map((dim) => (
        <DimensionFilterDropdown
          key={dim.id}
          dimension={dim}
          workspaceSlug={workspaceSlug}
          appSlug={appSlug}
        />
      ))}
    </div>
  );
}

function DimensionFilterDropdown({
  dimension,
  workspaceSlug,
  appSlug,
}: {
  dimension: Dimension;
  workspaceSlug: string;
  appSlug: string;
}) {
  const { data: members } = useDimensionMembers(workspaceSlug, appSlug, dimension.id);
  const [selected, setSelected] = useState('');

  return (
    <select
      className="px-2.5 py-1 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      value={selected}
      onChange={(e) => setSelected(e.target.value)}
    >
      <option value="">All {dimension.name}</option>
      {(Array.isArray(members) ? members : []).map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Layout Toggle
// ---------------------------------------------------------------------------

function LayoutToggle({
  columns,
  onChange,
}: {
  columns: ColumnLayout;
  onChange: (cols: ColumnLayout) => void;
}) {
  const options: { cols: ColumnLayout; icon: typeof Columns2; label: string }[] = [
    { cols: 2, icon: Columns2, label: '2 col' },
    { cols: 3, icon: Columns3, label: '3 col' },
    { cols: 4, icon: Columns4, label: '4 col' },
  ];

  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-muted/40 rounded-2xl border border-border/30">
      {options.map(({ cols, icon: Icon, label }) => (
        <button
          key={cols}
          onClick={() => onChange(cols)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all',
            columns === cols
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          title={label}
          aria-label={`${label} layout`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyBoardState({
  onAddWidget,
  isEditMode,
}: {
  onAddWidget: () => void;
  isEditMode: boolean;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm mx-auto px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-100 to-blue-50 dark:from-violet-950/40 dark:to-blue-950/30 flex items-center justify-center shadow-win">
          <Sparkles className="h-9 w-9 text-violet-400 dark:text-violet-500" />
        </div>
        <h3 className="text-base font-bold text-foreground mb-1.5">
          Add your first widget
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Build your dashboard by adding charts, KPI cards, data grids, and more.
          Switch to edit mode to start designing.
        </p>
        {isEditMode ? (
          <button
            onClick={onAddWidget}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-2xl text-sm font-medium hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-win"
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </button>
        ) : (
          <p className="text-xs text-muted-foreground/70 italic">
            Click "Edit" in the toolbar to begin
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Board Detail Page
// ---------------------------------------------------------------------------

export function BoardDetailPage() {
  const { workspaceSlug, appSlug, boardSlug } = useParams();
  const navigate = useNavigate();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';
  const { data: board, isLoading } = useBoard(slug, app, boardSlug ?? '');
  const updateLayout = useUpdateBoardLayout();
  const { data: blocks = [] } = useBlocks(slug, app);
  const { data: dimensions = [] } = useDimensions(slug, app);
  const { data: versions = [] } = useVersions(slug, app);

  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [focusedWidgetId, setFocusedWidgetId] = useState<string | null>(null);
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  const [settingsWidgetId, setSettingsWidgetId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [columnLayout, setColumnLayout] = useState<ColumnLayout>(3);

  // HTML5 drag-and-drop state
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const widgets: BoardWidget[] = useMemo(
    () => (Array.isArray(board?.layout) ? (board.layout as BoardWidget[]) : []),
    [board?.layout],
  );

  const persistWidgets = useCallback(
    (updated: BoardWidget[]) => {
      if (!board) return;
      updateLayout.mutate({
        workspaceSlug: slug,
        appSlug: app,
        boardSlug: boardSlug ?? '',
        layout: updated,
      });
    },
    [board, slug, app, boardSlug, updateLayout],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      const newWidget: BoardWidget = {
        id: `widget-${Date.now()}`,
        type,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        x: 0,
        y: Infinity,
        w: 4,
        h: 3,
        config: getDefaultConfig(type),
      };
      persistWidgets([...widgets, newWidget]);
    },
    [widgets, persistWidgets],
  );

  const removeWidget = useCallback(
    (id: string) => {
      persistWidgets(widgets.filter((w) => w.id !== id));
      if (focusedWidgetId === id) setFocusedWidgetId(null);
    },
    [widgets, persistWidgets, focusedWidgetId],
  );

  const updateWidgetConfig = useCallback(
    (id: string, updates: Record<string, unknown>) => {
      const updated = widgets.map((w) =>
        w.id === id ? { ...w, config: { ...w.config, ...updates } } : w,
      );
      persistWidgets(updated);
    },
    [widgets, persistWidgets],
  );

  const updateWidgetTitle = useCallback(
    (id: string, title: string) => {
      const updated = widgets.map((w) =>
        w.id === id ? { ...w, title } : w,
      );
      persistWidgets(updated);
    },
    [widgets, persistWidgets],
  );

  // ----- HTML5 drag-and-drop handlers -----

  const handleDragStart = useCallback(
    (e: React.DragEvent, widgetId: string) => {
      setDragSourceId(widgetId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', widgetId);
      // Make the drag image semi-transparent
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = '0.5';
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, widgetId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (widgetId !== dragSourceId) {
        setDragOverId(widgetId);
      }
    },
    [dragSourceId],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = '1';
      }
      setDragSourceId(null);
      setDragOverId(null);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData('text/plain');
      if (!sourceId || sourceId === targetId) {
        setDragSourceId(null);
        setDragOverId(null);
        return;
      }

      const sourceIdx = widgets.findIndex((w) => w.id === sourceId);
      const targetIdx = widgets.findIndex((w) => w.id === targetId);

      if (sourceIdx === -1 || targetIdx === -1) {
        setDragSourceId(null);
        setDragOverId(null);
        return;
      }

      // Reorder: remove source and insert at target position
      const reordered = [...widgets];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, moved!);

      persistWidgets(reordered);
      setDragSourceId(null);
      setDragOverId(null);
    },
    [widgets, persistWidgets],
  );

  const expandedWidget = expandedWidgetId
    ? widgets.find((w) => w.id === expandedWidgetId) ?? null
    : null;

  const settingsWidget = settingsWidgetId
    ? widgets.find((w) => w.id === settingsWidgetId) ?? null
    : null;

  // Column layout CSS class
  const gridColsClass =
    columnLayout === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columnLayout === 4
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Not found state
  if (!board) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Board not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="border-b border-border/50 bg-card/70 backdrop-blur-xl px-4 py-3 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">
            {board.name}
          </h1>
          {board.description && (
            <p className="text-xs text-muted-foreground truncate">
              {board.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Layout toggle */}
          <LayoutToggle columns={columnLayout} onChange={setColumnLayout} />

          {/* Edit toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-medium transition-all',
              isEditMode
                ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                : 'bg-secondary text-secondary-foreground border border-border/50 hover:bg-muted shadow-win',
            )}
          >
            <Pencil className="h-3 w-3" />
            {isEditMode ? 'Editing' : 'Edit'}
          </button>

          {/* Add Widget (relative anchor for dropdown) */}
          {isEditMode && (
            <div className="relative">
              <button
                onClick={() => setShowAddWidget(!showAddWidget)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-2xl text-xs font-medium hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-win"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Widget
              </button>
              {showAddWidget && (
                <AddWidgetDropdown
                  onAdd={addWidget}
                  onClose={() => setShowAddWidget(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Page Selectors */}
      <PageSelectors
        dimensions={dimensions}
        versions={versions}
        workspaceSlug={slug}
        appSlug={app}
        selectedVersionId={selectedVersionId}
        onVersionChange={setSelectedVersionId}
      />

      {/* Widget Grid */}
      <div
        className="flex-1 overflow-auto p-4 bg-muted/10"
        onClick={() => setFocusedWidgetId(null)}
      >
        {widgets.length === 0 ? (
          <EmptyBoardState
            onAddWidget={() => setShowAddWidget(true)}
            isEditMode={isEditMode}
          />
        ) : (
          <div
            className={cn(
              'grid gap-4 auto-rows-auto',
              gridColsClass,
            )}
          >
            {widgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                isEditMode={isEditMode}
                isFocused={focusedWidgetId === widget.id}
                isDragOver={dragOverId === widget.id}
                onFocus={() => setFocusedWidgetId(widget.id)}
                onRemove={() => removeWidget(widget.id)}
                onExpand={() => setExpandedWidgetId(widget.id)}
                onOpenSettings={() => setSettingsWidgetId(widget.id)}
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onDragOver={(e) => handleDragOver(e, widget.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, widget.id)}
              >
                <WidgetBody
                  widget={widget}
                  isEditMode={isEditMode}
                  onUpdateConfig={(updates) =>
                    updateWidgetConfig(widget.id, updates)
                  }
                  navigate={navigate}
                  workspaceSlug={slug}
                  appSlug={app}
                  versionId={selectedVersionId || undefined}
                />
              </WidgetCard>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Widget Modal */}
      {expandedWidget && (
        <ExpandedWidgetModal
          widget={expandedWidget}
          isEditMode={isEditMode}
          onClose={() => setExpandedWidgetId(null)}
          onUpdateConfig={updateWidgetConfig}
          navigate={navigate}
          workspaceSlug={slug}
          appSlug={app}
          versionId={selectedVersionId || undefined}
        />
      )}

      {/* Widget Settings Panel */}
      {settingsWidget && (
        <WidgetSettingsPanel
          widget={settingsWidget}
          onClose={() => setSettingsWidgetId(null)}
          onUpdateConfig={(updates) =>
            updateWidgetConfig(settingsWidget.id, updates)
          }
          onUpdateTitle={(title) =>
            updateWidgetTitle(settingsWidget.id, title)
          }
          blocks={blocks}
          dimensions={dimensions}
        />
      )}

      {/* Floating Comment Button */}
      {!showComments && board && (
        <button
          type="button"
          onClick={() => setShowComments(true)}
          className={cn(
            'fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-win-lg transition-all',
            'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105',
          )}
          aria-label="Open comments"
        >
          <CommentIcon className="h-5 w-5" />
        </button>
      )}

      {/* Comments Slide-out Panel */}
      {showComments && board && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-border/50 bg-card/95 backdrop-blur-xl shadow-win-lg">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Board Comments</h3>
            <button
              type="button"
              onClick={() => setShowComments(false)}
              className="rounded-xl p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CommentThread
              workspaceSlug={slug}
              appSlug={app}
              targetType="board"
              targetId={board.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
