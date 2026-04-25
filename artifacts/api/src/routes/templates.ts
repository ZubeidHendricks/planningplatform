import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  applications,
  blocks,
  dimensions,
  dimensionMembers,
  blockDimensions,
  boards,
  cells,
  versions,
} from '@planning-platform/db';
import type { Database } from '@planning-platform/db';
import type { BoardWidget } from '@planning-platform/db';
import { deployTemplateSchema } from '@planning-platform/shared';
import { authMiddleware } from '../middleware/auth.js';
import { createTenantMiddleware } from '../middleware/tenant.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Short random id suitable for widget ids within a board layout. */
function wid(): string {
  return randomUUID().replace(/-/g, '').slice(0, 25);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function widget(
  type: BoardWidget['type'],
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
  config: Record<string, unknown>,
): BoardWidget {
  return { id: wid(), type, title, x, y, w, h, config };
}

// ---------------------------------------------------------------------------
// Template: Revenue Planning
// ---------------------------------------------------------------------------

async function seedRevenuePlanning(
  db: Database,
  appId: string,
) {
  // ---- Dimensions -----------------------------------------------------------
  const dimDefs = [
    {
      name: 'Region',
      slug: 'region',
      members: ['North America', 'EMEA', 'APAC', 'LATAM'],
    },
    {
      name: 'Product',
      slug: 'product',
      members: ['Enterprise', 'Mid-Market', 'SMB'],
    },
    {
      name: 'Time Period',
      slug: 'time-period',
      members: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ],
    },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};

  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      sortOrder: insertedDims.length,
    }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });

    const memberRows = def.members.map((name, i) => ({
      dimensionId: dim.id,
      name,
      code: name.toLowerCase().replace(/\s+/g, '-'),
      sortOrder: i,
    }));
    const insertedMembers = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = insertedMembers.map((m) => ({ id: m.id, name: m.name }));
  }

  // ---- Blocks ---------------------------------------------------------------
  const blockDefs = [
    { name: 'Revenue', slug: 'revenue', formula: null as string | null, hasDims: true },
    { name: 'COGS', slug: 'cogs', formula: null as string | null, hasDims: true },
    { name: 'Gross Profit', slug: 'gross-profit', formula: 'Revenue - COGS', hasDims: true },
    { name: 'Operating Expenses', slug: 'opex', formula: null as string | null, hasDims: true },
    { name: 'EBITDA', slug: 'ebitda', formula: 'Gross Profit - Operating Expenses', hasDims: true },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];

  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      blockType: 'metric',
      formula: def.formula,
      formatType: 'currency',
      sortOrder: insertedBlocks.length,
    }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });

    // Assign all 3 dimensions to input blocks
    if (def.hasDims) {
      const bdRows = insertedDims.map((dim, i) => ({
        blockId: blk.id,
        dimensionId: dim.id,
        sortOrder: i,
      }));
      await db.insert(blockDimensions).values(bdRows);
    }
  }

  // ---- Versions -------------------------------------------------------------
  const versionDefs = [
    { name: 'Budget 2025', versionType: 'budget' as const },
    { name: 'Forecast 2025', versionType: 'forecast' as const },
    { name: 'Actuals 2025', versionType: 'actuals' as const },
  ];

  const versionRows = versionDefs.map((v) => ({
    applicationId: appId,
    name: v.name,
    versionType: v.versionType,
    isLocked: 0,
  }));
  const insertedVersions = await db.insert(versions).values(versionRows).returning();

  // ---- Board ----------------------------------------------------------------
  const layout: BoardWidget[] = [
    widget('kpi', 'Total Revenue', 0, 0, 3, 2, {
      blockSlug: 'revenue',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Gross Margin', 3, 0, 3, 2, {
      blockSlug: 'gross-profit',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('chart', 'Revenue by Region', 0, 2, 6, 4, {
      blockSlug: 'revenue',
      dimensionSlug: 'region',
      chartType: 'bar',
    }),
    widget('grid', 'P&L Summary', 0, 6, 12, 6, {
      blockSlugs: ['revenue', 'cogs', 'gross-profit', 'opex', 'ebitda'],
    }),
  ];

  await db.insert(boards).values({
    applicationId: appId,
    name: 'Dashboard',
    slug: 'dashboard',
    layout,
    sortOrder: 0,
  });

  // ---- Sample cell data for input blocks ------------------------------------
  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const regionMembers = memberIdsByDimSlug['region'] ?? [];
  const productMembers = memberIdsByDimSlug['product'] ?? [];
  const timeMembers = memberIdsByDimSlug['time-period'] ?? [];

  const inputBlockSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'revenue', min: 50000, max: 200000 },
    { slug: 'cogs', min: 20000, max: 80000 },
    { slug: 'opex', min: 10000, max: 50000 },
  ];

  const cellRows: Array<{
    blockId: string;
    coordinates: Record<string, string>;
    numericValue: number;
    isInput: boolean;
    versionId: string;
  }> = [];

  for (const seed of inputBlockSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const region of regionMembers) {
      for (const product of productMembers) {
        for (const month of timeMembers) {
          cellRows.push({
            blockId: blk.id,
            coordinates: {
              region: region.id,
              product: product.id,
              'time-period': month.id,
            },
            numericValue: randInt(seed.min, seed.max),
            isInput: true,
            versionId: budgetVersion.id,
          });
        }
      }
    }
  }

  // Batch insert cells in chunks of 100 to avoid hitting parameter limits
  const CHUNK_SIZE = 100;
  for (let i = 0; i < cellRows.length; i += CHUNK_SIZE) {
    await db.insert(cells).values(cellRows.slice(i, i + CHUNK_SIZE));
  }

  return {
    blocks: insertedBlocks.length,
    dimensions: insertedDims.length,
    boards: 1,
    versions: insertedVersions.length,
    cells: cellRows.length,
  };
}

// ---------------------------------------------------------------------------
// Template: P&L Statement
// ---------------------------------------------------------------------------

async function seedPLStatement(
  db: Database,
  appId: string,
) {
  // ---- Dimensions -----------------------------------------------------------
  const dimDefs = [
    {
      name: 'Department',
      slug: 'department',
      members: ['Finance', 'Engineering', 'Sales', 'Marketing'],
    },
    {
      name: 'Time Period',
      slug: 'time-period',
      members: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ],
    },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};

  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      sortOrder: insertedDims.length,
    }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });

    const memberRows = def.members.map((name, i) => ({
      dimensionId: dim.id,
      name,
      code: name.toLowerCase().replace(/\s+/g, '-'),
      sortOrder: i,
    }));
    const insertedMembers = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = insertedMembers.map((m) => ({ id: m.id, name: m.name }));
  }

  // ---- Blocks ---------------------------------------------------------------
  const blockDefs = [
    { name: 'Revenue', slug: 'revenue', formula: null as string | null, isInput: true },
    { name: 'COGS', slug: 'cogs', formula: null as string | null, isInput: true },
    { name: 'Gross Profit', slug: 'gross-profit', formula: 'Revenue - COGS', isInput: false },
    { name: 'Operating Expenses', slug: 'opex', formula: null as string | null, isInput: true },
    { name: 'SGA', slug: 'sga', formula: null as string | null, isInput: true },
    { name: 'RnD', slug: 'rd', formula: null as string | null, isInput: true },
    { name: 'EBITDA', slug: 'ebitda', formula: 'Gross Profit - Operating Expenses - SGA - RnD', isInput: false },
    { name: 'Depreciation', slug: 'depreciation', formula: null as string | null, isInput: true },
    { name: 'EBIT', slug: 'ebit', formula: 'EBITDA - Depreciation', isInput: false },
    { name: 'Tax', slug: 'tax', formula: null as string | null, isInput: true },
    { name: 'Net Income', slug: 'net-income', formula: 'EBIT - Tax', isInput: false },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];

  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      blockType: 'metric',
      formula: def.formula,
      formatType: 'currency',
      sortOrder: insertedBlocks.length,
    }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });

    // Assign dimensions to all blocks (formula blocks inherit dimensions from dependencies)
    {
      const bdRows = insertedDims.map((dim, i) => ({
        blockId: blk.id,
        dimensionId: dim.id,
        sortOrder: i,
      }));
      await db.insert(blockDimensions).values(bdRows);
    }
  }

  // ---- Versions -------------------------------------------------------------
  const versionRows = [
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ];
  const insertedVersions = await db.insert(versions).values(versionRows).returning();

  // ---- Board ----------------------------------------------------------------
  const layout: BoardWidget[] = [
    widget('kpi', 'Revenue', 0, 0, 3, 2, {
      blockSlug: 'revenue',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Net Income', 3, 0, 3, 2, {
      blockSlug: 'net-income',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'EBITDA', 6, 0, 3, 2, {
      blockSlug: 'ebitda',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('chart', 'P&L by Department', 0, 2, 6, 4, {
      blockSlug: 'revenue',
      dimensionSlug: 'department',
      chartType: 'bar',
    }),
    widget('grid', 'Full P&L', 0, 6, 12, 6, {
      blockSlugs: [
        'revenue', 'cogs', 'gross-profit', 'opex', 'sga', 'rd',
        'ebitda', 'depreciation', 'ebit', 'tax', 'net-income',
      ],
    }),
  ];

  await db.insert(boards).values({
    applicationId: appId,
    name: 'P&L Dashboard',
    slug: 'pl-dashboard',
    layout,
    sortOrder: 0,
  });

  // ---- Sample cell data for input blocks ------------------------------------
  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const deptMembers = memberIdsByDimSlug['department'] ?? [];
  const plTimeMembers = memberIdsByDimSlug['time-period'] ?? [];

  const plInputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'revenue', min: 100000, max: 500000 },
    { slug: 'cogs', min: 40000, max: 150000 },
    { slug: 'opex', min: 20000, max: 80000 },
    { slug: 'sga', min: 10000, max: 40000 },
    { slug: 'rd', min: 15000, max: 60000 },
    { slug: 'depreciation', min: 5000, max: 20000 },
    { slug: 'tax', min: 10000, max: 50000 },
  ];

  const plCellRows: Array<{
    blockId: string;
    coordinates: Record<string, string>;
    numericValue: number;
    isInput: boolean;
    versionId: string;
  }> = [];

  for (const seed of plInputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of deptMembers) {
      for (const month of plTimeMembers) {
        plCellRows.push({
          blockId: blk.id,
          coordinates: {
            department: dept.id,
            'time-period': month.id,
          },
          numericValue: randInt(seed.min, seed.max),
          isInput: true,
          versionId: budgetVersion.id,
        });
      }
    }
  }

  const PL_CHUNK = 100;
  for (let i = 0; i < plCellRows.length; i += PL_CHUNK) {
    await db.insert(cells).values(plCellRows.slice(i, i + PL_CHUNK));
  }

  return {
    blocks: insertedBlocks.length,
    dimensions: insertedDims.length,
    boards: 1,
    versions: insertedVersions.length,
    cells: plCellRows.length,
  };
}

// ---------------------------------------------------------------------------
// Template: Workforce Planning (HR Module)
// ---------------------------------------------------------------------------

async function seedWorkforcePlanning(
  db: Database,
  appId: string,
) {
  // ---- Dimensions -----------------------------------------------------------
  const dimDefs = [
    {
      name: 'Department',
      slug: 'department',
      members: [
        'Engineering', 'Product', 'Sales', 'Marketing',
        'Finance', 'HR', 'Operations', 'Customer Success',
      ],
    },
    {
      name: 'Employee Level',
      slug: 'employee-level',
      members: ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP', 'C-Suite'],
    },
    {
      name: 'Location',
      slug: 'location',
      members: ['HQ', 'Remote', 'Office - EU', 'Office - APAC'],
    },
    {
      name: 'Time Period',
      slug: 'time-period',
      members: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ],
    },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};

  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      sortOrder: insertedDims.length,
    }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });

    const memberRows = def.members.map((name, i) => ({
      dimensionId: dim.id,
      name,
      code: name.toLowerCase().replace(/\s+/g, '-'),
      sortOrder: i,
    }));
    const insertedMembers = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = insertedMembers.map((m) => ({ id: m.id, name: m.name }));
  }

  // ---- Blocks ---------------------------------------------------------------
  const blockDefs = [
    { name: 'Headcount', slug: 'headcount', formula: null as string | null, formatType: 'number' },
    { name: 'Base Salary', slug: 'base-salary', formula: null as string | null, formatType: 'currency' },
    { name: 'Benefits Rate', slug: 'benefits-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Total Compensation', slug: 'total-compensation', formula: 'Base Salary * (1 + Benefits Rate)', formatType: 'currency' },
    { name: 'New Hires', slug: 'new-hires', formula: null as string | null, formatType: 'number' },
    { name: 'Attrition', slug: 'attrition', formula: null as string | null, formatType: 'number' },
    { name: 'Net Headcount Change', slug: 'net-headcount-change', formula: 'New Hires - Attrition', formatType: 'number' },
    { name: 'Total Payroll', slug: 'total-payroll', formula: 'Headcount * Total Compensation', formatType: 'currency' },
    { name: 'Cost Per Hire', slug: 'cost-per-hire', formula: null as string | null, formatType: 'currency' },
    { name: 'Recruiting Cost', slug: 'recruiting-cost', formula: 'New Hires * Cost Per Hire', formatType: 'currency' },
    { name: 'Training Budget', slug: 'training-budget', formula: null as string | null, formatType: 'currency' },
    { name: 'Total HR Cost', slug: 'total-hr-cost', formula: 'Total Payroll + Recruiting Cost + Training Budget', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];

  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      blockType: 'metric',
      formula: def.formula,
      formatType: def.formatType as 'number' | 'currency' | 'percentage',
      sortOrder: insertedBlocks.length,
    }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });

    const bdRows = insertedDims.map((dim, i) => ({
      blockId: blk.id,
      dimensionId: dim.id,
      sortOrder: i,
    }));
    await db.insert(blockDimensions).values(bdRows);
  }

  // ---- Versions -------------------------------------------------------------
  const versionRows = [
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Forecast 2025', versionType: 'forecast' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ];
  const insertedVersions = await db.insert(versions).values(versionRows).returning();

  // ---- Board ----------------------------------------------------------------
  const layout: BoardWidget[] = [
    widget('kpi', 'Total Headcount', 0, 0, 3, 2, {
      blockSlug: 'headcount',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Total Payroll', 3, 0, 3, 2, {
      blockSlug: 'total-payroll',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Net HC Change', 6, 0, 3, 2, {
      blockSlug: 'net-headcount-change',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Total HR Cost', 9, 0, 3, 2, {
      blockSlug: 'total-hr-cost',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('chart', 'Headcount by Department', 0, 2, 6, 4, {
      blockSlug: 'headcount',
      dimensionSlug: 'department',
      chartType: 'bar',
    }),
    widget('chart', 'Payroll by Level', 6, 2, 6, 4, {
      blockSlug: 'total-payroll',
      dimensionSlug: 'employee-level',
      chartType: 'bar',
    }),
    widget('chart', 'Hiring vs Attrition Trend', 0, 6, 6, 4, {
      blockSlug: 'new-hires',
      dimensionSlug: 'time-period',
      chartType: 'line',
    }),
    widget('grid', 'Workforce Summary', 0, 10, 12, 6, {
      blockSlugs: [
        'headcount', 'base-salary', 'benefits-rate', 'total-compensation',
        'new-hires', 'attrition', 'net-headcount-change',
        'total-payroll', 'recruiting-cost', 'training-budget', 'total-hr-cost',
      ],
    }),
  ];

  await db.insert(boards).values({
    applicationId: appId,
    name: 'HR Dashboard',
    slug: 'hr-dashboard',
    layout,
    sortOrder: 0,
  });

  // ---- Sample cell data for input blocks ------------------------------------
  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const deptMembers = memberIdsByDimSlug['department'] ?? [];
  const levelMembers = memberIdsByDimSlug['employee-level'] ?? [];
  const locationMembers = memberIdsByDimSlug['location'] ?? [];
  const timeMembers = memberIdsByDimSlug['time-period'] ?? [];

  const inputBlockSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'headcount', min: 2, max: 25 },
    { slug: 'base-salary', min: 3000, max: 18000 },
    { slug: 'benefits-rate', min: 15, max: 35 },
    { slug: 'new-hires', min: 0, max: 5 },
    { slug: 'attrition', min: 0, max: 3 },
    { slug: 'cost-per-hire', min: 3000, max: 12000 },
    { slug: 'training-budget', min: 500, max: 5000 },
  ];

  const cellRows: Array<{
    blockId: string;
    coordinates: Record<string, string>;
    numericValue: number;
    isInput: boolean;
    versionId: string;
  }> = [];

  for (const seed of inputBlockSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of deptMembers) {
      for (const level of levelMembers) {
        for (const loc of locationMembers) {
          for (const month of timeMembers) {
            cellRows.push({
              blockId: blk.id,
              coordinates: {
                department: dept.id,
                'employee-level': level.id,
                location: loc.id,
                'time-period': month.id,
              },
              numericValue: randInt(seed.min, seed.max),
              isInput: true,
              versionId: budgetVersion.id,
            });
          }
        }
      }
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < cellRows.length; i += CHUNK_SIZE) {
    await db.insert(cells).values(cellRows.slice(i, i + CHUNK_SIZE));
  }

  return {
    blocks: insertedBlocks.length,
    dimensions: insertedDims.length,
    boards: 1,
    versions: insertedVersions.length,
    cells: cellRows.length,
  };
}

// ---------------------------------------------------------------------------
// Template: Recruitment Pipeline (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedRecruitmentPipeline(
  db: Database,
  appId: string,
) {
  // ---- Dimensions -----------------------------------------------------------
  const dimDefs = [
    {
      name: 'Department',
      slug: 'department',
      members: [
        'Engineering', 'Product', 'Sales', 'Marketing',
        'Finance', 'HR', 'Operations', 'Customer Success',
      ],
    },
    {
      name: 'Job Level',
      slug: 'job-level',
      members: ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director'],
    },
    {
      name: 'Recruitment Stage',
      slug: 'recruitment-stage',
      members: ['Screening', 'Interview', 'Assessment', 'Offer', 'Hired', 'Rejected'],
    },
    {
      name: 'Quarter',
      slug: 'quarter',
      members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
    },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};

  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      sortOrder: insertedDims.length,
    }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });

    const memberRows = def.members.map((name, i) => ({
      dimensionId: dim.id,
      name,
      code: name.toLowerCase().replace(/\s+/g, '-'),
      sortOrder: i,
    }));
    const insertedMembers = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = insertedMembers.map((m) => ({ id: m.id, name: m.name }));
  }

  // ---- Blocks ---------------------------------------------------------------
  const blockDefs = [
    { name: 'Open Positions', slug: 'open-positions', formula: null as string | null, formatType: 'number' },
    { name: 'Applications Received', slug: 'applications-received', formula: null as string | null, formatType: 'number' },
    { name: 'Application-to-Screen Rate', slug: 'application-to-screen-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Candidates Screened', slug: 'candidates-screened', formula: null as string | null, formatType: 'number' },
    { name: 'Interviews Scheduled', slug: 'interviews-scheduled', formula: null as string | null, formatType: 'number' },
    { name: 'Interview-to-Offer Rate', slug: 'interview-to-offer-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Offers Extended', slug: 'offers-extended', formula: null as string | null, formatType: 'number' },
    { name: 'Offers Accepted', slug: 'offers-accepted', formula: null as string | null, formatType: 'number' },
    { name: 'Offer Acceptance Rate', slug: 'offer-acceptance-rate', formula: 'Offers Accepted / Offers Extended * 100', formatType: 'percentage' },
    { name: 'Time to Fill', slug: 'time-to-fill', formula: null as string | null, formatType: 'number' },
    { name: 'Cost Per Hire', slug: 'cost-per-hire', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Recruiting Spend', slug: 'total-recruiting-spend', formula: 'Offers Accepted * Cost Per Hire', formatType: 'currency' },
    { name: 'Agency Fees', slug: 'agency-fees', formula: null as string | null, formatType: 'currency' },
    { name: 'Job Board Spend', slug: 'job-board-spend', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Talent Acquisition Cost', slug: 'total-talent-acquisition-cost', formula: 'Total Recruiting Spend + Agency Fees + Job Board Spend', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];

  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      blockType: 'metric',
      formula: def.formula,
      formatType: def.formatType as 'number' | 'currency' | 'percentage',
      sortOrder: insertedBlocks.length,
    }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });

    const bdRows = insertedDims.map((dim, i) => ({
      blockId: blk.id,
      dimensionId: dim.id,
      sortOrder: i,
    }));
    await db.insert(blockDimensions).values(bdRows);
  }

  // ---- Versions -------------------------------------------------------------
  const versionRows = [
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Forecast 2025', versionType: 'forecast' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ];
  const insertedVersions = await db.insert(versions).values(versionRows).returning();

  // ---- Board ----------------------------------------------------------------
  const layout: BoardWidget[] = [
    widget('kpi', 'Open Positions', 0, 0, 3, 2, {
      blockSlug: 'open-positions',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Offers Accepted', 3, 0, 3, 2, {
      blockSlug: 'offers-accepted',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Offer Acceptance Rate', 6, 0, 3, 2, {
      blockSlug: 'offer-acceptance-rate',
      format: 'percent',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Cost Per Hire', 9, 0, 3, 2, {
      blockSlug: 'cost-per-hire',
      format: 'currency',
      value: 0,
      previousValue: 0,
    }),
    widget('chart', 'Applications by Department', 0, 2, 6, 4, {
      blockSlug: 'applications-received',
      dimensionSlug: 'department',
      chartType: 'bar',
    }),
    widget('chart', 'Pipeline by Stage', 6, 2, 6, 4, {
      blockSlug: 'candidates-screened',
      dimensionSlug: 'recruitment-stage',
      chartType: 'bar',
    }),
    widget('grid', 'Recruitment Metrics Summary', 0, 6, 12, 6, {
      blockSlugs: [
        'open-positions', 'applications-received', 'application-to-screen-rate',
        'candidates-screened', 'interviews-scheduled', 'interview-to-offer-rate',
        'offers-extended', 'offers-accepted', 'offer-acceptance-rate',
        'time-to-fill', 'cost-per-hire', 'total-recruiting-spend',
        'agency-fees', 'job-board-spend', 'total-talent-acquisition-cost',
      ],
    }),
  ];

  await db.insert(boards).values({
    applicationId: appId,
    name: 'Recruitment Dashboard',
    slug: 'recruitment-dashboard',
    layout,
    sortOrder: 0,
  });

  // ---- Sample cell data for input blocks ------------------------------------
  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const deptMembers = memberIdsByDimSlug['department'] ?? [];
  const levelMembers = memberIdsByDimSlug['job-level'] ?? [];
  const stageMembers = memberIdsByDimSlug['recruitment-stage'] ?? [];
  const quarterMembers = memberIdsByDimSlug['quarter'] ?? [];

  const inputBlockSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'open-positions', min: 1, max: 8 },
    { slug: 'applications-received', min: 10, max: 80 },
    { slug: 'application-to-screen-rate', min: 30, max: 70 },
    { slug: 'candidates-screened', min: 5, max: 40 },
    { slug: 'interviews-scheduled', min: 3, max: 20 },
    { slug: 'interview-to-offer-rate', min: 20, max: 50 },
    { slug: 'offers-extended', min: 1, max: 10 },
    { slug: 'offers-accepted', min: 1, max: 8 },
    { slug: 'time-to-fill', min: 20, max: 60 },
    { slug: 'cost-per-hire', min: 5000, max: 25000 },
    { slug: 'agency-fees', min: 2000, max: 15000 },
    { slug: 'job-board-spend', min: 1000, max: 8000 },
  ];

  const cellRows: Array<{
    blockId: string;
    coordinates: Record<string, string>;
    numericValue: number;
    isInput: boolean;
    versionId: string;
  }> = [];

  for (const seed of inputBlockSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of deptMembers) {
      for (const level of levelMembers) {
        for (const stage of stageMembers) {
          for (const quarter of quarterMembers) {
            cellRows.push({
              blockId: blk.id,
              coordinates: {
                department: dept.id,
                'job-level': level.id,
                'recruitment-stage': stage.id,
                quarter: quarter.id,
              },
              numericValue: randInt(seed.min, seed.max),
              isInput: true,
              versionId: budgetVersion.id,
            });
          }
        }
      }
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < cellRows.length; i += CHUNK_SIZE) {
    await db.insert(cells).values(cellRows.slice(i, i + CHUNK_SIZE));
  }

  return {
    blocks: insertedBlocks.length,
    dimensions: insertedDims.length,
    boards: 1,
    versions: insertedVersions.length,
    cells: cellRows.length,
  };
}

// ---------------------------------------------------------------------------
// Template: KPI Performance Management (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedKPIPerformance(
  db: Database,
  appId: string,
) {
  // ---- Dimensions -----------------------------------------------------------
  const dimDefs = [
    {
      name: 'Department',
      slug: 'department',
      members: [
        'Engineering', 'Product', 'Sales', 'Marketing',
        'Finance', 'HR', 'Operations', 'Customer Success',
      ],
    },
    {
      name: 'KPI Category',
      slug: 'kpi-category',
      members: ['Financial', 'Customer', 'Process', 'Learning & Growth', 'Innovation'],
    },
    {
      name: 'Review Period',
      slug: 'review-period',
      members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
    },
    {
      name: 'Rating Scale',
      slug: 'rating-scale',
      members: ['Exceeds (5)', 'Meets+ (4)', 'Meets (3)', 'Below (2)', 'Unsatisfactory (1)'],
    },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};

  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      sortOrder: insertedDims.length,
    }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });

    const memberRows = def.members.map((name, i) => ({
      dimensionId: dim.id,
      name,
      code: name.toLowerCase().replace(/\s+/g, '-'),
      sortOrder: i,
    }));
    const insertedMembers = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = insertedMembers.map((m) => ({ id: m.id, name: m.name }));
  }

  // ---- Blocks ---------------------------------------------------------------
  const blockDefs = [
    { name: 'Target Score', slug: 'target-score', formula: null as string | null, formatType: 'number' },
    { name: 'Self Assessment Score', slug: 'self-assessment-score', formula: null as string | null, formatType: 'number' },
    { name: 'Manager Score', slug: 'manager-score', formula: null as string | null, formatType: 'number' },
    { name: 'Peer Score', slug: 'peer-score', formula: null as string | null, formatType: 'number' },
    { name: 'Overall Score', slug: 'overall-score', formula: '(Self Assessment Score + Manager Score * 2 + Peer Score) / 4', formatType: 'number' },
    { name: 'Goal Completion Rate', slug: 'goal-completion-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Employees Reviewed', slug: 'employees-reviewed', formula: null as string | null, formatType: 'number' },
    { name: 'Total Employees', slug: 'total-employees', formula: null as string | null, formatType: 'number' },
    { name: 'Review Completion Rate', slug: 'review-completion-rate', formula: 'Employees Reviewed / Total Employees * 100', formatType: 'percentage' },
    { name: 'High Performers', slug: 'high-performers', formula: null as string | null, formatType: 'number' },
    { name: 'Needs Improvement', slug: 'needs-improvement', formula: null as string | null, formatType: 'number' },
    { name: 'Performance Distribution', slug: 'performance-distribution', formula: 'High Performers / Employees Reviewed * 100', formatType: 'percentage' },
    { name: 'Training Hours', slug: 'training-hours', formula: null as string | null, formatType: 'number' },
    { name: 'Training Budget Spent', slug: 'training-budget-spent', formula: null as string | null, formatType: 'currency' },
    { name: 'Cost Per Training Hour', slug: 'cost-per-training-hour', formula: 'Training Budget Spent / Training Hours', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];

  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      blockType: 'metric',
      formula: def.formula,
      formatType: def.formatType as 'number' | 'currency' | 'percentage',
      sortOrder: insertedBlocks.length,
    }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });

    const bdRows = insertedDims.map((dim, i) => ({
      blockId: blk.id,
      dimensionId: dim.id,
      sortOrder: i,
    }));
    await db.insert(blockDimensions).values(bdRows);
  }

  // ---- Versions -------------------------------------------------------------
  const versionRows = [
    { applicationId: appId, name: 'FY 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'FY 2024', versionType: 'actuals' as const, isLocked: 0 },
  ];
  const insertedVersions = await db.insert(versions).values(versionRows).returning();

  // ---- Board ----------------------------------------------------------------
  const layout: BoardWidget[] = [
    widget('kpi', 'Overall Score', 0, 0, 3, 2, {
      blockSlug: 'overall-score',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Review Completion Rate', 3, 0, 3, 2, {
      blockSlug: 'review-completion-rate',
      format: 'percent',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'High Performers', 6, 0, 3, 2, {
      blockSlug: 'high-performers',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Performance Distribution', 9, 0, 3, 2, {
      blockSlug: 'performance-distribution',
      format: 'percent',
      value: 0,
      previousValue: 0,
    }),
    widget('chart', 'Scores by Department', 0, 2, 6, 4, {
      blockSlug: 'overall-score',
      dimensionSlug: 'department',
      chartType: 'bar',
    }),
    widget('chart', 'Scores by KPI Category', 6, 2, 6, 4, {
      blockSlug: 'overall-score',
      dimensionSlug: 'kpi-category',
      chartType: 'bar',
    }),
    widget('grid', 'Full KPI Metrics', 0, 6, 12, 6, {
      blockSlugs: [
        'target-score', 'self-assessment-score', 'manager-score', 'peer-score',
        'overall-score', 'goal-completion-rate', 'employees-reviewed', 'total-employees',
        'review-completion-rate', 'high-performers', 'needs-improvement',
        'performance-distribution', 'training-hours', 'training-budget-spent',
        'cost-per-training-hour',
      ],
    }),
  ];

  await db.insert(boards).values({
    applicationId: appId,
    name: 'KPI Dashboard',
    slug: 'kpi-dashboard',
    layout,
    sortOrder: 0,
  });

  // ---- Sample cell data for input blocks ------------------------------------
  const fy2025Version = insertedVersions.find((v) => v.versionType === 'budget')!;
  const deptMembers = memberIdsByDimSlug['department'] ?? [];
  const categoryMembers = memberIdsByDimSlug['kpi-category'] ?? [];
  const periodMembers = memberIdsByDimSlug['review-period'] ?? [];
  const ratingMembers = memberIdsByDimSlug['rating-scale'] ?? [];

  const inputBlockSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'target-score', min: 3, max: 5 },
    { slug: 'self-assessment-score', min: 2, max: 5 },
    { slug: 'manager-score', min: 2, max: 5 },
    { slug: 'peer-score', min: 2, max: 5 },
    { slug: 'goal-completion-rate', min: 40, max: 95 },
    { slug: 'employees-reviewed', min: 5, max: 30 },
    { slug: 'total-employees', min: 8, max: 40 },
    { slug: 'high-performers', min: 2, max: 10 },
    { slug: 'needs-improvement', min: 0, max: 5 },
    { slug: 'training-hours', min: 10, max: 80 },
    { slug: 'training-budget-spent', min: 2000, max: 15000 },
  ];

  const cellRows: Array<{
    blockId: string;
    coordinates: Record<string, string>;
    numericValue: number;
    isInput: boolean;
    versionId: string;
  }> = [];

  for (const seed of inputBlockSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of deptMembers) {
      for (const category of categoryMembers) {
        for (const period of periodMembers) {
          for (const rating of ratingMembers) {
            cellRows.push({
              blockId: blk.id,
              coordinates: {
                department: dept.id,
                'kpi-category': category.id,
                'review-period': period.id,
                'rating-scale': rating.id,
              },
              numericValue: randInt(seed.min, seed.max),
              isInput: true,
              versionId: fy2025Version.id,
            });
          }
        }
      }
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < cellRows.length; i += CHUNK_SIZE) {
    await db.insert(cells).values(cellRows.slice(i, i + CHUNK_SIZE));
  }

  return {
    blocks: insertedBlocks.length,
    dimensions: insertedDims.length,
    boards: 1,
    versions: insertedVersions.length,
    cells: cellRows.length,
  };
}

// ---------------------------------------------------------------------------
// Template: Learning & Development (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedLearningDevelopment(
  db: Database,
  appId: string,
) {
  // ---- Dimensions -----------------------------------------------------------
  const dimDefs = [
    {
      name: 'Department',
      slug: 'department',
      members: [
        'Engineering', 'Product', 'Sales', 'Marketing',
        'Finance', 'HR', 'Operations', 'Customer Success',
      ],
    },
    {
      name: 'Skill Category',
      slug: 'skill-category',
      members: ['Technical', 'Leadership', 'Communication', 'Compliance', 'Industry-Specific'],
    },
    {
      name: 'Training Type',
      slug: 'training-type',
      members: ['Classroom', 'Online', 'Workshop', 'Certification', 'Mentorship'],
    },
    {
      name: 'Quarter',
      slug: 'quarter',
      members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
    },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};

  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      sortOrder: insertedDims.length,
    }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });

    const memberRows = def.members.map((name, i) => ({
      dimensionId: dim.id,
      name,
      code: name.toLowerCase().replace(/\s+/g, '-'),
      sortOrder: i,
    }));
    const insertedMembers = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = insertedMembers.map((m) => ({ id: m.id, name: m.name }));
  }

  // ---- Blocks ---------------------------------------------------------------
  const blockDefs = [
    { name: 'Training Sessions Planned', slug: 'training-sessions-planned', formula: null as string | null, formatType: 'number' },
    { name: 'Training Sessions Completed', slug: 'training-sessions-completed', formula: null as string | null, formatType: 'number' },
    { name: 'Completion Rate', slug: 'completion-rate', formula: 'Training Sessions Completed / Training Sessions Planned * 100', formatType: 'percentage' },
    { name: 'Employees Enrolled', slug: 'employees-enrolled', formula: null as string | null, formatType: 'number' },
    { name: 'Certifications Earned', slug: 'certifications-earned', formula: null as string | null, formatType: 'number' },
    { name: 'Skill Gap Score', slug: 'skill-gap-score', formula: null as string | null, formatType: 'number' },
    { name: 'Training Budget', slug: 'training-budget', formula: null as string | null, formatType: 'currency' },
    { name: 'Training Spend', slug: 'training-spend', formula: null as string | null, formatType: 'currency' },
    { name: 'Budget Utilization', slug: 'budget-utilization', formula: 'Training Spend / Training Budget * 100', formatType: 'percentage' },
    { name: 'Cost Per Employee', slug: 'cost-per-employee', formula: 'Training Spend / Employees Enrolled', formatType: 'currency' },
    { name: 'Hours Per Employee', slug: 'hours-per-employee', formula: null as string | null, formatType: 'number' },
    { name: 'Total Training Hours', slug: 'total-training-hours', formula: 'Hours Per Employee * Employees Enrolled', formatType: 'number' },
    { name: 'Course Satisfaction Score', slug: 'course-satisfaction-score', formula: null as string | null, formatType: 'number' },
    { name: 'Knowledge Retention Rate', slug: 'knowledge-retention-rate', formula: null as string | null, formatType: 'percentage' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];

  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({
      applicationId: appId,
      name: def.name,
      slug: def.slug,
      blockType: 'metric',
      formula: def.formula,
      formatType: def.formatType as 'number' | 'currency' | 'percentage',
      sortOrder: insertedBlocks.length,
    }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });

    const bdRows = insertedDims.map((dim, i) => ({
      blockId: blk.id,
      dimensionId: dim.id,
      sortOrder: i,
    }));
    await db.insert(blockDimensions).values(bdRows);
  }

  // ---- Versions -------------------------------------------------------------
  const versionRows = [
    { applicationId: appId, name: 'Plan 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ];
  const insertedVersions = await db.insert(versions).values(versionRows).returning();

  // ---- Board ----------------------------------------------------------------
  const layout: BoardWidget[] = [
    widget('kpi', 'Completion Rate', 0, 0, 3, 2, {
      blockSlug: 'completion-rate',
      format: 'percent',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Certifications Earned', 3, 0, 3, 2, {
      blockSlug: 'certifications-earned',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Budget Utilization', 6, 0, 3, 2, {
      blockSlug: 'budget-utilization',
      format: 'percent',
      value: 0,
      previousValue: 0,
    }),
    widget('kpi', 'Course Satisfaction Score', 9, 0, 3, 2, {
      blockSlug: 'course-satisfaction-score',
      format: 'number',
      value: 0,
      previousValue: 0,
    }),
    widget('chart', 'Training by Department', 0, 2, 6, 4, {
      blockSlug: 'training-sessions-completed',
      dimensionSlug: 'department',
      chartType: 'bar',
    }),
    widget('chart', 'Training by Type', 6, 2, 6, 4, {
      blockSlug: 'training-sessions-completed',
      dimensionSlug: 'training-type',
      chartType: 'bar',
    }),
    widget('grid', 'Full L&D Metrics', 0, 6, 12, 6, {
      blockSlugs: [
        'training-sessions-planned', 'training-sessions-completed', 'completion-rate',
        'employees-enrolled', 'certifications-earned', 'skill-gap-score',
        'training-budget', 'training-spend', 'budget-utilization',
        'cost-per-employee', 'hours-per-employee', 'total-training-hours',
        'course-satisfaction-score', 'knowledge-retention-rate',
      ],
    }),
  ];

  await db.insert(boards).values({
    applicationId: appId,
    name: 'L&D Dashboard',
    slug: 'ld-dashboard',
    layout,
    sortOrder: 0,
  });

  // ---- Sample cell data for input blocks ------------------------------------
  const planVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const deptMembers = memberIdsByDimSlug['department'] ?? [];
  const skillMembers = memberIdsByDimSlug['skill-category'] ?? [];
  const typeMembers = memberIdsByDimSlug['training-type'] ?? [];
  const quarterMembers = memberIdsByDimSlug['quarter'] ?? [];

  const inputBlockSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'training-sessions-planned', min: 2, max: 15 },
    { slug: 'training-sessions-completed', min: 1, max: 12 },
    { slug: 'employees-enrolled', min: 5, max: 40 },
    { slug: 'certifications-earned', min: 1, max: 10 },
    { slug: 'skill-gap-score', min: 2, max: 8 },
    { slug: 'training-budget', min: 5000, max: 30000 },
    { slug: 'training-spend', min: 3000, max: 25000 },
    { slug: 'hours-per-employee', min: 5, max: 40 },
    { slug: 'course-satisfaction-score', min: 2, max: 5 },
    { slug: 'knowledge-retention-rate', min: 50, max: 90 },
  ];

  const cellRows: Array<{
    blockId: string;
    coordinates: Record<string, string>;
    numericValue: number;
    isInput: boolean;
    versionId: string;
  }> = [];

  for (const seed of inputBlockSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of deptMembers) {
      for (const skill of skillMembers) {
        for (const ttype of typeMembers) {
          for (const quarter of quarterMembers) {
            cellRows.push({
              blockId: blk.id,
              coordinates: {
                department: dept.id,
                'skill-category': skill.id,
                'training-type': ttype.id,
                quarter: quarter.id,
              },
              numericValue: randInt(seed.min, seed.max),
              isInput: true,
              versionId: planVersion.id,
            });
          }
        }
      }
    }
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < cellRows.length; i += CHUNK_SIZE) {
    await db.insert(cells).values(cellRows.slice(i, i + CHUNK_SIZE));
  }

  return {
    blocks: insertedBlocks.length,
    dimensions: insertedDims.length,
    boards: 1,
    versions: insertedVersions.length,
    cells: cellRows.length,
  };
}

// ---------------------------------------------------------------------------
// Template: Employee Onboarding (HR Module)
// ---------------------------------------------------------------------------

async function seedEmployeeOnboarding(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Customer Success'] },
    { name: 'Onboarding Phase', slug: 'onboarding-phase', members: ['Pre-boarding', 'Day 1', 'Week 1', 'Month 1', 'Month 2-3', 'Probation Review'] },
    { name: 'Document Type', slug: 'document-type', members: ['ID Verification', 'Tax Forms', 'Bank Details', 'NDA', 'Policy Acknowledgment', 'Equipment Sign-off'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'New Hires', slug: 'new-hires', formula: null as string | null, formatType: 'number' },
    { name: 'Tasks Assigned', slug: 'tasks-assigned', formula: null as string | null, formatType: 'number' },
    { name: 'Tasks Completed', slug: 'tasks-completed', formula: null as string | null, formatType: 'number' },
    { name: 'Task Completion Rate', slug: 'task-completion-rate', formula: 'Tasks Completed / Tasks Assigned * 100', formatType: 'percentage' },
    { name: 'Documents Required', slug: 'docs-required', formula: null as string | null, formatType: 'number' },
    { name: 'Documents Collected', slug: 'docs-collected', formula: null as string | null, formatType: 'number' },
    { name: 'Document Collection Rate', slug: 'doc-collection-rate', formula: 'Documents Collected / Documents Required * 100', formatType: 'percentage' },
    { name: 'Days to Productivity', slug: 'days-to-productivity', formula: null as string | null, formatType: 'number' },
    { name: 'Onboarding Satisfaction', slug: 'onboarding-satisfaction', formula: null as string | null, formatType: 'number' },
    { name: 'IT Setup Time (hrs)', slug: 'it-setup-time', formula: null as string | null, formatType: 'number' },
    { name: 'Onboarding Cost', slug: 'onboarding-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Cost Per New Hire', slug: 'cost-per-new-hire', formula: 'Onboarding Cost / New Hires', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Plan 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'New Hires', 0, 0, 3, 2, { blockSlug: 'new-hires', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Task Completion', 3, 0, 3, 2, { blockSlug: 'task-completion-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Doc Collection', 6, 0, 3, 2, { blockSlug: 'doc-collection-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Days to Productivity', 9, 0, 3, 2, { blockSlug: 'days-to-productivity', format: 'number', value: 0, previousValue: 0 }),
    widget('chart', 'New Hires by Department', 0, 2, 6, 4, { blockSlug: 'new-hires', dimensionSlug: 'department', chartType: 'bar' }),
    widget('chart', 'Completion by Phase', 6, 2, 6, 4, { blockSlug: 'task-completion-rate', dimensionSlug: 'onboarding-phase', chartType: 'bar' }),
    widget('grid', 'Onboarding Metrics', 0, 6, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Onboarding Dashboard', slug: 'onboarding-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'new-hires', min: 1, max: 8 }, { slug: 'tasks-assigned', min: 5, max: 20 }, { slug: 'tasks-completed', min: 3, max: 18 },
    { slug: 'docs-required', min: 3, max: 8 }, { slug: 'docs-collected', min: 2, max: 8 }, { slug: 'days-to-productivity', min: 14, max: 90 },
    { slug: 'onboarding-satisfaction', min: 2, max: 5 }, { slug: 'it-setup-time', min: 2, max: 16 }, { slug: 'onboarding-cost', min: 1000, max: 8000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of (memberIdsByDimSlug['department'] ?? [])) {
      for (const phase of (memberIdsByDimSlug['onboarding-phase'] ?? [])) {
        for (const docType of (memberIdsByDimSlug['document-type'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dept.id, 'onboarding-phase': phase.id, 'document-type': docType.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Compensation & Benefits (HR Module)
// ---------------------------------------------------------------------------

async function seedCompensationBenefits(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Customer Success'] },
    { name: 'Job Grade', slug: 'job-grade', members: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'] },
    { name: 'Benefit Type', slug: 'benefit-type', members: ['Medical Aid', 'Retirement Fund', 'Life Insurance', 'Disability Cover', 'Leave Allowance', 'Transport Allowance'] },
    { name: 'Time Period', slug: 'time-period', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Headcount', slug: 'headcount', formula: null as string | null, formatType: 'number' },
    { name: 'Base Salary', slug: 'base-salary', formula: null as string | null, formatType: 'currency' },
    { name: 'Salary Band Min', slug: 'salary-band-min', formula: null as string | null, formatType: 'currency' },
    { name: 'Salary Band Max', slug: 'salary-band-max', formula: null as string | null, formatType: 'currency' },
    { name: 'Compa-Ratio', slug: 'compa-ratio', formula: 'Base Salary / ((Salary Band Min + Salary Band Max) / 2) * 100', formatType: 'percentage' },
    { name: 'Benefits Cost', slug: 'benefits-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Bonus Target %', slug: 'bonus-target-pct', formula: null as string | null, formatType: 'percentage' },
    { name: 'Bonus Amount', slug: 'bonus-amount', formula: 'Base Salary * Bonus Target % / 100', formatType: 'currency' },
    { name: 'Total Cash Comp', slug: 'total-cash-comp', formula: 'Base Salary + Bonus Amount', formatType: 'currency' },
    { name: 'Total Rewards', slug: 'total-rewards', formula: 'Total Cash Comp + Benefits Cost', formatType: 'currency' },
    { name: 'Equity Value', slug: 'equity-value', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Comp Package', slug: 'total-comp-package', formula: 'Total Rewards + Equity Value', formatType: 'currency' },
    { name: 'Pay Equity Ratio', slug: 'pay-equity-ratio', formula: null as string | null, formatType: 'percentage' },
    { name: 'Total Payroll Cost', slug: 'total-payroll-cost', formula: 'Headcount * Total Comp Package', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Avg Base Salary', 0, 0, 3, 2, { blockSlug: 'base-salary', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Compa-Ratio', 3, 0, 3, 2, { blockSlug: 'compa-ratio', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Total Rewards', 6, 0, 3, 2, { blockSlug: 'total-rewards', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Total Payroll', 9, 0, 3, 2, { blockSlug: 'total-payroll-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Salary by Department', 0, 2, 6, 4, { blockSlug: 'base-salary', dimensionSlug: 'department', chartType: 'bar' }),
    widget('chart', 'Benefits by Type', 6, 2, 6, 4, { blockSlug: 'benefits-cost', dimensionSlug: 'benefit-type', chartType: 'bar' }),
    widget('grid', 'Compensation Summary', 0, 6, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Compensation Dashboard', slug: 'compensation-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'headcount', min: 1, max: 15 }, { slug: 'base-salary', min: 8000, max: 45000 },
    { slug: 'salary-band-min', min: 6000, max: 35000 }, { slug: 'salary-band-max', min: 12000, max: 60000 },
    { slug: 'benefits-cost', min: 1500, max: 8000 }, { slug: 'bonus-target-pct', min: 5, max: 30 },
    { slug: 'equity-value', min: 0, max: 20000 }, { slug: 'pay-equity-ratio', min: 85, max: 105 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of (memberIdsByDimSlug['department'] ?? [])) {
      for (const grade of (memberIdsByDimSlug['job-grade'] ?? [])) {
        for (const benefit of (memberIdsByDimSlug['benefit-type'] ?? [])) {
          for (const month of (memberIdsByDimSlug['time-period'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dept.id, 'job-grade': grade.id, 'benefit-type': benefit.id, 'time-period': month.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Fleet Management (MTN Human Capital – FleetLogix)
// ---------------------------------------------------------------------------

async function seedFleetManagement(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Vehicle Type', slug: 'vehicle-type', members: ['Rigid Truck', 'Articulated Truck', 'Light Delivery', 'Forklift', 'Trailer', 'Utility Vehicle'] },
    { name: 'Route', slug: 'route', members: ['Johannesburg - Cape Town', 'Johannesburg - Durban', 'Pretoria - Nelspruit', 'Cape Town - Port Elizabeth', 'Bloemfontein - Kimberley', 'Local Deliveries'] },
    { name: 'Driver Grade', slug: 'driver-grade', members: ['Code 10', 'Code 14', 'Code 14 + PrDP', 'Forklift Operator'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Fleet Size', slug: 'fleet-size', formula: null as string | null, formatType: 'number' },
    { name: 'Active Vehicles', slug: 'active-vehicles', formula: null as string | null, formatType: 'number' },
    { name: 'Utilization Rate', slug: 'utilization-rate', formula: 'Active Vehicles / Fleet Size * 100', formatType: 'percentage' },
    { name: 'Total Loads', slug: 'total-loads', formula: null as string | null, formatType: 'number' },
    { name: 'Total Distance (km)', slug: 'total-distance', formula: null as string | null, formatType: 'number' },
    { name: 'Fuel Consumed (L)', slug: 'fuel-consumed', formula: null as string | null, formatType: 'number' },
    { name: 'Fuel Cost', slug: 'fuel-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Fuel Efficiency (km/L)', slug: 'fuel-efficiency', formula: 'Total Distance (km) / Fuel Consumed (L)', formatType: 'number' },
    { name: 'Maintenance Cost', slug: 'maintenance-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Driver Salary Cost', slug: 'driver-salary-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Operating Cost', slug: 'total-operating-cost', formula: 'Fuel Cost + Maintenance Cost + Driver Salary Cost', formatType: 'currency' },
    { name: 'Revenue Per Load', slug: 'revenue-per-load', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Revenue', slug: 'total-revenue', formula: 'Total Loads * Revenue Per Load', formatType: 'currency' },
    { name: 'Fleet Profit', slug: 'fleet-profit', formula: 'Total Revenue - Total Operating Cost', formatType: 'currency' },
    { name: 'Cost Per Km', slug: 'cost-per-km', formula: 'Total Operating Cost / Total Distance (km)', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Fleet Size', 0, 0, 3, 2, { blockSlug: 'fleet-size', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Utilization', 3, 0, 3, 2, { blockSlug: 'utilization-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Fleet Profit', 6, 0, 3, 2, { blockSlug: 'fleet-profit', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Cost/Km', 9, 0, 3, 2, { blockSlug: 'cost-per-km', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Loads by Route', 0, 2, 6, 4, { blockSlug: 'total-loads', dimensionSlug: 'route', chartType: 'bar' }),
    widget('chart', 'Cost by Vehicle Type', 6, 2, 6, 4, { blockSlug: 'total-operating-cost', dimensionSlug: 'vehicle-type', chartType: 'bar' }),
    widget('grid', 'Fleet Operations', 0, 6, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Fleet Dashboard', slug: 'fleet-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'fleet-size', min: 2, max: 20 }, { slug: 'active-vehicles', min: 1, max: 18 },
    { slug: 'total-loads', min: 10, max: 200 }, { slug: 'total-distance', min: 500, max: 15000 },
    { slug: 'fuel-consumed', min: 100, max: 5000 }, { slug: 'fuel-cost', min: 2000, max: 100000 },
    { slug: 'maintenance-cost', min: 1000, max: 30000 }, { slug: 'driver-salary-cost', min: 5000, max: 25000 },
    { slug: 'revenue-per-load', min: 2000, max: 15000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const vt of (memberIdsByDimSlug['vehicle-type'] ?? [])) {
      for (const rt of (memberIdsByDimSlug['route'] ?? [])) {
        for (const dg of (memberIdsByDimSlug['driver-grade'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'vehicle-type': vt.id, route: rt.id, 'driver-grade': dg.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Interview Analytics (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedInterviewAnalytics(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Customer Success'] },
    { name: 'Interview Type', slug: 'interview-type', members: ['Voice (Hume AI)', 'Video (Tavus)', 'Face-to-Face', 'Panel', 'Technical Assessment'] },
    { name: 'Assessment Area', slug: 'assessment-area', members: ['Technical Skills', 'Communication', 'Problem Solving', 'Cultural Fit', 'Leadership', 'Domain Knowledge'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Interviews Scheduled', slug: 'interviews-scheduled', formula: null as string | null, formatType: 'number' },
    { name: 'Interviews Completed', slug: 'interviews-completed', formula: null as string | null, formatType: 'number' },
    { name: 'Completion Rate', slug: 'completion-rate', formula: 'Interviews Completed / Interviews Scheduled * 100', formatType: 'percentage' },
    { name: 'Avg Interview Score', slug: 'avg-interview-score', formula: null as string | null, formatType: 'number' },
    { name: 'Avg Duration (min)', slug: 'avg-duration', formula: null as string | null, formatType: 'number' },
    { name: 'No-Show Count', slug: 'no-show-count', formula: null as string | null, formatType: 'number' },
    { name: 'No-Show Rate', slug: 'no-show-rate', formula: 'No-Show Count / Interviews Scheduled * 100', formatType: 'percentage' },
    { name: 'Positive Sentiment %', slug: 'positive-sentiment', formula: null as string | null, formatType: 'percentage' },
    { name: 'Interviewer Satisfaction', slug: 'interviewer-satisfaction', formula: null as string | null, formatType: 'number' },
    { name: 'Candidate Satisfaction', slug: 'candidate-satisfaction', formula: null as string | null, formatType: 'number' },
    { name: 'Pass Rate', slug: 'pass-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Cost Per Interview', slug: 'cost-per-interview', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Interview Cost', slug: 'total-interview-cost', formula: 'Interviews Completed * Cost Per Interview', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Plan 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Interviews Done', 0, 0, 3, 2, { blockSlug: 'interviews-completed', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Score', 3, 0, 3, 2, { blockSlug: 'avg-interview-score', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Pass Rate', 6, 0, 3, 2, { blockSlug: 'pass-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'No-Show Rate', 9, 0, 3, 2, { blockSlug: 'no-show-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('chart', 'Interviews by Type', 0, 2, 6, 4, { blockSlug: 'interviews-completed', dimensionSlug: 'interview-type', chartType: 'bar' }),
    widget('chart', 'Scores by Assessment Area', 6, 2, 6, 4, { blockSlug: 'avg-interview-score', dimensionSlug: 'assessment-area', chartType: 'bar' }),
    widget('grid', 'Interview Analytics', 0, 6, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Interview Dashboard', slug: 'interview-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'interviews-scheduled', min: 3, max: 25 }, { slug: 'interviews-completed', min: 2, max: 22 },
    { slug: 'avg-interview-score', min: 40, max: 95 }, { slug: 'avg-duration', min: 15, max: 60 },
    { slug: 'no-show-count', min: 0, max: 5 }, { slug: 'positive-sentiment', min: 40, max: 90 },
    { slug: 'interviewer-satisfaction', min: 2, max: 5 }, { slug: 'candidate-satisfaction', min: 2, max: 5 },
    { slug: 'pass-rate', min: 30, max: 80 }, { slug: 'cost-per-interview', min: 200, max: 2000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of (memberIdsByDimSlug['department'] ?? [])) {
      for (const it of (memberIdsByDimSlug['interview-type'] ?? [])) {
        for (const aa of (memberIdsByDimSlug['assessment-area'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dept.id, 'interview-type': it.id, 'assessment-area': aa.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Document Management (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedDocumentManagement(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Legal'] },
    { name: 'Document Category', slug: 'doc-category', members: ['Employment Contracts', 'NDAs', 'Offer Letters', 'Policy Documents', 'Compliance Certs', 'Training Records', 'Performance Reviews'] },
    { name: 'Status', slug: 'status', members: ['Draft', 'Pending Review', 'Approved', 'Signed', 'Expired', 'Archived'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Documents Created', slug: 'docs-created', formula: null as string | null, formatType: 'number' },
    { name: 'Documents Pending', slug: 'docs-pending', formula: null as string | null, formatType: 'number' },
    { name: 'Documents Signed', slug: 'docs-signed', formula: null as string | null, formatType: 'number' },
    { name: 'Sign Completion Rate', slug: 'sign-completion-rate', formula: 'Documents Signed / Documents Created * 100', formatType: 'percentage' },
    { name: 'Avg Turnaround (days)', slug: 'avg-turnaround', formula: null as string | null, formatType: 'number' },
    { name: 'Documents Expired', slug: 'docs-expired', formula: null as string | null, formatType: 'number' },
    { name: 'Renewal Rate', slug: 'renewal-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Auto-Generated Docs', slug: 'auto-generated', formula: null as string | null, formatType: 'number' },
    { name: 'Automation Rate', slug: 'automation-rate', formula: 'Auto-Generated Docs / Documents Created * 100', formatType: 'percentage' },
    { name: 'Compliance Score', slug: 'compliance-score', formula: null as string | null, formatType: 'percentage' },
    { name: 'Storage Cost', slug: 'storage-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Processing Cost', slug: 'processing-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Doc Cost', slug: 'total-doc-cost', formula: 'Storage Cost + Processing Cost', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Plan 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Docs Created', 0, 0, 3, 2, { blockSlug: 'docs-created', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Sign Rate', 3, 0, 3, 2, { blockSlug: 'sign-completion-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Compliance', 6, 0, 3, 2, { blockSlug: 'compliance-score', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Automation', 9, 0, 3, 2, { blockSlug: 'automation-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('chart', 'Docs by Category', 0, 2, 6, 4, { blockSlug: 'docs-created', dimensionSlug: 'doc-category', chartType: 'bar' }),
    widget('chart', 'Docs by Status', 6, 2, 6, 4, { blockSlug: 'docs-created', dimensionSlug: 'status', chartType: 'bar' }),
    widget('grid', 'Document Metrics', 0, 6, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Document Dashboard', slug: 'document-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'docs-created', min: 5, max: 50 }, { slug: 'docs-pending', min: 1, max: 15 },
    { slug: 'docs-signed', min: 3, max: 40 }, { slug: 'avg-turnaround', min: 1, max: 14 },
    { slug: 'docs-expired', min: 0, max: 8 }, { slug: 'renewal-rate', min: 60, max: 95 },
    { slug: 'auto-generated', min: 2, max: 30 }, { slug: 'compliance-score', min: 70, max: 100 },
    { slug: 'storage-cost', min: 100, max: 2000 }, { slug: 'processing-cost', min: 200, max: 3000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of (memberIdsByDimSlug['department'] ?? [])) {
      for (const cat of (memberIdsByDimSlug['doc-category'] ?? [])) {
        for (const st of (memberIdsByDimSlug['status'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dept.id, 'doc-category': cat.id, status: st.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Social Screening & Integrity (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedSocialScreening(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Legal'] },
    { name: 'Check Type', slug: 'check-type', members: ['Criminal Record', 'Credit Check', 'Qualification Verify', 'Reference Check', 'Social Media Scan', 'ID Verification', 'Drug Test'] },
    { name: 'Risk Level', slug: 'risk-level', members: ['Low', 'Medium', 'High', 'Critical'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Checks Initiated', slug: 'checks-initiated', formula: null as string | null, formatType: 'number' },
    { name: 'Checks Completed', slug: 'checks-completed', formula: null as string | null, formatType: 'number' },
    { name: 'Check Completion Rate', slug: 'check-completion-rate', formula: 'Checks Completed / Checks Initiated * 100', formatType: 'percentage' },
    { name: 'Clear Results', slug: 'clear-results', formula: null as string | null, formatType: 'number' },
    { name: 'Flagged Results', slug: 'flagged-results', formula: null as string | null, formatType: 'number' },
    { name: 'Flag Rate', slug: 'flag-rate', formula: 'Flagged Results / Checks Completed * 100', formatType: 'percentage' },
    { name: 'Avg Processing Time (days)', slug: 'avg-processing-time', formula: null as string | null, formatType: 'number' },
    { name: 'Escalations', slug: 'escalations', formula: null as string | null, formatType: 'number' },
    { name: 'False Positives', slug: 'false-positives', formula: null as string | null, formatType: 'number' },
    { name: 'Accuracy Rate', slug: 'accuracy-rate', formula: '(Checks Completed - False Positives) / Checks Completed * 100', formatType: 'percentage' },
    { name: 'Cost Per Check', slug: 'cost-per-check', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Screening Cost', slug: 'total-screening-cost', formula: 'Checks Completed * Cost Per Check', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Plan 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Checks Done', 0, 0, 3, 2, { blockSlug: 'checks-completed', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Flag Rate', 3, 0, 3, 2, { blockSlug: 'flag-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Accuracy', 6, 0, 3, 2, { blockSlug: 'accuracy-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Screening Cost', 9, 0, 3, 2, { blockSlug: 'total-screening-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Checks by Type', 0, 2, 6, 4, { blockSlug: 'checks-completed', dimensionSlug: 'check-type', chartType: 'bar' }),
    widget('chart', 'Flags by Risk Level', 6, 2, 6, 4, { blockSlug: 'flagged-results', dimensionSlug: 'risk-level', chartType: 'bar' }),
    widget('grid', 'Screening Metrics', 0, 6, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Screening Dashboard', slug: 'screening-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'checks-initiated', min: 5, max: 30 }, { slug: 'checks-completed', min: 4, max: 28 },
    { slug: 'clear-results', min: 3, max: 25 }, { slug: 'flagged-results', min: 0, max: 5 },
    { slug: 'avg-processing-time', min: 1, max: 10 }, { slug: 'escalations', min: 0, max: 3 },
    { slug: 'false-positives', min: 0, max: 2 }, { slug: 'cost-per-check', min: 50, max: 500 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of (memberIdsByDimSlug['department'] ?? [])) {
      for (const ct of (memberIdsByDimSlug['check-type'] ?? [])) {
        for (const rl of (memberIdsByDimSlug['risk-level'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dept.id, 'check-type': ct.id, 'risk-level': rl.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Workforce Intelligence (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedWorkforceIntelligence(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Customer Success'] },
    { name: 'Tenure Band', slug: 'tenure-band', members: ['< 1 year', '1-2 years', '3-5 years', '5-10 years', '10+ years'] },
    { name: 'Age Group', slug: 'age-group', members: ['18-25', '26-35', '36-45', '46-55', '55+'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Total Employees', slug: 'total-employees', formula: null as string | null, formatType: 'number' },
    { name: 'FTE Count', slug: 'fte-count', formula: null as string | null, formatType: 'number' },
    { name: 'Contractor Count', slug: 'contractor-count', formula: null as string | null, formatType: 'number' },
    { name: 'Attrition Count', slug: 'attrition-count', formula: null as string | null, formatType: 'number' },
    { name: 'Attrition Rate', slug: 'attrition-rate', formula: 'Attrition Count / Total Employees * 100', formatType: 'percentage' },
    { name: 'Avg Tenure (years)', slug: 'avg-tenure', formula: null as string | null, formatType: 'number' },
    { name: 'Diversity %', slug: 'diversity-pct', formula: null as string | null, formatType: 'percentage' },
    { name: 'Gender Ratio %', slug: 'gender-ratio', formula: null as string | null, formatType: 'percentage' },
    { name: 'Engagement Score', slug: 'engagement-score', formula: null as string | null, formatType: 'number' },
    { name: 'eNPS', slug: 'enps', formula: null as string | null, formatType: 'number' },
    { name: 'Absenteeism Rate', slug: 'absenteeism-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Revenue Per Employee', slug: 'revenue-per-employee', formula: null as string | null, formatType: 'currency' },
    { name: 'Total People Cost', slug: 'total-people-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'People Cost Ratio', slug: 'people-cost-ratio', formula: 'Total People Cost / Revenue Per Employee * 100', formatType: 'percentage' },
    { name: 'Span of Control', slug: 'span-of-control', formula: null as string | null, formatType: 'number' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Current Year', versionType: 'actuals' as const, isLocked: 0 },
    { applicationId: appId, name: 'Prior Year', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Employees', 0, 0, 3, 2, { blockSlug: 'total-employees', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Attrition Rate', 3, 0, 3, 2, { blockSlug: 'attrition-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Engagement', 6, 0, 3, 2, { blockSlug: 'engagement-score', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'eNPS', 9, 0, 3, 2, { blockSlug: 'enps', format: 'number', value: 0, previousValue: 0 }),
    widget('chart', 'Headcount by Department', 0, 2, 6, 4, { blockSlug: 'total-employees', dimensionSlug: 'department', chartType: 'bar' }),
    widget('chart', 'Tenure Distribution', 6, 2, 6, 4, { blockSlug: 'total-employees', dimensionSlug: 'tenure-band', chartType: 'bar' }),
    widget('chart', 'Age Demographics', 0, 6, 6, 4, { blockSlug: 'total-employees', dimensionSlug: 'age-group', chartType: 'bar' }),
    widget('grid', 'Workforce Intelligence', 0, 10, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Executive HR Dashboard', slug: 'executive-hr-dashboard', layout, sortOrder: 0 });

  const currentVersion = insertedVersions[0]!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'total-employees', min: 5, max: 60 }, { slug: 'fte-count', min: 4, max: 50 },
    { slug: 'contractor-count', min: 0, max: 10 }, { slug: 'attrition-count', min: 0, max: 5 },
    { slug: 'avg-tenure', min: 1, max: 12 }, { slug: 'diversity-pct', min: 20, max: 60 },
    { slug: 'gender-ratio', min: 30, max: 70 }, { slug: 'engagement-score', min: 50, max: 95 },
    { slug: 'enps', min: -10, max: 80 }, { slug: 'absenteeism-rate', min: 1, max: 8 },
    { slug: 'revenue-per-employee', min: 30000, max: 150000 }, { slug: 'total-people-cost', min: 20000, max: 80000 },
    { slug: 'span-of-control', min: 3, max: 12 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of (memberIdsByDimSlug['department'] ?? [])) {
      for (const tb of (memberIdsByDimSlug['tenure-band'] ?? [])) {
        for (const ag of (memberIdsByDimSlug['age-group'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dept.id, 'tenure-band': tb.id, 'age-group': ag.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: currentVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Offer Management (MTN Human Capital)
// ---------------------------------------------------------------------------

async function seedOfferManagement(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Customer Success'] },
    { name: 'Job Level', slug: 'job-level', members: ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director'] },
    { name: 'Offer Status', slug: 'offer-status', members: ['Draft', 'Sent', 'Accepted', 'Declined', 'Negotiating', 'Expired'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Offers Created', slug: 'offers-created', formula: null as string | null, formatType: 'number' },
    { name: 'Offers Sent', slug: 'offers-sent', formula: null as string | null, formatType: 'number' },
    { name: 'Offers Accepted', slug: 'offers-accepted', formula: null as string | null, formatType: 'number' },
    { name: 'Offers Declined', slug: 'offers-declined', formula: null as string | null, formatType: 'number' },
    { name: 'Acceptance Rate', slug: 'acceptance-rate', formula: 'Offers Accepted / Offers Sent * 100', formatType: 'percentage' },
    { name: 'Avg Offer Amount', slug: 'avg-offer-amount', formula: null as string | null, formatType: 'currency' },
    { name: 'Avg Negotiation Delta', slug: 'avg-negotiation-delta', formula: null as string | null, formatType: 'currency' },
    { name: 'Time to Accept (days)', slug: 'time-to-accept', formula: null as string | null, formatType: 'number' },
    { name: 'Reneged Offers', slug: 'reneged-offers', formula: null as string | null, formatType: 'number' },
    { name: 'Renege Rate', slug: 'renege-rate', formula: 'Reneged Offers / Offers Accepted * 100', formatType: 'percentage' },
    { name: 'Total Offer Value', slug: 'total-offer-value', formula: 'Offers Accepted * Avg Offer Amount', formatType: 'currency' },
    { name: 'Signing Bonus Paid', slug: 'signing-bonus', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Acquisition Cost', slug: 'total-acquisition-cost', formula: 'Total Offer Value + Signing Bonus Paid', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Offers Sent', 0, 0, 3, 2, { blockSlug: 'offers-sent', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Acceptance Rate', 3, 0, 3, 2, { blockSlug: 'acceptance-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Offer', 6, 0, 3, 2, { blockSlug: 'avg-offer-amount', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Time to Accept', 9, 0, 3, 2, { blockSlug: 'time-to-accept', format: 'number', value: 0, previousValue: 0 }),
    widget('chart', 'Offers by Department', 0, 2, 6, 4, { blockSlug: 'offers-sent', dimensionSlug: 'department', chartType: 'bar' }),
    widget('chart', 'Offers by Status', 6, 2, 6, 4, { blockSlug: 'offers-created', dimensionSlug: 'offer-status', chartType: 'bar' }),
    widget('grid', 'Offer Metrics', 0, 6, 12, 6, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Offer Dashboard', slug: 'offer-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'offers-created', min: 2, max: 15 }, { slug: 'offers-sent', min: 2, max: 12 },
    { slug: 'offers-accepted', min: 1, max: 10 }, { slug: 'offers-declined', min: 0, max: 4 },
    { slug: 'avg-offer-amount', min: 15000, max: 60000 }, { slug: 'avg-negotiation-delta', min: 0, max: 8000 },
    { slug: 'time-to-accept', min: 2, max: 14 }, { slug: 'reneged-offers', min: 0, max: 2 },
    { slug: 'signing-bonus', min: 0, max: 10000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dept of (memberIdsByDimSlug['department'] ?? [])) {
      for (const jl of (memberIdsByDimSlug['job-level'] ?? [])) {
        for (const os of (memberIdsByDimSlug['offer-status'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dept.id, 'job-level': jl.id, 'offer-status': os.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Parts Inventory
// ---------------------------------------------------------------------------

async function seedPartsInventory(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Part Category', slug: 'part-category', members: ['Engine', 'Brakes', 'Electrical', 'Suspension', 'Body', 'Filters'] },
    { name: 'Supplier', slug: 'supplier', members: ['OEM Direct', 'AutoZone', 'Midas', 'Local Supplier', 'Workshop Stock'] },
    { name: 'Priority', slug: 'priority', members: ['Critical', 'High', 'Medium', 'Low'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Opening Stock', slug: 'opening-stock', formula: null as string | null, formatType: 'number' },
    { name: 'Parts Purchased', slug: 'parts-purchased', formula: null as string | null, formatType: 'number' },
    { name: 'Purchase Cost', slug: 'purchase-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Parts Used', slug: 'parts-used', formula: null as string | null, formatType: 'number' },
    { name: 'Usage Cost', slug: 'usage-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Closing Stock', slug: 'closing-stock', formula: 'Opening Stock + Parts Purchased - Parts Used', formatType: 'number' },
    { name: 'Stock Value', slug: 'stock-value', formula: null as string | null, formatType: 'currency' },
    { name: 'Reorder Level', slug: 'reorder-level', formula: null as string | null, formatType: 'number' },
    { name: 'Below Reorder Count', slug: 'below-reorder-count', formula: null as string | null, formatType: 'number' },
    { name: 'Stock Turnover Rate', slug: 'stock-turnover-rate', formula: 'Parts Used / ((Opening Stock + Closing Stock) / 2)', formatType: 'number' },
    { name: 'Avg Cost Per Part', slug: 'avg-cost-per-part', formula: 'Purchase Cost / Parts Purchased', formatType: 'currency' },
    { name: 'Waste / Damaged', slug: 'waste-damaged', formula: null as string | null, formatType: 'number' },
    { name: 'Waste Rate', slug: 'waste-rate', formula: 'Waste / Damaged / Parts Used * 100', formatType: 'percentage' },
    { name: 'Total Inventory Cost', slug: 'total-inventory-cost', formula: 'Purchase Cost + Usage Cost', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Inventory Cost', 0, 0, 3, 2, { blockSlug: 'total-inventory-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Stock Turnover Rate', 3, 0, 3, 2, { blockSlug: 'stock-turnover-rate', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Below Reorder Count', 6, 0, 3, 2, { blockSlug: 'below-reorder-count', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Waste Rate', 9, 0, 3, 2, { blockSlug: 'waste-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('chart', 'Purchase Cost by Part Category', 0, 2, 6, 4, { blockSlug: 'purchase-cost', dimensionSlug: 'part-category', chartType: 'bar' }),
    widget('chart', 'Parts Used by Month', 6, 2, 6, 4, { blockSlug: 'parts-used', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Parts Inventory', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Parts Dashboard', slug: 'parts-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'opening-stock', min: 10, max: 500 }, { slug: 'parts-purchased', min: 5, max: 200 },
    { slug: 'purchase-cost', min: 500, max: 50000 }, { slug: 'parts-used', min: 3, max: 180 },
    { slug: 'usage-cost', min: 300, max: 40000 }, { slug: 'stock-value', min: 1000, max: 100000 },
    { slug: 'reorder-level', min: 5, max: 100 }, { slug: 'below-reorder-count', min: 0, max: 20 },
    { slug: 'waste-damaged', min: 0, max: 15 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const pc of (memberIdsByDimSlug['part-category'] ?? [])) {
      for (const sup of (memberIdsByDimSlug['supplier'] ?? [])) {
        for (const pri of (memberIdsByDimSlug['priority'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'part-category': pc.id, supplier: sup.id, priority: pri.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Repairs & Maintenance
// ---------------------------------------------------------------------------

async function seedRepairsMaintenance(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Repair Type', slug: 'repair-type', members: ['Engine', 'Transmission', 'Brakes', 'Electrical', 'Bodywork', 'Scheduled Service'] },
    { name: 'Vehicle Class', slug: 'vehicle-class', members: ['Heavy Truck', 'Medium Truck', 'Light Commercial', 'Bus', 'Trailer'] },
    { name: 'Vendor', slug: 'vendor', members: ['In-House', 'Dealer Workshop', 'Independent Garage', 'Mobile Service', 'Specialist'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Repairs Logged', slug: 'repairs-logged', formula: null as string | null, formatType: 'number' },
    { name: 'Parts Cost', slug: 'parts-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Labour Cost', slug: 'labour-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Repair Cost', slug: 'total-repair-cost', formula: 'Parts Cost + Labour Cost', formatType: 'currency' },
    { name: 'Avg Repair Cost', slug: 'avg-repair-cost', formula: 'Total Repair Cost / Repairs Logged', formatType: 'currency' },
    { name: 'Downtime Days', slug: 'downtime-days', formula: null as string | null, formatType: 'number' },
    { name: 'Avg Downtime Per Repair', slug: 'avg-downtime-per-repair', formula: 'Downtime Days / Repairs Logged', formatType: 'number' },
    { name: 'Scheduled Services', slug: 'scheduled-services', formula: null as string | null, formatType: 'number' },
    { name: 'Unscheduled Breakdowns', slug: 'unscheduled-breakdowns', formula: null as string | null, formatType: 'number' },
    { name: 'Breakdown Rate', slug: 'breakdown-rate', formula: 'Unscheduled Breakdowns / (Scheduled Services + Unscheduled Breakdowns) * 100', formatType: 'percentage' },
    { name: 'Warranty Claims', slug: 'warranty-claims', formula: null as string | null, formatType: 'number' },
    { name: 'Warranty Recovery', slug: 'warranty-recovery', formula: null as string | null, formatType: 'currency' },
    { name: 'Net Maintenance Cost', slug: 'net-maintenance-cost', formula: 'Total Repair Cost - Warranty Recovery', formatType: 'currency' },
    { name: 'Cost Per Vehicle', slug: 'cost-per-vehicle', formula: null as string | null, formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Net Maintenance Cost', 0, 0, 3, 2, { blockSlug: 'net-maintenance-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Repair Cost', 3, 0, 3, 2, { blockSlug: 'avg-repair-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Breakdown Rate', 6, 0, 3, 2, { blockSlug: 'breakdown-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Downtime Per Repair', 9, 0, 3, 2, { blockSlug: 'avg-downtime-per-repair', format: 'number', value: 0, previousValue: 0 }),
    widget('chart', 'Total Repair Cost by Repair Type', 0, 2, 6, 4, { blockSlug: 'total-repair-cost', dimensionSlug: 'repair-type', chartType: 'bar' }),
    widget('chart', 'Repairs Logged by Quarter', 6, 2, 6, 4, { blockSlug: 'repairs-logged', dimensionSlug: 'quarter', chartType: 'line' }),
    widget('grid', 'Repairs & Maintenance', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Repairs Dashboard', slug: 'repairs-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'repairs-logged', min: 1, max: 30 }, { slug: 'parts-cost', min: 500, max: 50000 },
    { slug: 'labour-cost', min: 300, max: 30000 }, { slug: 'downtime-days', min: 0, max: 15 },
    { slug: 'scheduled-services', min: 1, max: 20 }, { slug: 'unscheduled-breakdowns', min: 0, max: 10 },
    { slug: 'warranty-claims', min: 0, max: 5 }, { slug: 'warranty-recovery', min: 0, max: 20000 },
    { slug: 'cost-per-vehicle', min: 1000, max: 25000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const rt of (memberIdsByDimSlug['repair-type'] ?? [])) {
      for (const vc of (memberIdsByDimSlug['vehicle-class'] ?? [])) {
        for (const vn of (memberIdsByDimSlug['vendor'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'repair-type': rt.id, 'vehicle-class': vc.id, vendor: vn.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Fuel Management
// ---------------------------------------------------------------------------

async function seedFuelManagement(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Fuel Type', slug: 'fuel-type', members: ['Diesel', 'Petrol', 'AdBlue', 'LPG'] },
    { name: 'Vehicle Category', slug: 'vehicle-category', members: ['Trucks', 'Rigid', 'Light Commercial', 'Buses', 'Equipment'] },
    { name: 'Supplier', slug: 'supplier', members: ['Engen', 'Shell', 'BP', 'Caltex', 'Internal Tank'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Fuel Purchased (L)', slug: 'fuel-purchased', formula: null as string | null, formatType: 'number' },
    { name: 'Purchase Cost', slug: 'purchase-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Average Price Per Litre', slug: 'avg-price-per-litre', formula: 'Purchase Cost / Fuel Purchased (L)', formatType: 'currency' },
    { name: 'Fuel Delivered (L)', slug: 'fuel-delivered', formula: null as string | null, formatType: 'number' },
    { name: 'Delivery Cost', slug: 'delivery-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Delivery Variance (L)', slug: 'delivery-variance', formula: 'Fuel Delivered (L) - Fuel Purchased (L)', formatType: 'number' },
    { name: 'Fuel Consumed (L)', slug: 'fuel-consumed', formula: null as string | null, formatType: 'number' },
    { name: 'Tank Stock Level (L)', slug: 'tank-stock-level', formula: null as string | null, formatType: 'number' },
    { name: 'Distance Covered (km)', slug: 'distance-covered', formula: null as string | null, formatType: 'number' },
    { name: 'Fuel Efficiency (km/L)', slug: 'fuel-efficiency', formula: 'Distance Covered (km) / Fuel Consumed (L)', formatType: 'number' },
    { name: 'Cost Per Km', slug: 'cost-per-km', formula: 'Purchase Cost / Distance Covered (km)', formatType: 'currency' },
    { name: 'Monthly Fuel Budget', slug: 'monthly-fuel-budget', formula: null as string | null, formatType: 'currency' },
    { name: 'Budget Variance', slug: 'budget-variance', formula: 'Monthly Fuel Budget - Purchase Cost', formatType: 'currency' },
    { name: 'Total Fleet Fuel Cost', slug: 'total-fleet-fuel-cost', formula: 'Purchase Cost + Delivery Cost', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Fleet Fuel Cost', 0, 0, 3, 2, { blockSlug: 'total-fleet-fuel-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Fuel Efficiency (km/L)', 3, 0, 3, 2, { blockSlug: 'fuel-efficiency', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Cost Per Km', 6, 0, 3, 2, { blockSlug: 'cost-per-km', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Budget Variance', 9, 0, 3, 2, { blockSlug: 'budget-variance', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Purchase Cost by Supplier', 0, 2, 6, 4, { blockSlug: 'purchase-cost', dimensionSlug: 'supplier', chartType: 'bar' }),
    widget('chart', 'Fuel Consumed (L) by Month', 6, 2, 6, 4, { blockSlug: 'fuel-consumed', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Fuel Operations', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Fuel Dashboard', slug: 'fuel-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'fuel-purchased', min: 500, max: 10000 },
    { slug: 'purchase-cost', min: 5000, max: 200000 },
    { slug: 'fuel-delivered', min: 500, max: 10000 },
    { slug: 'delivery-cost', min: 500, max: 5000 },
    { slug: 'fuel-consumed', min: 400, max: 9000 },
    { slug: 'tank-stock-level', min: 100, max: 5000 },
    { slug: 'distance-covered', min: 1000, max: 50000 },
    { slug: 'monthly-fuel-budget', min: 10000, max: 250000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const ft of (memberIdsByDimSlug['fuel-type'] ?? [])) {
      for (const vc of (memberIdsByDimSlug['vehicle-category'] ?? [])) {
        for (const sp of (memberIdsByDimSlug['supplier'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'fuel-type': ft.id, 'vehicle-category': vc.id, supplier: sp.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Tyre Lifecycle
// ---------------------------------------------------------------------------

async function seedTyreLifecycle(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Tyre Brand', slug: 'tyre-brand', members: ['Bridgestone', 'Michelin', 'Goodyear', 'Continental', 'Dunlop'] },
    { name: 'Position', slug: 'position', members: ['Front Left', 'Front Right', 'Rear Left Outer', 'Rear Left Inner', 'Rear Right Outer', 'Rear Right Inner'] },
    { name: 'Condition', slug: 'condition', members: ['New', 'Good', 'Fair', 'Replace'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Tyres In Stock', slug: 'tyres-in-stock', formula: null as string | null, formatType: 'number' },
    { name: 'Tyres Purchased', slug: 'tyres-purchased', formula: null as string | null, formatType: 'number' },
    { name: 'Purchase Cost', slug: 'purchase-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Avg Cost Per Tyre', slug: 'avg-cost-per-tyre', formula: 'Purchase Cost / Tyres Purchased', formatType: 'currency' },
    { name: 'Tyres Fitted', slug: 'tyres-fitted', formula: null as string | null, formatType: 'number' },
    { name: 'Tyres Removed', slug: 'tyres-removed', formula: null as string | null, formatType: 'number' },
    { name: 'Tread Depth (mm)', slug: 'tread-depth', formula: null as string | null, formatType: 'number' },
    { name: 'Retread Count', slug: 'retread-count', formula: null as string | null, formatType: 'number' },
    { name: 'Tyres Scrapped', slug: 'tyres-scrapped', formula: null as string | null, formatType: 'number' },
    { name: 'Scrap Rate', slug: 'scrap-rate', formula: 'Tyres Scrapped / Tyres Removed * 100', formatType: 'percentage' },
    { name: 'Distance Per Tyre (km)', slug: 'distance-per-tyre', formula: null as string | null, formatType: 'number' },
    { name: 'Cost Per Km', slug: 'cost-per-km', formula: 'Purchase Cost / Distance Per Tyre (km)', formatType: 'currency' },
    { name: 'Total Tyre Spend', slug: 'total-tyre-spend', formula: 'Purchase Cost', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Tyre Spend', 0, 0, 3, 2, { blockSlug: 'total-tyre-spend', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Cost Per Tyre', 3, 0, 3, 2, { blockSlug: 'avg-cost-per-tyre', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Scrap Rate', 6, 0, 3, 2, { blockSlug: 'scrap-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Cost Per Km', 9, 0, 3, 2, { blockSlug: 'cost-per-km', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Purchase Cost by Tyre Brand', 0, 2, 6, 4, { blockSlug: 'purchase-cost', dimensionSlug: 'tyre-brand', chartType: 'bar' }),
    widget('chart', 'Tread Depth (mm) by Quarter', 6, 2, 6, 4, { blockSlug: 'tread-depth', dimensionSlug: 'quarter', chartType: 'line' }),
    widget('grid', 'Tyre Operations', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Tyre Dashboard', slug: 'tyre-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'tyres-in-stock', min: 10, max: 200 },
    { slug: 'tyres-purchased', min: 5, max: 100 },
    { slug: 'purchase-cost', min: 5000, max: 150000 },
    { slug: 'tyres-fitted', min: 5, max: 80 },
    { slug: 'tyres-removed', min: 3, max: 60 },
    { slug: 'tread-depth', min: 2, max: 12 },
    { slug: 'retread-count', min: 0, max: 30 },
    { slug: 'tyres-scrapped', min: 0, max: 20 },
    { slug: 'distance-per-tyre', min: 10000, max: 80000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const tb of (memberIdsByDimSlug['tyre-brand'] ?? [])) {
      for (const pos of (memberIdsByDimSlug['position'] ?? [])) {
        for (const cond of (memberIdsByDimSlug['condition'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'tyre-brand': tb.id, position: pos.id, condition: cond.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Route Performance
// ---------------------------------------------------------------------------

async function seedRoutePerformance(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Route', slug: 'route', members: ['JHB-CPT', 'JHB-DBN', 'CPT-PE', 'DBN-BFN', 'JHB-MBG', 'CPT-GRJ'] },
    { name: 'Vehicle Type', slug: 'vehicle-type', members: ['34-Ton', 'Interlink', 'Rigid 8-Ton', 'Light Delivery'] },
    { name: 'Load Type', slug: 'load-type', members: ['Full Load', 'Part Load', 'Groupage', 'Hazmat', 'Refrigerated'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Trips Completed', slug: 'trips-completed', formula: null as string | null, formatType: 'number' },
    { name: 'Total Distance (km)', slug: 'total-distance', formula: null as string | null, formatType: 'number' },
    { name: 'Avg Trip Distance (km)', slug: 'avg-trip-distance', formula: 'Total Distance (km) / Trips Completed', formatType: 'number' },
    { name: 'Total Loads (tons)', slug: 'total-loads-tons', formula: null as string | null, formatType: 'number' },
    { name: 'Avg Load Weight (tons)', slug: 'avg-load-weight', formula: 'Total Loads (tons) / Trips Completed', formatType: 'number' },
    { name: 'Revenue Per Trip', slug: 'revenue-per-trip', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Revenue', slug: 'total-revenue', formula: 'Revenue Per Trip * Trips Completed', formatType: 'currency' },
    { name: 'Fuel Used (L)', slug: 'fuel-used', formula: null as string | null, formatType: 'number' },
    { name: 'Fuel Cost', slug: 'fuel-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Fuel Efficiency (km/L)', slug: 'fuel-efficiency', formula: 'Total Distance (km) / Fuel Used (L)', formatType: 'number' },
    { name: 'Toll Costs', slug: 'toll-costs', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Route Cost', slug: 'total-route-cost', formula: 'Fuel Cost + Toll Costs', formatType: 'currency' },
    { name: 'Profit Per Trip', slug: 'profit-per-trip', formula: 'Revenue Per Trip - (Total Route Cost / Trips Completed)', formatType: 'currency' },
    { name: 'On-Time Delivery Rate', slug: 'on-time-delivery-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Route Utilization', slug: 'route-utilization', formula: null as string | null, formatType: 'percentage' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Revenue', 0, 0, 3, 2, { blockSlug: 'total-revenue', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Fuel Efficiency (km/L)', 3, 0, 3, 2, { blockSlug: 'fuel-efficiency', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Profit Per Trip', 6, 0, 3, 2, { blockSlug: 'profit-per-trip', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'On-Time Delivery Rate', 9, 0, 3, 2, { blockSlug: 'on-time-delivery-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('chart', 'Total Revenue by Route', 0, 2, 6, 4, { blockSlug: 'total-revenue', dimensionSlug: 'route', chartType: 'bar' }),
    widget('chart', 'Trips Completed by Month', 6, 2, 6, 4, { blockSlug: 'trips-completed', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Route Performance', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Route Performance Dashboard', slug: 'route-performance-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'trips-completed', min: 5, max: 80 },
    { slug: 'total-distance', min: 200, max: 18000 },
    { slug: 'total-loads-tons', min: 10, max: 500 },
    { slug: 'revenue-per-trip', min: 3000, max: 25000 },
    { slug: 'fuel-used', min: 50, max: 5000 },
    { slug: 'fuel-cost', min: 1000, max: 100000 },
    { slug: 'toll-costs', min: 200, max: 5000 },
    { slug: 'on-time-delivery-rate', min: 70, max: 99 },
    { slug: 'route-utilization', min: 50, max: 95 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const rt of (memberIdsByDimSlug['route'] ?? [])) {
      for (const vt of (memberIdsByDimSlug['vehicle-type'] ?? [])) {
        for (const lt of (memberIdsByDimSlug['load-type'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { route: rt.id, 'vehicle-type': vt.id, 'load-type': lt.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Weighbridge Operations
// ---------------------------------------------------------------------------

async function seedWeighbridgeOps(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Weighbridge Station', slug: 'weighbridge-station', members: ['Depot North', 'Depot South', 'Client Site A', 'Client Site B', 'Highway Station'] },
    { name: 'Load Status', slug: 'load-status', members: ['Within Limit', 'Marginal', 'Overloaded', 'Empty'] },
    { name: 'Vehicle Class', slug: 'vehicle-class', members: ['34-Ton Truck', 'Interlink', 'Rigid', 'Tanker', 'Flatbed'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Weighments Recorded', slug: 'weighments-recorded', formula: null as string | null, formatType: 'number' },
    { name: 'Gross Weight (tons)', slug: 'gross-weight', formula: null as string | null, formatType: 'number' },
    { name: 'Tare Weight (tons)', slug: 'tare-weight', formula: null as string | null, formatType: 'number' },
    { name: 'Net Payload (tons)', slug: 'net-payload', formula: 'Gross Weight (tons) - Tare Weight (tons)', formatType: 'number' },
    { name: 'Avg Payload (tons)', slug: 'avg-payload', formula: 'Net Payload (tons) / Weighments Recorded', formatType: 'number' },
    { name: 'Legal Limit (tons)', slug: 'legal-limit', formula: null as string | null, formatType: 'number' },
    { name: 'Overloaded Count', slug: 'overloaded-count', formula: null as string | null, formatType: 'number' },
    { name: 'Overload Rate', slug: 'overload-rate', formula: 'Overloaded Count / Weighments Recorded * 100', formatType: 'percentage' },
    { name: 'Overload Amount (tons)', slug: 'overload-amount', formula: null as string | null, formatType: 'number' },
    { name: 'Overload Fines', slug: 'overload-fines', formula: null as string | null, formatType: 'currency' },
    { name: 'Weight Variance (tons)', slug: 'weight-variance', formula: null as string | null, formatType: 'number' },
    { name: 'Accuracy Rate', slug: 'accuracy-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Total Weighbridge Cost', slug: 'total-weighbridge-cost', formula: null as string | null, formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Weighbridge Cost', 0, 0, 3, 2, { blockSlug: 'total-weighbridge-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Payload (tons)', 3, 0, 3, 2, { blockSlug: 'avg-payload', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Overload Rate', 6, 0, 3, 2, { blockSlug: 'overload-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Accuracy Rate', 9, 0, 3, 2, { blockSlug: 'accuracy-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('chart', 'Net Payload (tons) by Weighbridge Station', 0, 2, 6, 4, { blockSlug: 'net-payload', dimensionSlug: 'weighbridge-station', chartType: 'bar' }),
    widget('chart', 'Weighments Recorded by Month', 6, 2, 6, 4, { blockSlug: 'weighments-recorded', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Weighbridge Operations', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Weighbridge Dashboard', slug: 'weighbridge-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'weighments-recorded', min: 10, max: 200 },
    { slug: 'gross-weight', min: 5, max: 40 },
    { slug: 'tare-weight', min: 3, max: 15 },
    { slug: 'legal-limit', min: 30, max: 56 },
    { slug: 'overloaded-count', min: 0, max: 20 },
    { slug: 'overload-amount', min: 0, max: 8 },
    { slug: 'overload-fines', min: 0, max: 50000 },
    { slug: 'weight-variance', min: 0, max: 5 },
    { slug: 'accuracy-rate', min: 85, max: 99 },
    { slug: 'total-weighbridge-cost', min: 5000, max: 80000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const ws of (memberIdsByDimSlug['weighbridge-station'] ?? [])) {
      for (const ls of (memberIdsByDimSlug['load-status'] ?? [])) {
        for (const vc of (memberIdsByDimSlug['vehicle-class'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'weighbridge-station': ws.id, 'load-status': ls.id, 'vehicle-class': vc.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Driver Compensation
// ---------------------------------------------------------------------------

async function seedDriverCompensation(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Driver Grade', slug: 'driver-grade', members: ['Grade A', 'Grade B', 'Grade C', 'Trainee', 'Casual'] },
    { name: 'Route Type', slug: 'route-type', members: ['Long Haul', 'Regional', 'Local', 'Cross-Border'] },
    { name: 'Deduction Type', slug: 'deduction-type', members: ['Tax', 'UIF', 'Pension', 'Medical Aid', 'Loan Repayment'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Base Salary', slug: 'base-salary', formula: null as string | null, formatType: 'currency' },
    { name: 'Overtime Hours', slug: 'overtime-hours', formula: null as string | null, formatType: 'number' },
    { name: 'Overtime Pay', slug: 'overtime-pay', formula: null as string | null, formatType: 'currency' },
    { name: 'Distance Bonus', slug: 'distance-bonus', formula: null as string | null, formatType: 'currency' },
    { name: 'Performance Bonus', slug: 'performance-bonus', formula: null as string | null, formatType: 'currency' },
    { name: 'Gross Pay', slug: 'gross-pay', formula: 'Base Salary + Overtime Pay + Distance Bonus + Performance Bonus', formatType: 'currency' },
    { name: 'Total Deductions', slug: 'total-deductions', formula: null as string | null, formatType: 'currency' },
    { name: 'Net Pay', slug: 'net-pay', formula: 'Gross Pay - Total Deductions', formatType: 'currency' },
    { name: 'Fuel Allowance', slug: 'fuel-allowance', formula: null as string | null, formatType: 'currency' },
    { name: 'Meal Allowance', slug: 'meal-allowance', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Allowances', slug: 'total-allowances', formula: 'Fuel Allowance + Meal Allowance', formatType: 'currency' },
    { name: 'Total Cost Per Driver', slug: 'total-cost-per-driver', formula: 'Gross Pay + Total Allowances', formatType: 'currency' },
    { name: 'Headcount', slug: 'headcount', formula: null as string | null, formatType: 'number' },
    { name: 'Total Payroll', slug: 'total-payroll', formula: 'Total Cost Per Driver * Headcount', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Payroll', 0, 0, 3, 2, { blockSlug: 'total-payroll', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Total Cost Per Driver', 3, 0, 3, 2, { blockSlug: 'total-cost-per-driver', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Gross Pay', 6, 0, 3, 2, { blockSlug: 'gross-pay', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Total Deductions', 9, 0, 3, 2, { blockSlug: 'total-deductions', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Gross Pay by Driver Grade', 0, 2, 6, 4, { blockSlug: 'gross-pay', dimensionSlug: 'driver-grade', chartType: 'bar' }),
    widget('chart', 'Total Payroll by Month', 6, 2, 6, 4, { blockSlug: 'total-payroll', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Driver Compensation', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Driver Compensation Dashboard', slug: 'driver-compensation-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'base-salary', min: 8000, max: 25000 }, { slug: 'overtime-hours', min: 0, max: 40 },
    { slug: 'overtime-pay', min: 0, max: 8000 }, { slug: 'distance-bonus', min: 500, max: 5000 },
    { slug: 'performance-bonus', min: 0, max: 3000 }, { slug: 'total-deductions', min: 2000, max: 8000 },
    { slug: 'fuel-allowance', min: 500, max: 3000 }, { slug: 'meal-allowance', min: 200, max: 1500 },
    { slug: 'headcount', min: 1, max: 15 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dg of (memberIdsByDimSlug['driver-grade'] ?? [])) {
      for (const rt of (memberIdsByDimSlug['route-type'] ?? [])) {
        for (const dt of (memberIdsByDimSlug['deduction-type'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'driver-grade': dg.id, 'route-type': rt.id, 'deduction-type': dt.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Fines & Compliance
// ---------------------------------------------------------------------------

async function seedFinesCompliance(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Infringement Type', slug: 'infringement-type', members: ['Speeding', 'Overloading', 'Red Light', 'Licence Disc', 'Roadworthiness', 'Other'] },
    { name: 'Region', slug: 'region', members: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State'] },
    { name: 'Severity', slug: 'severity', members: ['Critical', 'Major', 'Minor', 'Warning'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Fines Issued', slug: 'fines-issued', formula: null as string | null, formatType: 'number' },
    { name: 'Fine Amount', slug: 'fine-amount', formula: null as string | null, formatType: 'currency' },
    { name: 'Fines Paid', slug: 'fines-paid', formula: null as string | null, formatType: 'number' },
    { name: 'Amount Paid', slug: 'amount-paid', formula: null as string | null, formatType: 'currency' },
    { name: 'Outstanding Fines', slug: 'outstanding-fines', formula: 'Fines Issued - Fines Paid', formatType: 'number' },
    { name: 'Outstanding Amount', slug: 'outstanding-amount', formula: 'Fine Amount - Amount Paid', formatType: 'currency' },
    { name: 'Avg Fine Value', slug: 'avg-fine-value', formula: 'Fine Amount / Fines Issued', formatType: 'currency' },
    { name: 'Repeat Offenders', slug: 'repeat-offenders', formula: null as string | null, formatType: 'number' },
    { name: 'Repeat Rate', slug: 'repeat-rate', formula: 'Repeat Offenders / Fines Issued * 100', formatType: 'percentage' },
    { name: 'Disputed Fines', slug: 'disputed-fines', formula: null as string | null, formatType: 'number' },
    { name: 'Disputes Won', slug: 'disputes-won', formula: null as string | null, formatType: 'number' },
    { name: 'Recovery Rate', slug: 'recovery-rate', formula: 'Disputes Won / Disputed Fines * 100', formatType: 'percentage' },
    { name: 'Total Compliance Cost', slug: 'total-compliance-cost', formula: 'Amount Paid', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Compliance Cost', 0, 0, 3, 2, { blockSlug: 'total-compliance-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Outstanding Amount', 3, 0, 3, 2, { blockSlug: 'outstanding-amount', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Repeat Rate', 6, 0, 3, 2, { blockSlug: 'repeat-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Fine Value', 9, 0, 3, 2, { blockSlug: 'avg-fine-value', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Fine Amount by Infringement Type', 0, 2, 6, 4, { blockSlug: 'fine-amount', dimensionSlug: 'infringement-type', chartType: 'bar' }),
    widget('chart', 'Fines Issued by Quarter', 6, 2, 6, 4, { blockSlug: 'fines-issued', dimensionSlug: 'quarter', chartType: 'line' }),
    widget('grid', 'Fines & Compliance', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Fines & Compliance Dashboard', slug: 'fines-compliance-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'fines-issued', min: 1, max: 30 }, { slug: 'fine-amount', min: 500, max: 25000 },
    { slug: 'fines-paid', min: 0, max: 25 }, { slug: 'amount-paid', min: 300, max: 20000 },
    { slug: 'repeat-offenders', min: 0, max: 10 }, { slug: 'disputed-fines', min: 0, max: 8 },
    { slug: 'disputes-won', min: 0, max: 5 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const it of (memberIdsByDimSlug['infringement-type'] ?? [])) {
      for (const rg of (memberIdsByDimSlug['region'] ?? [])) {
        for (const sv of (memberIdsByDimSlug['severity'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'infringement-type': it.id, region: rg.id, severity: sv.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Leave Management
// ---------------------------------------------------------------------------

async function seedLeaveManagement(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Finance', 'Sales', 'Operations', 'Marketing', 'HR'] },
    { name: 'Leave Type', slug: 'leave-type', members: ['Annual', 'Sick', 'Family Responsibility', 'Maternity', 'Study', 'Unpaid'] },
    { name: 'Employee Level', slug: 'employee-level', members: ['Executive', 'Manager', 'Senior', 'Junior'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Leave Entitlement (days)', slug: 'leave-entitlement', formula: null as string | null, formatType: 'number' },
    { name: 'Leave Taken (days)', slug: 'leave-taken', formula: null as string | null, formatType: 'number' },
    { name: 'Leave Balance (days)', slug: 'leave-balance', formula: 'Leave Entitlement (days) - Leave Taken (days)', formatType: 'number' },
    { name: 'Leave Utilization Rate', slug: 'leave-utilization-rate', formula: 'Leave Taken (days) / Leave Entitlement (days) * 100', formatType: 'percentage' },
    { name: 'Pending Requests', slug: 'pending-requests', formula: null as string | null, formatType: 'number' },
    { name: 'Approved Requests', slug: 'approved-requests', formula: null as string | null, formatType: 'number' },
    { name: 'Declined Requests', slug: 'declined-requests', formula: null as string | null, formatType: 'number' },
    { name: 'Approval Rate', slug: 'approval-rate', formula: 'Approved Requests / (Approved Requests + Declined Requests) * 100', formatType: 'percentage' },
    { name: 'Unplanned Absence Days', slug: 'unplanned-absence-days', formula: null as string | null, formatType: 'number' },
    { name: 'Absenteeism Rate', slug: 'absenteeism-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Leave Cost Impact', slug: 'leave-cost-impact', formula: null as string | null, formatType: 'currency' },
    { name: 'Avg Days Per Employee', slug: 'avg-days-per-employee', formula: 'Leave Taken (days) / Approved Requests', formatType: 'number' },
    { name: 'Carryover Days', slug: 'carryover-days', formula: null as string | null, formatType: 'number' },
    { name: 'Total Leave Liability', slug: 'total-leave-liability', formula: 'Leave Balance (days) * (Leave Cost Impact / Leave Taken (days))', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Leave Utilization Rate', 0, 0, 3, 2, { blockSlug: 'leave-utilization-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Absenteeism Rate', 3, 0, 3, 2, { blockSlug: 'absenteeism-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Leave Balance (days)', 6, 0, 3, 2, { blockSlug: 'leave-balance', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Total Leave Liability', 9, 0, 3, 2, { blockSlug: 'total-leave-liability', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Leave Taken by Department', 0, 2, 6, 4, { blockSlug: 'leave-taken', dimensionSlug: 'department', chartType: 'bar' }),
    widget('chart', 'Leave Cost Impact by Month', 6, 2, 6, 4, { blockSlug: 'leave-cost-impact', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Leave Management', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Leave Management Dashboard', slug: 'leave-management-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'leave-entitlement', min: 5, max: 30 }, { slug: 'leave-taken', min: 0, max: 25 },
    { slug: 'pending-requests', min: 0, max: 10 }, { slug: 'approved-requests', min: 1, max: 20 },
    { slug: 'declined-requests', min: 0, max: 5 }, { slug: 'unplanned-absence-days', min: 0, max: 8 },
    { slug: 'absenteeism-rate', min: 1, max: 15 }, { slug: 'leave-cost-impact', min: 500, max: 15000 },
    { slug: 'carryover-days', min: 0, max: 10 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dp of (memberIdsByDimSlug['department'] ?? [])) {
      for (const lt of (memberIdsByDimSlug['leave-type'] ?? [])) {
        for (const el of (memberIdsByDimSlug['employee-level'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dp.id, 'leave-type': lt.id, 'employee-level': el.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Compliance & Risk
// ---------------------------------------------------------------------------

async function seedComplianceRisk(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Regulation', slug: 'regulation', members: ['BCEA', 'LRA', 'EEA', 'OHSA', 'POPIA'] },
    { name: 'Department', slug: 'department', members: ['Engineering', 'Finance', 'Sales', 'Operations', 'Marketing', 'HR'] },
    { name: 'Risk Level', slug: 'risk-level', members: ['Critical', 'High', 'Medium', 'Low'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Total Violations', slug: 'total-violations', formula: null as string | null, formatType: 'number' },
    { name: 'Violations Resolved', slug: 'violations-resolved', formula: null as string | null, formatType: 'number' },
    { name: 'Resolution Rate', slug: 'resolution-rate', formula: 'Violations Resolved / Total Violations * 100', formatType: 'percentage' },
    { name: 'Open Findings', slug: 'open-findings', formula: null as string | null, formatType: 'number' },
    { name: 'Avg Resolution Days', slug: 'avg-resolution-days', formula: null as string | null, formatType: 'number' },
    { name: 'POPIA Consent Rate', slug: 'popia-consent-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Audit Readiness Score', slug: 'audit-readiness-score', formula: null as string | null, formatType: 'percentage' },
    { name: 'Compliance Training Completed', slug: 'compliance-training-completed', formula: null as string | null, formatType: 'number' },
    { name: 'Training Completion Rate', slug: 'training-completion-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Legal Costs', slug: 'legal-costs', formula: null as string | null, formatType: 'currency' },
    { name: 'Penalty Fines', slug: 'penalty-fines', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Compliance Cost', slug: 'total-compliance-cost', formula: 'Legal Costs + Penalty Fines', formatType: 'currency' },
    { name: 'Risk Score', slug: 'risk-score', formula: null as string | null, formatType: 'number' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Resolution Rate', 0, 0, 3, 2, { blockSlug: 'resolution-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'POPIA Consent Rate', 3, 0, 3, 2, { blockSlug: 'popia-consent-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Audit Readiness Score', 6, 0, 3, 2, { blockSlug: 'audit-readiness-score', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Total Compliance Cost', 9, 0, 3, 2, { blockSlug: 'total-compliance-cost', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Total Violations by Regulation', 0, 2, 6, 4, { blockSlug: 'total-violations', dimensionSlug: 'regulation', chartType: 'bar' }),
    widget('chart', 'Legal Costs by Quarter', 6, 2, 6, 4, { blockSlug: 'legal-costs', dimensionSlug: 'quarter', chartType: 'line' }),
    widget('grid', 'Compliance & Risk', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Compliance & Risk Dashboard', slug: 'compliance-risk-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'total-violations', min: 0, max: 20 }, { slug: 'violations-resolved', min: 0, max: 18 },
    { slug: 'open-findings', min: 0, max: 15 }, { slug: 'avg-resolution-days', min: 1, max: 60 },
    { slug: 'popia-consent-rate', min: 60, max: 100 }, { slug: 'audit-readiness-score', min: 40, max: 100 },
    { slug: 'compliance-training-completed', min: 5, max: 50 }, { slug: 'training-completion-rate', min: 50, max: 100 },
    { slug: 'legal-costs', min: 5000, max: 100000 }, { slug: 'penalty-fines', min: 0, max: 50000 },
    { slug: 'risk-score', min: 1, max: 100 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const rg of (memberIdsByDimSlug['regulation'] ?? [])) {
      for (const dp of (memberIdsByDimSlug['department'] ?? [])) {
        for (const rl of (memberIdsByDimSlug['risk-level'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { regulation: rg.id, department: dp.id, 'risk-level': rl.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Training & Certification
// ---------------------------------------------------------------------------

async function seedTrainingCertification(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Course Category', slug: 'course-category', members: ['Technical', 'Leadership', 'Compliance', 'Soft Skills', 'Safety'] },
    { name: 'Delivery Method', slug: 'delivery-method', members: ['Online', 'Classroom', 'Blended', 'Self-Paced'] },
    { name: 'Certification Level', slug: 'certification-level', members: ['Foundation', 'Intermediate', 'Advanced', 'Expert'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Courses Offered', slug: 'courses-offered', formula: null as string | null, formatType: 'number' },
    { name: 'Enrollments', slug: 'enrollments', formula: null as string | null, formatType: 'number' },
    { name: 'Completions', slug: 'completions', formula: null as string | null, formatType: 'number' },
    { name: 'Completion Rate', slug: 'completion-rate', formula: 'Completions / Enrollments * 100', formatType: 'percentage' },
    { name: 'Avg Assessment Score', slug: 'avg-assessment-score', formula: null as string | null, formatType: 'number' },
    { name: 'Pass Rate', slug: 'pass-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Certificates Issued', slug: 'certificates-issued', formula: null as string | null, formatType: 'number' },
    { name: 'Certificates Expired', slug: 'certificates-expired', formula: null as string | null, formatType: 'number' },
    { name: 'Renewal Rate', slug: 'renewal-rate', formula: '(Certificates Issued - Certificates Expired) / Certificates Issued * 100', formatType: 'percentage' },
    { name: 'Training Hours', slug: 'training-hours', formula: null as string | null, formatType: 'number' },
    { name: 'Training Cost', slug: 'training-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Cost Per Completion', slug: 'cost-per-completion', formula: 'Training Cost / Completions', formatType: 'currency' },
    { name: 'Learner Satisfaction', slug: 'learner-satisfaction', formula: null as string | null, formatType: 'number' },
    { name: 'Training ROI', slug: 'training-roi', formula: null as string | null, formatType: 'percentage' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Completion Rate', 0, 0, 3, 2, { blockSlug: 'completion-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Pass Rate', 3, 0, 3, 2, { blockSlug: 'pass-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Cost Per Completion', 6, 0, 3, 2, { blockSlug: 'cost-per-completion', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Training ROI', 9, 0, 3, 2, { blockSlug: 'training-roi', format: 'percent', value: 0, previousValue: 0 }),
    widget('chart', 'Training Cost by Course Category', 0, 2, 6, 4, { blockSlug: 'training-cost', dimensionSlug: 'course-category', chartType: 'bar' }),
    widget('chart', 'Completions by Quarter', 6, 2, 6, 4, { blockSlug: 'completions', dimensionSlug: 'quarter', chartType: 'line' }),
    widget('grid', 'Training & Certification', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Training & Certification Dashboard', slug: 'training-certification-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'courses-offered', min: 1, max: 20 }, { slug: 'enrollments', min: 5, max: 100 }, { slug: 'completions', min: 3, max: 80 },
    { slug: 'avg-assessment-score', min: 40, max: 100 }, { slug: 'pass-rate', min: 50, max: 98 },
    { slug: 'certificates-issued', min: 2, max: 60 }, { slug: 'certificates-expired', min: 0, max: 20 },
    { slug: 'training-hours', min: 4, max: 120 }, { slug: 'training-cost', min: 500, max: 25000 },
    { slug: 'learner-satisfaction', min: 1, max: 5 }, { slug: 'training-roi', min: 10, max: 300 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const cc of (memberIdsByDimSlug['course-category'] ?? [])) {
      for (const dm of (memberIdsByDimSlug['delivery-method'] ?? [])) {
        for (const cl of (memberIdsByDimSlug['certification-level'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'course-category': cc.id, 'delivery-method': dm.id, 'certification-level': cl.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: SaaS Revenue
// ---------------------------------------------------------------------------

async function seedSaasRevenue(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Plan Tier', slug: 'plan-tier', members: ['Starter', 'Professional', 'Enterprise', 'Custom'] },
    { name: 'Acquisition Channel', slug: 'acquisition-channel', members: ['Organic', 'Paid Ads', 'Referral', 'Partner', 'Direct Sales'] },
    { name: 'Region', slug: 'region', members: ['South Africa', 'Rest of Africa', 'Europe', 'Americas', 'APAC'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Active Subscribers', slug: 'active-subscribers', formula: null as string | null, formatType: 'number' },
    { name: 'New Subscribers', slug: 'new-subscribers', formula: null as string | null, formatType: 'number' },
    { name: 'Churned Subscribers', slug: 'churned-subscribers', formula: null as string | null, formatType: 'number' },
    { name: 'Net Subscriber Growth', slug: 'net-subscriber-growth', formula: 'New Subscribers - Churned Subscribers', formatType: 'number' },
    { name: 'Churn Rate', slug: 'churn-rate', formula: 'Churned Subscribers / Active Subscribers * 100', formatType: 'percentage' },
    { name: 'MRR', slug: 'mrr', formula: null as string | null, formatType: 'currency' },
    { name: 'New MRR', slug: 'new-mrr', formula: null as string | null, formatType: 'currency' },
    { name: 'Expansion MRR', slug: 'expansion-mrr', formula: null as string | null, formatType: 'currency' },
    { name: 'Churned MRR', slug: 'churned-mrr', formula: null as string | null, formatType: 'currency' },
    { name: 'Net New MRR', slug: 'net-new-mrr', formula: 'New MRR + Expansion MRR - Churned MRR', formatType: 'currency' },
    { name: 'ARR', slug: 'arr', formula: 'MRR * 12', formatType: 'currency' },
    { name: 'ARPU', slug: 'arpu', formula: 'MRR / Active Subscribers', formatType: 'currency' },
    { name: 'CAC', slug: 'cac', formula: null as string | null, formatType: 'currency' },
    { name: 'LTV', slug: 'ltv', formula: 'ARPU / (Churn Rate / 100)', formatType: 'currency' },
    { name: 'LTV:CAC Ratio', slug: 'ltv-cac-ratio', formula: 'LTV / CAC', formatType: 'number' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'MRR', 0, 0, 3, 2, { blockSlug: 'mrr', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'ARR', 3, 0, 3, 2, { blockSlug: 'arr', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Churn Rate', 6, 0, 3, 2, { blockSlug: 'churn-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'LTV:CAC Ratio', 9, 0, 3, 2, { blockSlug: 'ltv-cac-ratio', format: 'number', value: 0, previousValue: 0 }),
    widget('chart', 'MRR by Plan Tier', 0, 2, 6, 4, { blockSlug: 'mrr', dimensionSlug: 'plan-tier', chartType: 'bar' }),
    widget('chart', 'Net New MRR by Month', 6, 2, 6, 4, { blockSlug: 'net-new-mrr', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'SaaS Revenue Metrics', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'SaaS Revenue Dashboard', slug: 'saas-revenue-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'active-subscribers', min: 10, max: 500 }, { slug: 'new-subscribers', min: 1, max: 50 }, { slug: 'churned-subscribers', min: 0, max: 20 },
    { slug: 'mrr', min: 1000, max: 50000 }, { slug: 'new-mrr', min: 200, max: 10000 },
    { slug: 'expansion-mrr', min: 100, max: 5000 }, { slug: 'churned-mrr', min: 50, max: 3000 },
    { slug: 'cac', min: 50, max: 2000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const pt of (memberIdsByDimSlug['plan-tier'] ?? [])) {
      for (const ac of (memberIdsByDimSlug['acquisition-channel'] ?? [])) {
        for (const rg of (memberIdsByDimSlug['region'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'plan-tier': pt.id, 'acquisition-channel': ac.id, region: rg.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Communication Analytics
// ---------------------------------------------------------------------------

async function seedCommunicationAnalytics(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Channel', slug: 'channel', members: ['WhatsApp', 'Email', 'SMS', 'In-App', 'Phone'] },
    { name: 'Message Type', slug: 'message-type', members: ['Document Request', 'Interview Invite', 'Reminder', 'Notification', 'Conversation'] },
    { name: 'Department', slug: 'department', members: ['Engineering', 'Finance', 'Sales', 'Operations', 'Marketing', 'HR'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Messages Sent', slug: 'messages-sent', formula: null as string | null, formatType: 'number' },
    { name: 'Messages Delivered', slug: 'messages-delivered', formula: null as string | null, formatType: 'number' },
    { name: 'Delivery Rate', slug: 'delivery-rate', formula: 'Messages Delivered / Messages Sent * 100', formatType: 'percentage' },
    { name: 'Messages Read', slug: 'messages-read', formula: null as string | null, formatType: 'number' },
    { name: 'Read Rate', slug: 'read-rate', formula: 'Messages Read / Messages Delivered * 100', formatType: 'percentage' },
    { name: 'Responses Received', slug: 'responses-received', formula: null as string | null, formatType: 'number' },
    { name: 'Response Rate', slug: 'response-rate', formula: 'Responses Received / Messages Delivered * 100', formatType: 'percentage' },
    { name: 'Avg Response Time (hrs)', slug: 'avg-response-time-hrs', formula: null as string | null, formatType: 'number' },
    { name: 'Documents Collected', slug: 'documents-collected', formula: null as string | null, formatType: 'number' },
    { name: 'Collection Rate', slug: 'collection-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'Failed Deliveries', slug: 'failed-deliveries', formula: null as string | null, formatType: 'number' },
    { name: 'Messaging Cost', slug: 'messaging-cost', formula: null as string | null, formatType: 'currency' },
    { name: 'Cost Per Response', slug: 'cost-per-response', formula: 'Messaging Cost / Responses Received', formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Delivery Rate', 0, 0, 3, 2, { blockSlug: 'delivery-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Response Rate', 3, 0, 3, 2, { blockSlug: 'response-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Collection Rate', 6, 0, 3, 2, { blockSlug: 'collection-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Cost Per Response', 9, 0, 3, 2, { blockSlug: 'cost-per-response', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Messages Sent by Channel', 0, 2, 6, 4, { blockSlug: 'messages-sent', dimensionSlug: 'channel', chartType: 'bar' }),
    widget('chart', 'Responses Received by Month', 6, 2, 6, 4, { blockSlug: 'responses-received', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Communication Analytics', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Communication Analytics Dashboard', slug: 'communication-analytics-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'messages-sent', min: 50, max: 500 }, { slug: 'messages-delivered', min: 40, max: 480 },
    { slug: 'messages-read', min: 20, max: 400 }, { slug: 'responses-received', min: 10, max: 200 },
    { slug: 'avg-response-time-hrs', min: 1, max: 48 }, { slug: 'documents-collected', min: 0, max: 100 },
    { slug: 'collection-rate', min: 20, max: 95 }, { slug: 'failed-deliveries', min: 0, max: 30 },
    { slug: 'messaging-cost', min: 50, max: 2000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const ch of (memberIdsByDimSlug['channel'] ?? [])) {
      for (const mt of (memberIdsByDimSlug['message-type'] ?? [])) {
        for (const dp of (memberIdsByDimSlug['department'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { channel: ch.id, 'message-type': mt.id, department: dp.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Talent Pipeline
// ---------------------------------------------------------------------------

async function seedTalentPipeline(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Pipeline Stage', slug: 'pipeline-stage', members: ['Applied', 'Screened', 'Interviewed', 'Offered', 'Hired', 'Rejected'] },
    { name: 'Source', slug: 'source', members: ['Job Board', 'Referral', 'Agency', 'Direct', 'Social Media'] },
    { name: 'Department', slug: 'department', members: ['Engineering', 'Finance', 'Sales', 'Operations', 'Marketing', 'HR'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Candidates Entered', slug: 'candidates-entered', formula: null as string | null, formatType: 'number' },
    { name: 'Candidates Screened', slug: 'candidates-screened', formula: null as string | null, formatType: 'number' },
    { name: 'Screen Pass Rate', slug: 'screen-pass-rate', formula: 'Candidates Screened / Candidates Entered * 100', formatType: 'percentage' },
    { name: 'Interviews Conducted', slug: 'interviews-conducted', formula: null as string | null, formatType: 'number' },
    { name: 'Interview Pass Rate', slug: 'interview-pass-rate', formula: 'Interviews Conducted / Candidates Screened * 100', formatType: 'percentage' },
    { name: 'Offers Extended', slug: 'offers-extended', formula: null as string | null, formatType: 'number' },
    { name: 'Offers Accepted', slug: 'offers-accepted', formula: null as string | null, formatType: 'number' },
    { name: 'Offer Acceptance Rate', slug: 'offer-acceptance-rate', formula: 'Offers Accepted / Offers Extended * 100', formatType: 'percentage' },
    { name: 'Time to Hire (days)', slug: 'time-to-hire-days', formula: null as string | null, formatType: 'number' },
    { name: 'Cost Per Hire', slug: 'cost-per-hire', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Recruitment Cost', slug: 'total-recruitment-cost', formula: 'Cost Per Hire * Offers Accepted', formatType: 'currency' },
    { name: 'Source Effectiveness', slug: 'source-effectiveness', formula: null as string | null, formatType: 'percentage' },
    { name: 'Quality of Hire Score', slug: 'quality-of-hire-score', formula: null as string | null, formatType: 'number' },
    { name: 'Funnel Conversion Rate', slug: 'funnel-conversion-rate', formula: 'Offers Accepted / Candidates Entered * 100', formatType: 'percentage' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Offer Acceptance Rate', 0, 0, 3, 2, { blockSlug: 'offer-acceptance-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Funnel Conversion Rate', 3, 0, 3, 2, { blockSlug: 'funnel-conversion-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Cost Per Hire', 6, 0, 3, 2, { blockSlug: 'cost-per-hire', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Time to Hire (days)', 9, 0, 3, 2, { blockSlug: 'time-to-hire-days', format: 'number', value: 0, previousValue: 0 }),
    widget('chart', 'Total Recruitment Cost by Source', 0, 2, 6, 4, { blockSlug: 'total-recruitment-cost', dimensionSlug: 'source', chartType: 'bar' }),
    widget('chart', 'Candidates Entered by Quarter', 6, 2, 6, 4, { blockSlug: 'candidates-entered', dimensionSlug: 'quarter', chartType: 'line' }),
    widget('grid', 'Talent Pipeline', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Talent Pipeline Dashboard', slug: 'talent-pipeline-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'candidates-entered', min: 10, max: 200 }, { slug: 'candidates-screened', min: 5, max: 150 },
    { slug: 'interviews-conducted', min: 2, max: 80 }, { slug: 'offers-extended', min: 1, max: 30 },
    { slug: 'offers-accepted', min: 0, max: 25 }, { slug: 'time-to-hire-days', min: 14, max: 90 },
    { slug: 'cost-per-hire', min: 2000, max: 15000 }, { slug: 'source-effectiveness', min: 10, max: 95 },
    { slug: 'quality-of-hire-score', min: 1, max: 10 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const ps of (memberIdsByDimSlug['pipeline-stage'] ?? [])) {
      for (const sr of (memberIdsByDimSlug['source'] ?? [])) {
        for (const dp of (memberIdsByDimSlug['department'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { 'pipeline-stage': ps.id, source: sr.id, department: dp.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Employee Engagement
// ---------------------------------------------------------------------------

async function seedEmployeeEngagement(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Finance', 'Sales', 'Operations', 'Marketing', 'HR'] },
    { name: 'Survey Type', slug: 'survey-type', members: ['Pulse', 'Quarterly', 'Annual', 'Onboarding', 'Exit'] },
    { name: 'Sentiment', slug: 'sentiment', members: ['Very Positive', 'Positive', 'Neutral', 'Negative'] },
    { name: 'Quarter', slug: 'quarter', members: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Survey Responses', slug: 'survey-responses', formula: null as string | null, formatType: 'number' },
    { name: 'Response Rate', slug: 'response-rate', formula: null as string | null, formatType: 'percentage' },
    { name: 'eNPS Score', slug: 'enps-score', formula: null as string | null, formatType: 'number' },
    { name: 'Wellbeing Score', slug: 'wellbeing-score', formula: null as string | null, formatType: 'number' },
    { name: 'Manager Satisfaction', slug: 'manager-satisfaction', formula: null as string | null, formatType: 'number' },
    { name: 'Culture Score', slug: 'culture-score', formula: null as string | null, formatType: 'number' },
    { name: 'Avg Engagement Index', slug: 'avg-engagement-index', formula: '(eNPS Score + Wellbeing Score + Manager Satisfaction + Culture Score) / 4', formatType: 'number' },
    { name: 'Positive Sentiment %', slug: 'positive-sentiment-pct', formula: null as string | null, formatType: 'percentage' },
    { name: 'Negative Sentiment %', slug: 'negative-sentiment-pct', formula: null as string | null, formatType: 'percentage' },
    { name: 'Action Items Created', slug: 'action-items-created', formula: null as string | null, formatType: 'number' },
    { name: 'Action Items Closed', slug: 'action-items-closed', formula: null as string | null, formatType: 'number' },
    { name: 'Action Closure Rate', slug: 'action-closure-rate', formula: 'Action Items Closed / Action Items Created * 100', formatType: 'percentage' },
    { name: 'Voluntary Turnover', slug: 'voluntary-turnover', formula: null as string | null, formatType: 'number' },
    { name: 'Retention Rate', slug: 'retention-rate', formula: null as string | null, formatType: 'percentage' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'eNPS Score', 0, 0, 3, 2, { blockSlug: 'enps-score', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Avg Engagement Index', 3, 0, 3, 2, { blockSlug: 'avg-engagement-index', format: 'number', value: 0, previousValue: 0 }),
    widget('kpi', 'Retention Rate', 6, 0, 3, 2, { blockSlug: 'retention-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('kpi', 'Action Closure Rate', 9, 0, 3, 2, { blockSlug: 'action-closure-rate', format: 'percent', value: 0, previousValue: 0 }),
    widget('chart', 'eNPS Score by Department', 0, 2, 6, 4, { blockSlug: 'enps-score', dimensionSlug: 'department', chartType: 'bar' }),
    widget('chart', 'Wellbeing Score by Quarter', 6, 2, 6, 4, { blockSlug: 'wellbeing-score', dimensionSlug: 'quarter', chartType: 'line' }),
    widget('grid', 'Employee Engagement', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Employee Engagement Dashboard', slug: 'employee-engagement-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'survey-responses', min: 10, max: 200 }, { slug: 'response-rate', min: 40, max: 95 },
    { slug: 'enps-score', min: -20, max: 80 }, { slug: 'wellbeing-score', min: 30, max: 90 },
    { slug: 'manager-satisfaction', min: 30, max: 95 }, { slug: 'culture-score', min: 35, max: 90 },
    { slug: 'positive-sentiment-pct', min: 30, max: 80 }, { slug: 'negative-sentiment-pct', min: 5, max: 40 },
    { slug: 'action-items-created', min: 2, max: 30 }, { slug: 'action-items-closed', min: 1, max: 25 },
    { slug: 'voluntary-turnover', min: 0, max: 10 }, { slug: 'retention-rate', min: 70, max: 98 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dp of (memberIdsByDimSlug['department'] ?? [])) {
      for (const st of (memberIdsByDimSlug['survey-type'] ?? [])) {
        for (const sn of (memberIdsByDimSlug['sentiment'] ?? [])) {
          for (const qtr of (memberIdsByDimSlug['quarter'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dp.id, 'survey-type': st.id, sentiment: sn.id, quarter: qtr.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Template: Payroll Planning
// ---------------------------------------------------------------------------

async function seedPayrollPlanning(db: Database, appId: string) {
  const dimDefs = [
    { name: 'Department', slug: 'department', members: ['Engineering', 'Finance', 'Sales', 'Operations', 'Marketing', 'HR'] },
    { name: 'Employment Type', slug: 'employment-type', members: ['Permanent', 'Contract', 'Part-Time', 'Intern'] },
    { name: 'Pay Grade', slug: 'pay-grade', members: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'] },
    { name: 'Month', slug: 'month', members: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  ];

  const insertedDims: Array<{ id: string; slug: string }> = [];
  const memberIdsByDimSlug: Record<string, Array<{ id: string; name: string }>> = {};
  for (const def of dimDefs) {
    const dimResult = await db.insert(dimensions).values({ applicationId: appId, name: def.name, slug: def.slug, sortOrder: insertedDims.length }).returning();
    const dim = dimResult[0]!;
    insertedDims.push({ id: dim.id, slug: def.slug });
    const memberRows = def.members.map((name, i) => ({ dimensionId: dim.id, name, code: name.toLowerCase().replace(/\s+/g, '-'), sortOrder: i }));
    const ins = await db.insert(dimensionMembers).values(memberRows).returning();
    memberIdsByDimSlug[def.slug] = ins.map((m) => ({ id: m.id, name: m.name }));
  }

  const blockDefs = [
    { name: 'Headcount', slug: 'headcount', formula: null as string | null, formatType: 'number' },
    { name: 'Basic Salary', slug: 'basic-salary', formula: null as string | null, formatType: 'currency' },
    { name: 'Overtime Pay', slug: 'overtime-pay', formula: null as string | null, formatType: 'currency' },
    { name: 'Allowances', slug: 'allowances', formula: null as string | null, formatType: 'currency' },
    { name: 'Gross Pay', slug: 'gross-pay', formula: 'Basic Salary + Overtime Pay + Allowances', formatType: 'currency' },
    { name: 'Tax (PAYE)', slug: 'tax-paye', formula: null as string | null, formatType: 'currency' },
    { name: 'UIF Contribution', slug: 'uif-contribution', formula: null as string | null, formatType: 'currency' },
    { name: 'Pension Contribution', slug: 'pension-contribution', formula: null as string | null, formatType: 'currency' },
    { name: 'Medical Aid', slug: 'medical-aid', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Deductions', slug: 'total-deductions', formula: 'Tax (PAYE) + UIF Contribution + Pension Contribution + Medical Aid', formatType: 'currency' },
    { name: 'Net Pay', slug: 'net-pay', formula: 'Gross Pay - Total Deductions', formatType: 'currency' },
    { name: 'Employer Contributions', slug: 'employer-contributions', formula: null as string | null, formatType: 'currency' },
    { name: 'Total Cost to Company', slug: 'total-cost-to-company', formula: 'Gross Pay + Employer Contributions', formatType: 'currency' },
    { name: 'Cost Per Employee', slug: 'cost-per-employee', formula: 'Total Cost to Company / Headcount', formatType: 'currency' },
    { name: 'Payroll Budget Variance', slug: 'payroll-budget-variance', formula: null as string | null, formatType: 'currency' },
  ];

  const insertedBlocks: Array<{ id: string; slug: string }> = [];
  for (const def of blockDefs) {
    const blkResult = await db.insert(blocks).values({ applicationId: appId, name: def.name, slug: def.slug, blockType: 'metric', formula: def.formula, formatType: def.formatType as 'number' | 'currency' | 'percentage', sortOrder: insertedBlocks.length }).returning();
    const blk = blkResult[0]!;
    insertedBlocks.push({ id: blk.id, slug: blk.slug });
    await db.insert(blockDimensions).values(insertedDims.map((dim, i) => ({ blockId: blk.id, dimensionId: dim.id, sortOrder: i })));
  }

  const insertedVersions = await db.insert(versions).values([
    { applicationId: appId, name: 'Budget 2025', versionType: 'budget' as const, isLocked: 0 },
    { applicationId: appId, name: 'Actuals 2025', versionType: 'actuals' as const, isLocked: 0 },
  ]).returning();

  const layout: BoardWidget[] = [
    widget('kpi', 'Total Cost to Company', 0, 0, 3, 2, { blockSlug: 'total-cost-to-company', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Cost Per Employee', 3, 0, 3, 2, { blockSlug: 'cost-per-employee', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Net Pay', 6, 0, 3, 2, { blockSlug: 'net-pay', format: 'currency', value: 0, previousValue: 0 }),
    widget('kpi', 'Total Deductions', 9, 0, 3, 2, { blockSlug: 'total-deductions', format: 'currency', value: 0, previousValue: 0 }),
    widget('chart', 'Total Cost to Company by Department', 0, 2, 6, 4, { blockSlug: 'total-cost-to-company', dimensionSlug: 'department', chartType: 'bar' }),
    widget('chart', 'Gross Pay by Month', 6, 2, 6, 4, { blockSlug: 'gross-pay', dimensionSlug: 'month', chartType: 'line' }),
    widget('grid', 'Payroll Planning', 0, 6, 12, 5, { blockSlugs: blockDefs.map((b) => b.slug) }),
  ];
  await db.insert(boards).values({ applicationId: appId, name: 'Payroll Planning Dashboard', slug: 'payroll-planning-dashboard', layout, sortOrder: 0 });

  const budgetVersion = insertedVersions.find((v) => v.versionType === 'budget')!;
  const inputSeeds: Array<{ slug: string; min: number; max: number }> = [
    { slug: 'headcount', min: 1, max: 20 }, { slug: 'basic-salary', min: 8000, max: 60000 },
    { slug: 'overtime-pay', min: 0, max: 8000 }, { slug: 'allowances', min: 500, max: 5000 },
    { slug: 'tax-paye', min: 2000, max: 15000 }, { slug: 'uif-contribution', min: 100, max: 500 },
    { slug: 'pension-contribution', min: 500, max: 5000 }, { slug: 'medical-aid', min: 1000, max: 6000 },
    { slug: 'employer-contributions', min: 2000, max: 12000 }, { slug: 'payroll-budget-variance', min: -5000, max: 5000 },
  ];

  const cellRows: Array<{ blockId: string; coordinates: Record<string, string>; numericValue: number; isInput: boolean; versionId: string }> = [];
  for (const seed of inputSeeds) {
    const blk = insertedBlocks.find((b) => b.slug === seed.slug);
    if (!blk) continue;
    for (const dp of (memberIdsByDimSlug['department'] ?? [])) {
      for (const et of (memberIdsByDimSlug['employment-type'] ?? [])) {
        for (const pg of (memberIdsByDimSlug['pay-grade'] ?? [])) {
          for (const mo of (memberIdsByDimSlug['month'] ?? [])) {
            cellRows.push({ blockId: blk.id, coordinates: { department: dp.id, 'employment-type': et.id, 'pay-grade': pg.id, month: mo.id }, numericValue: randInt(seed.min, seed.max), isInput: true, versionId: budgetVersion.id });
          }
        }
      }
    }
  }
  for (let i = 0; i < cellRows.length; i += 100) { await db.insert(cells).values(cellRows.slice(i, i + 100)); }
  return { blocks: insertedBlocks.length, dimensions: insertedDims.length, boards: 1, versions: insertedVersions.length, cells: cellRows.length };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createTemplatesRouter(db: Database): Router {
  const router = Router();
  const tenant = createTenantMiddleware(db);

  router.use(authMiddleware);

  router.post('/:workspaceSlug/apps/deploy-template', tenant, async (req, res) => {
    const parsed = deployTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.message });
      return;
    }

    const { templateId, name, slug, description } = parsed.data;

    try {
      // 1. Create the application
      const appResult = await db.insert(applications).values({
        workspaceId: req.workspaceId!,
        name,
        slug,
        description: description ?? null,
        templateId,
        icon: templateId === 'revenue-planning'
          ? 'trending-up'
          : templateId === 'pl-statement'
            ? 'file-text'
            : templateId === 'workforce-planning'
              ? 'users'
              : templateId === 'recruitment-pipeline'
                ? 'briefcase'
                : templateId === 'kpi-performance'
                  ? 'target'
                  : templateId === 'learning-development'
                    ? 'graduation-cap'
                    : templateId === 'employee-onboarding'
                      ? 'clipboard-check'
                      : templateId === 'compensation-benefits'
                        ? 'heart-pulse'
                        : templateId === 'fleet-management'
                          ? 'truck'
                          : templateId === 'interview-analytics'
                            ? 'video'
                            : templateId === 'document-management'
                              ? 'file-text'
                              : templateId === 'social-screening'
                                ? 'shield-check'
                                : templateId === 'workforce-intelligence'
                                  ? 'brain'
                                  : templateId === 'offer-management'
                                    ? 'handshake'
                                    : templateId === 'parts-inventory'
                                      ? 'package'
                                      : templateId === 'repairs-maintenance'
                                        ? 'wrench'
                                        : templateId === 'fuel-management'
                                          ? 'fuel'
                                          : templateId === 'tyre-lifecycle'
                                            ? 'circle-dot'
                                            : templateId === 'route-performance'
                                              ? 'map-pin'
                                              : templateId === 'weighbridge-ops'
                                                ? 'scale'
                                                : templateId === 'driver-compensation'
                                                  ? 'wallet'
                                                  : templateId === 'fines-compliance'
                                                    ? 'alert-triangle'
                                                    : templateId === 'leave-management'
                                                      ? 'calendar-days'
                                                      : templateId === 'compliance-risk'
                                                        ? 'shield-alert'
                                                        : templateId === 'training-certification'
                                                          ? 'award'
                                                          : templateId === 'saas-revenue'
                                                            ? 'credit-card'
                                                            : templateId === 'communication-analytics'
                                                              ? 'message-square'
                                                              : templateId === 'talent-pipeline'
                                                                ? 'git-branch'
                                                                : templateId === 'employee-engagement'
                                                                  ? 'heart'
                                                                  : templateId === 'payroll-planning'
                                                                    ? 'banknote'
                                                                    : null,
      }).returning();
      const app = appResult[0]!;

      // 2. Seed template-specific data
      let stats = { blocks: 0, dimensions: 0, boards: 0, versions: 0, cells: 0 };

      if (templateId === 'revenue-planning') {
        stats = await seedRevenuePlanning(db, app.id);
      } else if (templateId === 'pl-statement') {
        stats = await seedPLStatement(db, app.id);
      } else if (templateId === 'workforce-planning') {
        stats = await seedWorkforcePlanning(db, app.id);
      } else if (templateId === 'recruitment-pipeline') {
        stats = await seedRecruitmentPipeline(db, app.id);
      } else if (templateId === 'kpi-performance') {
        stats = await seedKPIPerformance(db, app.id);
      } else if (templateId === 'learning-development') {
        stats = await seedLearningDevelopment(db, app.id);
      } else if (templateId === 'employee-onboarding') {
        stats = await seedEmployeeOnboarding(db, app.id);
      } else if (templateId === 'compensation-benefits') {
        stats = await seedCompensationBenefits(db, app.id);
      } else if (templateId === 'fleet-management') {
        stats = await seedFleetManagement(db, app.id);
      } else if (templateId === 'interview-analytics') {
        stats = await seedInterviewAnalytics(db, app.id);
      } else if (templateId === 'document-management') {
        stats = await seedDocumentManagement(db, app.id);
      } else if (templateId === 'social-screening') {
        stats = await seedSocialScreening(db, app.id);
      } else if (templateId === 'workforce-intelligence') {
        stats = await seedWorkforceIntelligence(db, app.id);
      } else if (templateId === 'offer-management') {
        stats = await seedOfferManagement(db, app.id);
      } else if (templateId === 'parts-inventory') {
        stats = await seedPartsInventory(db, app.id);
      } else if (templateId === 'repairs-maintenance') {
        stats = await seedRepairsMaintenance(db, app.id);
      } else if (templateId === 'fuel-management') {
        stats = await seedFuelManagement(db, app.id);
      } else if (templateId === 'tyre-lifecycle') {
        stats = await seedTyreLifecycle(db, app.id);
      } else if (templateId === 'route-performance') {
        stats = await seedRoutePerformance(db, app.id);
      } else if (templateId === 'weighbridge-ops') {
        stats = await seedWeighbridgeOps(db, app.id);
      } else if (templateId === 'driver-compensation') {
        stats = await seedDriverCompensation(db, app.id);
      } else if (templateId === 'fines-compliance') {
        stats = await seedFinesCompliance(db, app.id);
      } else if (templateId === 'leave-management') {
        stats = await seedLeaveManagement(db, app.id);
      } else if (templateId === 'compliance-risk') {
        stats = await seedComplianceRisk(db, app.id);
      } else if (templateId === 'training-certification') {
        stats = await seedTrainingCertification(db, app.id);
      } else if (templateId === 'saas-revenue') {
        stats = await seedSaasRevenue(db, app.id);
      } else if (templateId === 'communication-analytics') {
        stats = await seedCommunicationAnalytics(db, app.id);
      } else if (templateId === 'talent-pipeline') {
        stats = await seedTalentPipeline(db, app.id);
      } else if (templateId === 'employee-engagement') {
        stats = await seedEmployeeEngagement(db, app.id);
      } else if (templateId === 'payroll-planning') {
        stats = await seedPayrollPlanning(db, app.id);
      }

      res.status(201).json({
        success: true,
        data: {
          app,
          stats,
        },
      });
    } catch (error) {
      console.error('Template deployment failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Template deployment failed',
      });
    }
  });

  return router;
}
