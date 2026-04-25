// Block type definitions matching Pigment's color-coded system
import {
  Calculator,
  Layers,
  FileSpreadsheet,
  Table2,
  type LucideIcon,
} from 'lucide-react';

export type BlockType =
  | 'metric'
  | 'dimension_list'
  | 'transaction_list'
  | 'table';

export interface BlockTypeConfig {
  label: string;
  pluralLabel: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  bgLight: string;
  borderColor: string;
  hex: string;
  description: string;
}

export const BLOCK_TYPES: Record<BlockType, BlockTypeConfig> = {
  metric: {
    label: 'Metric',
    pluralLabel: 'Metrics',
    icon: Calculator,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-600',
    bgLight: 'bg-violet-50 dark:bg-violet-950',
    borderColor: 'border-violet-600',
    hex: '#7c3aed',
    description: 'Numeric indicators with formulas and dimensions',
  },
  dimension_list: {
    label: 'Dimension List',
    pluralLabel: 'Dimension Lists',
    icon: Layers,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-600',
    bgLight: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-600',
    hex: '#2563eb',
    description: 'Categorical axes like countries, products, departments',
  },
  transaction_list: {
    label: 'Transaction List',
    pluralLabel: 'Transaction Lists',
    icon: FileSpreadsheet,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-600',
    bgLight: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-600',
    hex: '#16a34a',
    description: 'Event-level data like orders and journal entries',
  },
  table: {
    label: 'Table',
    pluralLabel: 'Tables',
    icon: Table2,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-600',
    bgLight: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-600',
    hex: '#dc2626',
    description: 'Grouped metrics sharing dimensions',
  },
};

export const BLOCK_TYPE_KEYS = Object.keys(BLOCK_TYPES) as BlockType[];

/** Returns the config for a block type string, falling back to metric. */
export function getBlockType(type: string): BlockTypeConfig {
  return BLOCK_TYPES[type as BlockType] ?? BLOCK_TYPES.metric;
}

/** Whether a block type supports formula editing. */
export function supportsFormula(type: string): boolean {
  return type === 'metric' || type === 'table';
}
