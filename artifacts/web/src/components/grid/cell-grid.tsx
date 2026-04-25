import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FixedSizeGrid, type GridChildComponentProps } from 'react-window';
import { MessageSquare, MessageSquarePlus } from 'lucide-react';
import { AnomalyBadge } from '@/components/ai/anomaly-badge';
import { CommentThread } from '@/components/comments/comment-thread';
import { ContextMenu } from '@/components/ui/context-menu';
import type { AnomalyEntry } from '@/lib/hooks/use-ai';

interface Cell {
  id: string;
  blockId: string;
  coordinates: Record<string, string>;
  numericValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  isInput: boolean;
}

interface DimensionMember {
  id: string;
  name: string;
  code?: string | null | undefined;
}

export interface DimensionWithMembers {
  id: string;
  name: string;
  slug: string;
  members: DimensionMember[];
}

export interface CellGridProps {
  cells: Cell[];
  dimensions: DimensionWithMembers[];
  onCellChange: (
    coordinates: Record<string, string>,
    value: number | string | boolean | null,
  ) => void;
  isInputBlock?: boolean;
  /** Map from cell index (position in `cells` array) to anomaly entry */
  anomalyMap?: Map<number, AnomalyEntry>;
  /** Comment support: map from cell targetId to comment count */
  cellCommentCounts?: Map<string, number>;
  /** Workspace slug for comment queries */
  workspaceSlug?: string;
  /** App slug for comment queries */
  appSlug?: string;
  /** Block ID used as prefix for cell comment targetIds */
  blockId?: string;
}

interface RowCombo {
  labels: string[];
  coords: Record<string, string>;
}

interface FocusedCell {
  row: number;
  col: number;
}

/** Shape of the comment popover anchor position */
interface CommentPopoverState {
  /** The cell targetId (blockId:coordsKey) used for comment queries */
  cellTargetId: string;
  /** Pixel position (fixed viewport coords) for the popover anchor */
  anchorX: number;
  anchorY: number;
}

interface CellData {
  rowCombos: RowCombo[];
  colMembers: DimensionMember[];
  colDimSlug: string;
  rowDimCount: number;
  rowDimNames: string[];
  cellMap: Map<string, Cell>;
  onCellChange: CellGridProps['onCellChange'];
  editingKey: string | null;
  setEditingKey: (key: string | null) => void;
  editValue: string;
  setEditValue: (val: string) => void;
  numberFmt: Intl.NumberFormat;
  focusedCell: FocusedCell | null;
  anomalyCoordsMap: Map<string, AnomalyEntry>;
  /** Map from cell targetId to comment count */
  cellCommentCounts: Map<string, number>;
  /** Block ID for building cell targetIds */
  blockId: string;
  /** Open the comment popover for a given cell */
  onOpenCommentPopover: (cellTargetId: string, anchorX: number, anchorY: number) => void;
  /** Open the context menu at a position for a given cell */
  onCellContextMenu: (e: React.MouseEvent, cellTargetId: string) => void;
}

const numberFmt = new Intl.NumberFormat('en-US');

function getCellDisplay(cell: Cell | undefined, fmt: Intl.NumberFormat): string {
  if (!cell) return '';
  if (cell.numericValue !== null) return fmt.format(cell.numericValue);
  if (cell.textValue !== null) return cell.textValue;
  if (cell.booleanValue !== null) return cell.booleanValue ? 'TRUE' : 'FALSE';
  return '';
}

function buildRowCombos(dims: DimensionWithMembers[]): RowCombo[] {
  if (dims.length === 0) return [{ labels: [], coords: {} }];

  let combos: RowCombo[] = [{ labels: [], coords: {} }];

  for (const dim of dims) {
    const next: RowCombo[] = [];
    for (const combo of combos) {
      for (const member of dim.members) {
        next.push({
          labels: [...combo.labels, member.name],
          coords: { ...combo.coords, [dim.slug]: member.id },
        });
      }
    }
    combos = next;
  }

  return combos;
}

function buildCoordsKey(coords: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(coords)
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        acc[k] = coords[k] ?? '';
        return acc;
      }, {}),
  );
}

function CellRenderer({
  columnIndex,
  rowIndex,
  style,
  data,
}: GridChildComponentProps<CellData>) {
  const {
    rowCombos,
    colMembers,
    colDimSlug,
    rowDimCount,
    rowDimNames,
    cellMap,
    onCellChange,
    editingKey,
    setEditingKey,
    editValue,
    setEditValue,
    numberFmt: fmt,
    focusedCell,
    anomalyCoordsMap,
    cellCommentCounts,
    blockId,
    onOpenCommentPopover,
    onCellContextMenu,
  } = data;

  const inputRef = useRef<HTMLInputElement>(null);

  const headerCols = rowDimCount;

  const isFocused =
    focusedCell !== null &&
    focusedCell.row === rowIndex &&
    focusedCell.col === columnIndex;

  if (rowIndex === 0) {
    if (columnIndex < headerCols) {
      return (
        <div
          style={style}
          className="border-b border-r border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground truncate flex items-center"
        >
          {rowDimNames[columnIndex] ?? ''}
        </div>
      );
    }
    const colIdx = columnIndex - headerCols;
    const colMember = colMembers[colIdx];
    return (
      <div
        style={style}
        className="border-b border-r border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground truncate flex items-center"
      >
        {colMember?.name ?? ''}
      </div>
    );
  }

  const rowCombo = rowCombos[rowIndex - 1];

  if (columnIndex < headerCols) {
    const label = rowCombo?.labels[columnIndex] ?? '';

    let showLabel = true;
    if (rowIndex > 1 && rowCombo) {
      const prevCombo = rowCombos[rowIndex - 2];
      if (prevCombo) {
        let sameGroup = true;
        for (let d = 0; d < columnIndex; d++) {
          if (prevCombo.labels[d] !== rowCombo.labels[d]) {
            sameGroup = false;
            break;
          }
        }
        if (sameGroup && prevCombo.labels[columnIndex] === label) {
          showLabel = false;
        }
      }
    }

    return (
      <div
        style={style}
        className={`border-b border-r border-border bg-muted/50 px-3 py-2 text-xs font-medium text-foreground truncate flex items-center ${
          isFocused ? 'ring-2 ring-primary ring-offset-1 z-10 relative' : ''
        }`}
      >
        {showLabel ? label : ''}
      </div>
    );
  }

  if (!rowCombo) {
    return <div style={style} className="border-b border-r border-border" />;
  }

  const colIdx = columnIndex - headerCols;
  const colMember = colMembers[colIdx];
  if (!colMember) {
    return <div style={style} className="border-b border-r border-border" />;
  }

  const coords: Record<string, string> = {
    ...rowCombo.coords,
    [colDimSlug]: colMember.id,
  };
  const coordsKey = buildCoordsKey(coords);

  const cell = cellMap.get(coordsKey);
  const isEditing = editingKey === coordsKey;
  const anomaly = anomalyCoordsMap.get(coordsKey);
  const cellTargetId = blockId ? `${blockId}:${coordsKey}` : '';
  const commentCount = cellCommentCounts.get(cellTargetId) ?? 0;

  const handleDoubleClick = () => {
    if (cell && !cell.isInput) return;
    setEditingKey(coordsKey);
    setEditValue(cell ? getCellDisplay(cell, fmt) : '');
  };

  const handleBlur = () => {
    if (editingKey !== coordsKey) return;
    setEditingKey(null);
    const numVal = Number(editValue);
    const newValue =
      editValue === '' ? null : !isNaN(numVal) ? numVal : editValue;
    onCellChange(coords, newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setEditingKey(null);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const anomalyBorderColor = anomaly
    ? anomaly.severity === 'high'
      ? 'ring-2 ring-inset ring-red-400/60'
      : anomaly.severity === 'medium'
        ? 'ring-2 ring-inset ring-orange-400/60'
        : 'ring-2 ring-inset ring-yellow-400/60'
    : '';

  const anomalyBgTint = anomaly
    ? anomaly.severity === 'high'
      ? 'bg-red-50/40 dark:bg-red-950/20'
      : anomaly.severity === 'medium'
        ? 'bg-orange-50/40 dark:bg-orange-950/20'
        : 'bg-yellow-50/40 dark:bg-yellow-950/20'
    : '';

  const handleIndicatorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onOpenCommentPopover(cellTargetId, rect.right, rect.top);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (blockId) {
      onCellContextMenu(e, cellTargetId);
    }
  };

  return (
    <div
      style={style}
      className={`border-b border-r border-border px-2 py-1 text-sm flex items-center relative group ${
        anomaly
          ? `${anomalyBgTint} ${anomalyBorderColor}`
          : cell?.isInput
            ? 'bg-background'
            : 'bg-muted/20 text-muted-foreground'
      } ${
        isEditing
          ? 'ring-2 ring-inset ring-primary'
          : isFocused
            ? 'ring-2 ring-primary ring-offset-1 z-10 relative'
            : anomaly
              ? ''
              : 'hover:bg-accent/50 cursor-cell'
      }`}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Comment indicator triangle in top-right corner */}
      {commentCount > 0 && !isEditing && (
        <div
          className="absolute top-0 right-0 cursor-pointer z-[2]"
          onClick={handleIndicatorClick}
          title={`${commentCount} comment${commentCount > 1 ? 's' : ''}`}
        >
          {/* CSS triangle */}
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderTop: '6px solid #f97316',
            }}
          />
          {commentCount > 1 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[12px] h-[12px] flex items-center justify-center rounded-full bg-orange-500 text-white text-[7px] font-bold leading-none"
            >
              {commentCount > 9 ? '9+' : commentCount}
            </span>
          )}
        </div>
      )}
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-transparent outline-none text-sm font-mono"
        />
      ) : (
        <>
          <span className="truncate font-mono text-xs">
            {getCellDisplay(cell, fmt)}
          </span>
          {anomaly && (
            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0">
              <AnomalyBadge severity={anomaly.severity} explanation={anomaly.explanation} />
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function CellGrid({
  cells,
  dimensions,
  onCellChange,
  anomalyMap,
  cellCommentCounts,
  workspaceSlug,
  appSlug,
  blockId,
}: CellGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<FixedSizeGrid>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);

  // Comment popover state
  const [commentPopover, setCommentPopover] = useState<CommentPopoverState | null>(null);
  const commentPopoverRef = useRef<HTMLDivElement>(null);

  // Context menu state for cell right-click
  const [ctxMenuPos, setCtxMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [ctxMenuCellTargetId, setCtxMenuCellTargetId] = useState<string>('');

  const commentCountsMap = useMemo(
    () => cellCommentCounts ?? new Map<string, number>(),
    [cellCommentCounts],
  );

  // Close comment popover on outside click
  useEffect(() => {
    if (!commentPopover) return;
    const handle = (e: MouseEvent) => {
      if (
        commentPopoverRef.current &&
        !commentPopoverRef.current.contains(e.target as Node)
      ) {
        setCommentPopover(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCommentPopover(null);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [commentPopover]);

  const onOpenCommentPopover = useCallback(
    (cellTargetId: string, anchorX: number, anchorY: number) => {
      setCommentPopover({ cellTargetId, anchorX, anchorY });
      setCtxMenuPos(null);
    },
    [],
  );

  const onCellContextMenu = useCallback(
    (e: React.MouseEvent, cellTargetId: string) => {
      e.preventDefault();
      const x = Math.min(e.clientX, window.innerWidth - 200);
      const y = Math.min(e.clientY, window.innerHeight - 300);
      setCtxMenuPos({ x, y });
      setCtxMenuCellTargetId(cellTargetId);
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setCtxMenuPos(null);
    setCtxMenuCellTargetId('');
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { rowDims, colDim } = useMemo(() => {
    if (dimensions.length === 0) {
      return { rowDims: [] as DimensionWithMembers[], colDim: null };
    }
    if (dimensions.length === 1) {
      return { rowDims: [] as DimensionWithMembers[], colDim: dimensions[0] };
    }
    return {
      rowDims: dimensions.slice(0, -1),
      colDim: dimensions[dimensions.length - 1],
    };
  }, [dimensions]);

  const rowCombos = useMemo(() => buildRowCombos(rowDims), [rowDims]);

  const colMembers = useMemo(
    () => colDim?.members ?? [],
    [colDim],
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const cell of cells) {
      map.set(buildCoordsKey(cell.coordinates), cell);
    }
    return map;
  }, [cells]);

  // Build a coordsKey-based anomaly lookup from the index-based anomalyMap
  const anomalyCoordsMap = useMemo(() => {
    const map = new Map<string, AnomalyEntry>();
    if (!anomalyMap || anomalyMap.size === 0) return map;
    for (const [index, entry] of anomalyMap) {
      const cell = cells[index];
      if (cell) {
        map.set(buildCoordsKey(cell.coordinates), entry);
      }
    }
    return map;
  }, [anomalyMap, cells]);

  const rowDimCount = rowDims.length;
  const rowDimNames = rowDims.map((d) => d.name);
  const colDimSlug = colDim?.slug ?? '';

  const totalCols = (rowDimCount > 0 ? rowDimCount : 0) + colMembers.length;
  const totalRows = 1 + rowCombos.length;

  const ROW_HEADER_WIDTH = 160;
  const DATA_COL_WIDTH = 140;
  const ROW_HEIGHT = 32;

  const uniformColWidth = totalCols > 0
    ? Math.round(
        ((rowDimCount > 0 ? rowDimCount : 0) * ROW_HEADER_WIDTH +
          colMembers.length * DATA_COL_WIDTH) /
          totalCols,
      )
    : DATA_COL_WIDTH;

  const scrollToCell = useCallback(
    (row: number, col: number) => {
      gridRef.current?.scrollToItem({ rowIndex: row, columnIndex: col, align: 'smart' });
    },
    [],
  );

  const getCoordsForCell = useCallback(
    (row: number, col: number): { coords: Record<string, string>; key: string } | null => {
      if (row < 1 || col < rowDimCount) return null;
      const rowCombo = rowCombos[row - 1];
      const colMember = colMembers[col - rowDimCount];
      if (!rowCombo || !colMember) return null;
      const coords: Record<string, string> = {
        ...rowCombo.coords,
        [colDimSlug]: colMember.id,
      };
      return { coords, key: buildCoordsKey(coords) };
    },
    [rowCombos, colMembers, colDimSlug, rowDimCount],
  );

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedCell) return;

      const { row, col } = focusedCell;
      const isEditing = editingKey !== null;

      if (isEditing) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setEditingKey(null);
        }
        return;
      }

      let nextRow = row;
      let nextCol = col;
      let handled = true;

      switch (e.key) {
        case 'ArrowUp':
          nextRow = Math.max(1, row - 1);
          break;
        case 'ArrowDown':
          nextRow = Math.min(totalRows - 1, row + 1);
          break;
        case 'ArrowLeft':
          nextCol = Math.max(rowDimCount, col - 1);
          break;
        case 'ArrowRight':
          nextCol = Math.min(totalCols - 1, col + 1);
          break;
        case 'Tab':
          if (e.shiftKey) {
            nextCol = col - 1;
            if (nextCol < rowDimCount) {
              nextCol = totalCols - 1;
              nextRow = row - 1;
              if (nextRow < 1) {
                nextRow = 1;
                nextCol = rowDimCount;
              }
            }
          } else {
            nextCol = col + 1;
            if (nextCol >= totalCols) {
              nextCol = rowDimCount;
              nextRow = row + 1;
              if (nextRow >= totalRows) {
                nextRow = totalRows - 1;
                nextCol = totalCols - 1;
              }
            }
          }
          break;
        case 'Enter': {
          const cellInfo = getCoordsForCell(row, col);
          if (cellInfo) {
            const cell = cellMap.get(cellInfo.key);
            if (!cell || cell.isInput) {
              setEditingKey(cellInfo.key);
              setEditValue(cell ? getCellDisplay(cell, numberFmt) : '');
            }
          }
          break;
        }
        case 'Delete':
        case 'Backspace': {
          const cellInfo = getCoordsForCell(row, col);
          if (cellInfo) {
            const cell = cellMap.get(cellInfo.key);
            if (!cell || cell.isInput) {
              onCellChange(cellInfo.coords, null);
            }
          }
          break;
        }
        default:
          handled = false;
      }

      if (handled) {
        e.preventDefault();
        if (nextRow !== row || nextCol !== col) {
          setFocusedCell({ row: nextRow, col: nextCol });
          scrollToCell(nextRow, nextCol);
        }
      }
    },
    [
      focusedCell,
      editingKey,
      totalRows,
      totalCols,
      rowDimCount,
      getCoordsForCell,
      cellMap,
      onCellChange,
      scrollToCell,
    ],
  );

  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const gridInner = containerRef.current?.querySelector('[role="grid"]')?.parentElement;
      if (!gridInner) return;

      const rect = gridInner.getBoundingClientRect();
      const scrollLeft = gridInner.scrollLeft;
      const scrollTop = gridInner.scrollTop;
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top + scrollTop;

      const col = Math.floor(x / uniformColWidth);
      const row = Math.floor(y / ROW_HEIGHT);

      if (row >= 1 && row < totalRows && col >= rowDimCount && col < totalCols) {
        setFocusedCell({ row, col });
      }
    },
    [uniformColWidth, totalRows, totalCols, rowDimCount],
  );

  if (dimensions.length === 0) {
    const cell = cells[0];
    return (
      <div ref={containerRef} className="h-full w-full p-4">
        <div className="inline-block border border-border rounded">
          <div className="px-4 py-2 bg-muted text-xs font-semibold border-b border-border">
            Value
          </div>
          <div
            className={`px-4 py-2 text-sm font-mono cursor-cell ${
              cell?.isInput ? 'bg-background' : 'bg-muted/20 text-muted-foreground'
            }`}
            onDoubleClick={() => {
              setEditingKey('single');
              setEditValue(cell ? getCellDisplay(cell, numberFmt) : '');
            }}
          >
            {editingKey === 'single' ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => {
                  setEditingKey(null);
                  const numVal = Number(editValue);
                  const newValue =
                    editValue === '' ? null : !isNaN(numVal) ? numVal : editValue;
                  onCellChange({}, newValue);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingKey(null);
                }}
                className="w-full bg-transparent outline-none text-sm font-mono"
              />
            ) : (
              getCellDisplay(cell, numberFmt) || '\u00A0'
            )}
          </div>
        </div>
      </div>
    );
  }

  const itemData: CellData = {
    rowCombos,
    colMembers,
    colDimSlug,
    rowDimCount: rowDimCount > 0 ? rowDimCount : 0,
    rowDimNames,
    cellMap,
    onCellChange,
    editingKey,
    setEditingKey,
    editValue,
    setEditValue,
    numberFmt,
    focusedCell,
    anomalyCoordsMap,
    cellCommentCounts: commentCountsMap,
    blockId: blockId ?? '',
    onOpenCommentPopover,
    onCellContextMenu,
  };

  // Context menu sections for cell right-click
  const ctxMenuSections = useMemo(
    () => [
      {
        items: [
          {
            label: commentCountsMap.get(ctxMenuCellTargetId)
              ? 'View Comments'
              : 'Add Comment',
            icon: commentCountsMap.get(ctxMenuCellTargetId)
              ? MessageSquare
              : MessageSquarePlus,
            onClick: () => {
              if (ctxMenuPos) {
                onOpenCommentPopover(
                  ctxMenuCellTargetId,
                  ctxMenuPos.x,
                  ctxMenuPos.y,
                );
              }
            },
          },
        ],
      },
    ],
    [ctxMenuCellTargetId, ctxMenuPos, commentCountsMap, onOpenCommentPopover],
  );

  // Compute popover position clamped within viewport
  const popoverStyle = useMemo((): React.CSSProperties | null => {
    if (!commentPopover) return null;
    const popoverW = 360;
    const popoverH = 400;
    let left = commentPopover.anchorX + 8;
    let top = commentPopover.anchorY;
    if (left + popoverW > window.innerWidth - 16) {
      left = commentPopover.anchorX - popoverW - 8;
    }
    if (top + popoverH > window.innerHeight - 16) {
      top = window.innerHeight - popoverH - 16;
    }
    if (top < 16) top = 16;
    if (left < 16) left = 16;
    return {
      position: 'fixed',
      left,
      top,
      width: popoverW,
      maxHeight: popoverH,
      zIndex: 60,
    };
  }, [commentPopover]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full outline-none"
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
      onClick={handleGridClick}
    >
      <FixedSizeGrid
        ref={gridRef}
        columnCount={totalCols}
        columnWidth={uniformColWidth}
        height={size.height}
        rowCount={totalRows}
        rowHeight={ROW_HEIGHT}
        width={size.width}
        itemData={itemData}
      >
        {CellRenderer}
      </FixedSizeGrid>

      {/* Cell context menu (right-click) */}
      {blockId && ctxMenuPos && createPortal(
        <ContextMenu
          sections={ctxMenuSections}
          position={ctxMenuPos}
          onClose={closeContextMenu}
        />,
        document.body,
      )}

      {/* Comment popover */}
      {commentPopover && workspaceSlug && appSlug && popoverStyle && createPortal(
        <div
          ref={commentPopoverRef}
          style={popoverStyle}
          className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.16)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              Cell Comments
            </div>
            <button
              type="button"
              onClick={() => setCommentPopover(null)}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-accent"
            >
              Esc
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 41px)' }}>
            <CommentThread
              workspaceSlug={workspaceSlug}
              appSlug={appSlug}
              targetType="cell"
              targetId={commentPopover.cellTargetId}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
