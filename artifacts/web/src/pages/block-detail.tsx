import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, X, ChevronDown, ChevronRight, Upload, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useBlocks, useUpdateBlockFormula } from '@/lib/hooks/use-blocks';
import { useCells, useSetCellValue, cellKeys } from '@/lib/hooks/use-cells';
import { useToastStore } from '@/stores/toast';
import { useUndoStore } from '@/stores/undo';
import { useShortcut } from '@/hooks/use-shortcut';
import { api } from '@/lib/api';
import {
  useBlockDimensions,
  useDimensions,
  useMultipleDimensionMembers,
  useAssignBlockDimension,
  useRemoveBlockDimension,
  type Dimension,
  type BlockDimension,
} from '@/lib/hooks/use-dimensions';
import type { DimensionWithMembers } from '@/components/grid/cell-grid';
import { useViews, useCreateView } from '@/lib/hooks/use-views';
import { CellGrid } from '@/components/grid/cell-grid';
import { FormulaBar } from '@/components/formula/formula-bar';
import { ViewSelector } from '@/components/views/view-selector';
import { getBlockType, supportsFormula } from '@/lib/block-types';
import { cn } from '@/lib/utils';
import { ForecastPanel } from '@/components/ai/forecast-panel';
import { CommentThread } from '@/components/comments/comment-thread';
import { useCellCommentsForBlock } from '@/lib/hooks/use-comments';
import { ExportDropdown } from '@/components/export/export-dropdown';
import { EnvironmentSwitcher } from '@/components/environments/environment-switcher';
import { useDetectAnomalies, type AnomalyEntry } from '@/lib/hooks/use-ai';

export function BlockDetailPage() {
  const { workspaceSlug, appSlug, blockId } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';
  const qc = useQueryClient();

  const { data: blocks } = useBlocks(slug, app);
  const block = blocks?.find((b) => b.id === blockId);
  const { data: cells, isLoading: cellsLoading } = useCells(slug, app, blockId ?? '');
  const { data: blockDimensions } = useBlockDimensions(slug, app, blockId ?? '');
  const { data: allDimensions } = useDimensions(slug, app);
  const { data: views } = useViews(slug, app, blockId ?? '');
  const updateFormula = useUpdateBlockFormula();
  const setCellValue = useSetCellValue();
  const assignDimension = useAssignBlockDimension();
  const removeDimension = useRemoveBlockDimension();
  const { data: cellCommentCounts } = useCellCommentsForBlock(slug, app, blockId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dimension members for all assigned dimensions in parallel
  const assignedDimIds = useMemo(
    () => (blockDimensions ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((bd) => bd.dimensionId),
    [blockDimensions],
  );
  const { membersMap, isLoading: membersLoading } = useMultipleDimensionMembers(
    slug,
    app,
    assignedDimIds,
  );

  // Build ordered DimensionWithMembers array for the CellGrid
  const gridDimensions = useMemo((): DimensionWithMembers[] => {
    const dimMap = new Map((allDimensions ?? []).map((d) => [d.id, d]));
    const sorted = (blockDimensions ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const result: DimensionWithMembers[] = [];
    for (const bd of sorted) {
      const dim = dimMap.get(bd.dimensionId);
      if (!dim) continue;
      const members = (membersMap.get(bd.dimensionId) ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
      }));
      result.push({
        id: dim.id,
        name: dim.name,
        slug: dim.slug,
        members,
      });
    }
    return result;
  }, [blockDimensions, allDimensions, membersMap]);

  const [formula, setFormula] = useState(block?.formula ?? '');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [dimPanelOpen, setDimPanelOpen] = useState(true);
  const [dimDropdownOpen, setDimDropdownOpen] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [anomalyEnabled, setAnomalyEnabled] = useState(false);
  const [anomalyMap, setAnomalyMap] = useState<Map<number, AnomalyEntry>>(new Map());
  const detectAnomalies = useDetectAnomalies();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dimDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDimDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dimDropdownOpen]);

  // Compute unassigned dimensions
  const assignedDimensionIds = useMemo(
    () => new Set((blockDimensions ?? []).map((bd) => bd.dimensionId)),
    [blockDimensions],
  );

  const unassignedDimensions = useMemo(
    () => (allDimensions ?? []).filter((d) => !assignedDimensionIds.has(d.id)),
    [allDimensions, assignedDimensionIds],
  );

  // Resolve assigned BlockDimension entries to full Dimension data
  const assignedWithDetails = useMemo(() => {
    const dimMap = new Map((allDimensions ?? []).map((d) => [d.id, d]));
    return (blockDimensions ?? [])
      .map((bd) => ({ assignment: bd, dimension: dimMap.get(bd.dimensionId) }))
      .filter((item): item is { assignment: BlockDimension; dimension: Dimension } =>
        item.dimension !== undefined,
      );
  }, [blockDimensions, allDimensions]);

  const handleAssignDimension = useCallback(
    (dimensionId: string) => {
      if (!blockId) return;
      assignDimension.mutate({
        workspaceSlug: slug,
        appSlug: app,
        blockId,
        dimensionId,
      });
      setDimDropdownOpen(false);
    },
    [blockId, slug, app, assignDimension],
  );

  const handleRemoveDimension = useCallback(
    (assignmentId: string) => {
      if (!blockId) return;
      removeDimension.mutate({
        workspaceSlug: slug,
        appSlug: app,
        blockId,
        assignmentId,
      });
    },
    [blockId, slug, app, removeDimension],
  );

  const handleFormulaSubmit = useCallback(() => {
    if (!blockId) return;
    updateFormula.mutate({
      workspaceSlug: slug,
      appSlug: app,
      blockId,
      formula,
    });
  }, [blockId, slug, app, formula, updateFormula]);

  const handleCellChange = useCallback(
    (coordinates: Record<string, string>, value: number | string | boolean | null) => {
      if (!blockId) return;

      const coordsKey = JSON.stringify(
        Object.keys(coordinates)
          .sort()
          .reduce<Record<string, string>>((acc, k) => {
            acc[k] = coordinates[k] ?? '';
            return acc;
          }, {}),
      );
      const existing = (cells ?? []).find((c) => {
        const ck = JSON.stringify(
          Object.keys(c.coordinates)
            .sort()
            .reduce<Record<string, string>>((a, k) => {
              a[k] = c.coordinates[k] ?? '';
              return a;
            }, {}),
        );
        return ck === coordsKey;
      });
      const oldValue = existing
        ? (existing.numericValue ?? existing.textValue ?? existing.booleanValue ?? null)
        : null;

      useUndoStore.getState().pushEdit({
        blockId,
        coordinates,
        oldValue,
        newValue: value,
        timestamp: Date.now(),
      });

      setCellValue.mutate({
        workspaceSlug: slug,
        appSlug: app,
        blockId,
        coordinates,
        value,
      });
    },
    [blockId, slug, app, setCellValue, cells],
  );

  useShortcut(
    'undo',
    'mod+z',
    'Undo',
    'Editing',
    () => {
      const entry = useUndoStore.getState().undo();
      if (!entry) return;
      setCellValue.mutate({
        workspaceSlug: slug,
        appSlug: app,
        blockId: entry.blockId,
        coordinates: entry.coordinates,
        value: entry.oldValue,
      });
    },
    [slug, app, setCellValue],
  );

  useShortcut(
    'redo',
    'mod+shift+z',
    'Redo',
    'Editing',
    () => {
      const entry = useUndoStore.getState().redo();
      if (!entry) return;
      setCellValue.mutate({
        workspaceSlug: slug,
        appSlug: app,
        blockId: entry.blockId,
        coordinates: entry.coordinates,
        value: entry.newValue,
      });
    },
    [slug, app, setCellValue],
  );

  const handleToggleAnomalies = useCallback(() => {
    if (anomalyEnabled) {
      // Turn off: clear results
      setAnomalyEnabled(false);
      setAnomalyMap(new Map());
      return;
    }
    if (!blockId) return;
    setAnomalyEnabled(true);
    detectAnomalies.mutate(
      { workspaceSlug: slug, appSlug: app, blockId },
      {
        onSuccess: (res) => {
          const anomalies = res.data?.anomalies ?? [];
          const map = new Map<number, AnomalyEntry>();
          for (const a of anomalies) {
            map.set(a.index, a);
          }
          setAnomalyMap(map);
        },
        onError: () => {
          setAnomalyEnabled(false);
        },
      },
    );
  }, [anomalyEnabled, blockId, slug, app, detectAnomalies]);

  const handleCsvImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !blockId) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const text = evt.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) return;

        const headers = lines[0]!.split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const vals = line.split(',').map((v) => v.trim());
          const row: Record<string, string | number> = {};
          headers.forEach((h, i) => {
            const v = vals[i] ?? '';
            const n = Number(v);
            row[h] = v !== '' && !isNaN(n) ? n : v;
          });
          return row;
        });

        try {
          await api.post(`/${slug}/apps/${app}/blocks/${blockId}/import`, { rows });
          void qc.invalidateQueries({ queryKey: cellKeys.all(slug, app, blockId) });
          useToastStore.getState().addToast('CSV imported successfully', 'success');
        } catch (err) {
          useToastStore.getState().addToast((err as Error).message, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [blockId, slug, app, qc],
  );

  if (!block) {
    return <div className="p-6 text-center text-muted-foreground">Block not found</div>;
  }

  const typeConfig = getBlockType(block.blockType);
  const TypeIcon = typeConfig.icon;
  const showFormula = supportsFormula(block.blockType);

  return (
    <div className="h-full flex flex-col">
      {/* Header with type-tinted formula bar area */}
      <div className={cn('border-b border-border px-4 py-3', typeConfig.bgLight)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md',
                typeConfig.bgLight,
                'border',
                typeConfig.borderColor,
              )}
            >
              <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{block.name}</h1>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                    typeConfig.bgLight,
                    typeConfig.color,
                  )}
                >
                  {typeConfig.label}
                </span>
                <span className="text-xs text-muted-foreground">{block.slug}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForecastOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-2xl border border-border/50 px-3 py-1.5 text-xs font-medium transition-all duration-200',
                forecastOpen
                  ? 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
              aria-pressed={forecastOpen}
              title="Toggle forecast panel"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Forecast
            </button>
            <button
              type="button"
              onClick={handleToggleAnomalies}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-2xl border border-border/50 px-3 py-1.5 text-xs font-medium transition-all duration-200 backdrop-blur-sm shadow-win',
                anomalyEnabled
                  ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
              aria-pressed={anomalyEnabled}
              title="Detect anomalies in cell data"
              disabled={detectAnomalies.isPending}
            >
              <AlertTriangle className={cn('h-3.5 w-3.5', detectAnomalies.isPending && 'animate-pulse')} />
              {detectAnomalies.isPending ? 'Scanning...' : anomalyEnabled ? `Anomalies (${anomalyMap.size})` : 'Anomalies'}
            </button>
            <EnvironmentSwitcher
              workspaceSlug={slug}
              appSlug={app}
            />
            <ExportDropdown
              workspaceSlug={slug}
              appSlug={app}
              blockId={blockId ?? ''}
              blockSlug={block.slug}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
              title="Import CSV"
            >
              <Upload className="h-3 w-3" />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />
            <ViewSelector
              views={views ?? []}
              activeViewId={activeViewId}
              onSelectView={setActiveViewId}
              workspaceSlug={slug}
              appSlug={app}
              blockId={blockId ?? ''}
            />
          </div>
        </div>

        {showFormula && (
          <FormulaBar
            value={formula}
            onChange={setFormula}
            onSubmit={handleFormulaSubmit}
            isPending={updateFormula.isPending}
            workspaceSlug={slug}
            appSlug={app}
            blockName={block.name}
          />
        )}
      </div>

      {/* Dimensions assignment panel */}
      <div className="border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDimPanelOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={dimPanelOpen}
            aria-controls="dimension-panel-content"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Dimensions</span>
            {dimPanelOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {!dimPanelOpen && assignedWithDetails.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold px-1">
                {assignedWithDetails.length}
              </span>
            )}
          </button>
        </div>

        {dimPanelOpen && (
          <div
            id="dimension-panel-content"
            className="mt-2 flex flex-wrap items-center gap-1.5"
            role="list"
            aria-label="Assigned dimensions"
          >
            {assignedWithDetails.map(({ assignment, dimension }) => (
              <span
                key={assignment.id}
                role="listitem"
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
              >
                {dimension.name}
                <button
                  type="button"
                  onClick={() => handleRemoveDimension(assignment.id)}
                  className="ml-0.5 rounded hover:bg-blue-100 p-0.5 transition-colors"
                  aria-label={`Remove ${dimension.name} dimension`}
                  disabled={removeDimension.isPending}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Add dimension button + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDimDropdownOpen((v) => !v)}
                className={cn(
                  'inline-flex items-center justify-center rounded-md border border-dashed border-muted-foreground/30',
                  'h-6 w-6 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors',
                )}
                aria-label="Add dimension"
                aria-haspopup="listbox"
                aria-expanded={dimDropdownOpen}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              {dimDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Available dimensions"
                  className={cn(
                    'absolute top-full left-0 mt-1 z-50 min-w-[200px] max-h-48 overflow-auto',
                    'rounded-md border border-border bg-popover shadow-md',
                  )}
                >
                  {(allDimensions ?? []).length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      No dimensions available &mdash; create some in the Dimensions tab
                    </div>
                  ) : unassignedDimensions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      All dimensions are already assigned
                    </div>
                  ) : (
                    <ul className="py-1">
                      {unassignedDimensions.map((dim) => (
                        <li key={dim.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => handleAssignDimension(dim.id)}
                            disabled={assignDimension.isPending}
                            className={cn(
                              'w-full text-left px-3 py-1.5 text-sm',
                              'hover:bg-accent hover:text-accent-foreground transition-colors',
                              'disabled:opacity-50',
                            )}
                          >
                            {dim.name}
                            <span className="ml-2 text-xs text-muted-foreground">{dim.slug}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {assignedWithDetails.length === 0 && (
              <span className="text-xs text-muted-foreground">
                No dimensions assigned
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {cellsLoading || membersLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <CellGrid
            cells={cells ?? []}
            dimensions={gridDimensions}
            onCellChange={handleCellChange}
            anomalyMap={anomalyEnabled ? anomalyMap : undefined}
            cellCommentCounts={cellCommentCounts}
            workspaceSlug={slug}
            appSlug={app}
            blockId={blockId}
          />
        )}
      </div>

      {/* Forecast Panel */}
      {blockId && forecastOpen && (
        <div className="border-t border-border/50 bg-card/70 backdrop-blur-xl">
          <ForecastPanel
            workspaceSlug={slug}
            appSlug={app}
            blockId={blockId}
            historicalValues={
              (cells ?? [])
                .filter((c) => c.numericValue != null)
                .map((c) => c.numericValue as number)
            }
          />
        </div>
      )}

      {/* Comments */}
      {blockId && (
        <CommentThread
          workspaceSlug={slug}
          appSlug={app}
          targetType="block"
          targetId={blockId}
        />
      )}
    </div>
  );
}
