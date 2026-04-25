import { useState, useCallback, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { ChevronDown, Check, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DimensionInfo } from './pivot-panel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { DimensionInfo };

export interface MemberItem {
  id: string;
  name: string;
}

export interface PageSelectorProps {
  dimensions: DimensionInfo[];
  members: Record<string, MemberItem[]>;
  selections: Record<string, string[]>;
  onSelectionChange: (dimensionId: string, memberIds: string[]) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDisplayLabel(
  dimension: DimensionInfo,
  memberList: MemberItem[],
  selected: string[],
): string {
  if (selected.length === 0 || selected.length === memberList.length) {
    return 'All';
  }
  if (selected.length === 1) {
    const member = memberList.find((m) => m.id === selected[0]);
    return member?.name ?? '1 selected';
  }
  return `${selected.length} selected`;
}

// ---------------------------------------------------------------------------
// DimensionDropdown
// ---------------------------------------------------------------------------

interface DimensionDropdownProps {
  dimension: DimensionInfo;
  memberList: MemberItem[];
  selected: string[];
  onSelectionChange: (memberIds: string[]) => void;
}

function DimensionDropdown({
  dimension,
  memberList,
  selected,
  onSelectionChange,
}: DimensionDropdownProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSet = new Set(selected);
  const allSelected = selected.length === memberList.length && memberList.length > 0;
  const noneSelected = selected.length === 0;

  const filtered = search
    ? memberList.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()),
      )
    : memberList;

  const handleToggleMember = useCallback(
    (memberId: string) => {
      if (selectedSet.has(memberId)) {
        onSelectionChange(selected.filter((id) => id !== memberId));
      } else {
        onSelectionChange([...selected, memberId]);
      }
    },
    [selected, selectedSet, onSelectionChange],
  );

  const handleToggleAll = useCallback(() => {
    if (allSelected || noneSelected) {
      // If all selected, deselect all. If none selected, select all.
      onSelectionChange(
        allSelected ? [] : memberList.map((m) => m.id),
      );
    } else {
      // Partial -> select all
      onSelectionChange(memberList.map((m) => m.id));
    }
  }, [allSelected, noneSelected, memberList, onSelectionChange]);

  const displayLabel = getDisplayLabel(dimension, memberList, selected);

  return (
    <Popover.Root>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">
          {dimension.name}
        </span>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-8 items-center justify-between gap-1 rounded-md border border-input',
              'bg-background px-2.5 text-xs font-medium text-foreground',
              'hover:bg-accent/50 hover:border-primary/30 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'min-w-[100px] max-w-[180px]',
            )}
            aria-label={`Filter by ${dimension.name}`}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </Popover.Trigger>
      </div>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchRef.current?.focus();
          }}
        >
          {/* Search */}
          {memberList.length > 6 && (
            <div className="border-b border-border px-2 py-1.5">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1">
            {/* All option */}
            <label
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
              )}
            >
              <Checkbox.Root
                checked={allSelected ? true : noneSelected ? false : 'indeterminate'}
                onCheckedChange={handleToggleAll}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                  'data-[state=indeterminate]:bg-primary/60 data-[state=indeterminate]:text-primary-foreground',
                )}
              >
                <Checkbox.Indicator className="flex items-center justify-center">
                  {allSelected ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="block h-0.5 w-2 bg-current rounded" />
                  )}
                </Checkbox.Indicator>
              </Checkbox.Root>
              <span className="text-xs font-semibold">All</span>
            </label>

            {/* Members */}
            {filtered.map((member) => {
              const isChecked = selectedSet.has(member.id);
              return (
                <label
                  key={member.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5',
                    'hover:bg-accent hover:text-accent-foreground transition-colors',
                  )}
                >
                  <Checkbox.Root
                    checked={isChecked}
                    onCheckedChange={() => handleToggleMember(member.id)}
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                    )}
                  >
                    <Checkbox.Indicator className="flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className="truncate text-xs">{member.name}</span>
                </label>
              );
            })}

            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No results found
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// PageSelector
// ---------------------------------------------------------------------------

export function PageSelector({
  dimensions,
  members,
  selections,
  onSelectionChange,
  className,
}: PageSelectorProps) {
  if (dimensions.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-end gap-3 overflow-x-auto px-1 py-1',
        className,
      )}
      role="toolbar"
      aria-label="Page dimension filters"
    >
      <div className="flex shrink-0 items-center gap-1.5 pb-1 text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          Filters
        </span>
      </div>

      {dimensions.map((dim) => {
        const memberList = members[dim.id] ?? [];
        const selected = selections[dim.id] ?? [];
        return (
          <DimensionDropdown
            key={dim.id}
            dimension={dim}
            memberList={memberList}
            selected={selected}
            onSelectionChange={(memberIds) =>
              onSelectionChange(dim.id, memberIds)
            }
          />
        );
      })}
    </div>
  );
}
