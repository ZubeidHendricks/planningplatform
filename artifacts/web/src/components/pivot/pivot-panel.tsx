import { useState, useCallback, useRef, type DragEvent } from 'react';
import { GripVertical, Plus, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PivotConfig {
  rows: string[];
  columns: string[];
  pages: string[];
  filters: Record<string, string[]>;
}

export interface DimensionInfo {
  id: string;
  name: string;
  slug: string;
}

export interface PivotPanelProps {
  config: PivotConfig;
  dimensions: DimensionInfo[];
  onChange: (config: PivotConfig) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ZoneKey = 'pages' | 'columns' | 'rows';

const ZONE_META: { key: ZoneKey; label: string }[] = [
  { key: 'pages', label: 'Pages' },
  { key: 'columns', label: 'Columns' },
  { key: 'rows', label: 'Rows' },
];

const MIME = 'text/x-pivot-dimension';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAssigned(config: PivotConfig): Set<string> {
  return new Set([...config.pages, ...config.columns, ...config.rows]);
}

function removeDimensionFromConfig(
  config: PivotConfig,
  dimensionId: string,
): PivotConfig {
  return {
    ...config,
    pages: config.pages.filter((d) => d !== dimensionId),
    columns: config.columns.filter((d) => d !== dimensionId),
    rows: config.rows.filter((d) => d !== dimensionId),
  };
}

// ---------------------------------------------------------------------------
// DimensionPill
// ---------------------------------------------------------------------------

interface DimensionPillProps {
  dimension: DimensionInfo;
  zone: ZoneKey | 'available';
  onRemove?: () => void;
}

function DimensionPill({ dimension, zone, onRemove }: DimensionPillProps) {
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(MIME, JSON.stringify({ id: dimension.id, from: zone }));
      e.dataTransfer.effectAllowed = 'move';
    },
    [dimension.id, zone],
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'group inline-flex items-center gap-1 rounded-md border border-border bg-background',
        'px-2 py-1 text-xs font-medium text-foreground select-none',
        'cursor-grab active:cursor-grabbing',
        'hover:border-primary/40 hover:bg-primary/5 transition-colors',
      )}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60" />
      <span className="truncate max-w-[120px]">{dimension.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
          aria-label={`Remove ${dimension.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DropZone
// ---------------------------------------------------------------------------

interface DropZoneProps {
  zone: ZoneKey;
  label: string;
  dimensionIds: string[];
  dimensions: DimensionInfo[];
  onDrop: (dimensionId: string, targetZone: ZoneKey) => void;
  onRemove: (dimensionId: string) => void;
  onAddClick: () => void;
}

function DropZone({
  zone,
  label,
  dimensionIds,
  dimensions,
  onDrop,
  onRemove,
  onAddClick,
}: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);
      const raw = e.dataTransfer.getData(MIME);
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as { id: string; from: string };
        if (payload.from !== zone) {
          onDrop(payload.id, zone);
        }
      } catch {
        // ignore malformed data
      }
    },
    [zone, onDrop],
  );

  const dimLookup = new Map(dimensions.map((d) => [d.id, d]));

  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-[34px] flex-1 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 transition-colors',
          isOver
            ? 'border-dashed border-primary bg-primary/5'
            : 'border-dashed border-border/60 bg-muted/30',
        )}
        role="listbox"
        aria-label={`${label} dimensions`}
      >
        {dimensionIds.length === 0 && !isOver && (
          <span className="text-[11px] text-muted-foreground/50 italic">
            Drop dimensions here
          </span>
        )}
        {dimensionIds.map((id) => {
          const dim = dimLookup.get(id);
          if (!dim) return null;
          return (
            <DimensionPill
              key={id}
              dimension={dim}
              zone={zone}
              onRemove={() => onRemove(id)}
            />
          );
        })}
        <button
          type="button"
          onClick={onAddClick}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
          )}
          aria-label={`Add dimension to ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddDimensionMenu
// ---------------------------------------------------------------------------

interface AddDimensionMenuProps {
  available: DimensionInfo[];
  targetZone: ZoneKey;
  onSelect: (dimensionId: string, zone: ZoneKey) => void;
  onClose: () => void;
}

function AddDimensionMenu({ available, targetZone, onSelect, onClose }: AddDimensionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  if (available.length === 0) {
    return (
      <div
        ref={menuRef}
        className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-popover p-2 shadow-md"
      >
        <p className="text-xs text-muted-foreground">No available dimensions</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 text-xs text-primary hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-popover shadow-md"
    >
      <div className="p-1">
        {available.map((dim) => (
          <button
            key={dim.id}
            type="button"
            onClick={() => {
              onSelect(dim.id, targetZone);
              onClose();
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs',
              'hover:bg-accent hover:text-accent-foreground transition-colors',
            )}
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
            {dim.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PivotPanel
// ---------------------------------------------------------------------------

export function PivotPanel({
  config,
  dimensions,
  onChange,
  className,
}: PivotPanelProps) {
  const [addMenuZone, setAddMenuZone] = useState<ZoneKey | null>(null);

  const assigned = getAssigned(config);
  const available = dimensions.filter((d) => !assigned.has(d.id));

  // ---- Handlers ----

  const handleDrop = useCallback(
    (dimensionId: string, targetZone: ZoneKey) => {
      const cleaned = removeDimensionFromConfig(config, dimensionId);
      const updated = {
        ...cleaned,
        [targetZone]: [...cleaned[targetZone], dimensionId],
      };
      onChange(updated);
    },
    [config, onChange],
  );

  const handleRemove = useCallback(
    (dimensionId: string) => {
      onChange(removeDimensionFromConfig(config, dimensionId));
    },
    [config, onChange],
  );

  const handleAddFromMenu = useCallback(
    (dimensionId: string, zone: ZoneKey) => {
      const cleaned = removeDimensionFromConfig(config, dimensionId);
      onChange({
        ...cleaned,
        [zone]: [...cleaned[zone], dimensionId],
      });
    },
    [config, onChange],
  );

  const handleReset = useCallback(() => {
    onChange({ pages: [], columns: [], rows: [], filters: {} });
  }, [onChange]);

  const handleAvailableDrop = useCallback(
    (dimensionId: string, _zone: ZoneKey) => {
      handleDrop(dimensionId, _zone);
    },
    [handleDrop],
  );

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-card p-4',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Pivot Configuration</h3>
        <button
          type="button"
          onClick={handleReset}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
          )}
          aria-label="Reset pivot configuration"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* Zones */}
      <div className="flex flex-col gap-3">
        {ZONE_META.map(({ key, label }) => (
          <div key={key} className="relative">
            <DropZone
              zone={key}
              label={label}
              dimensionIds={config[key]}
              dimensions={dimensions}
              onDrop={handleDrop}
              onRemove={handleRemove}
              onAddClick={() =>
                setAddMenuZone((prev) => (prev === key ? null : key))
              }
            />
            {addMenuZone === key && (
              <AddDimensionMenu
                available={available}
                targetZone={key}
                onSelect={handleAddFromMenu}
                onClose={() => setAddMenuZone(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Available dimensions */}
      {available.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Available
          </span>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="list"
            aria-label="Available dimensions"
          >
            {available.map((dim) => (
              <DimensionPill
                key={dim.id}
                dimension={dim}
                zone="available"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
