import ExcelJS from 'exceljs';

export interface ExportDimension {
  name: string;
  members: Array<{ name: string; code: string }>;
}

export interface ExportCell {
  coordinates: Record<string, string>;
  numericValue: number | null;
  textValue: string | null;
}

function getNumberFormat(formatType?: string): string | undefined {
  switch (formatType) {
    case 'currency':
      return '$#,##0.00';
    case 'percentage':
      return '0.00%';
    case 'number':
      return '#,##0.00';
    default:
      return undefined;
  }
}

function getCellDisplayValue(cell: ExportCell): number | string {
  if (cell.numericValue !== null && cell.numericValue !== undefined) {
    return cell.numericValue;
  }
  return cell.textValue ?? '';
}

function buildCellLookup(cells: ExportCell[]): Map<string, ExportCell> {
  const lookup = new Map<string, ExportCell>();
  for (const cell of cells) {
    const key = Object.entries(cell.coordinates)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    lookup.set(key, cell);
  }
  return lookup;
}

function makeLookupKey(coords: Record<string, string>): string {
  return Object.entries(coords)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF3B82F6' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
    };
  });
}

export async function exportBlockToExcel(params: {
  blockName: string;
  dimensions: ExportDimension[];
  cells: ExportCell[];
  formatType?: string;
}): Promise<Buffer> {
  const { blockName, dimensions, cells, formatType } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Planning Platform';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(blockName.slice(0, 31));
  const numFmt = getNumberFormat(formatType);
  const cellLookup = buildCellLookup(cells);

  if (dimensions.length === 0) {
    // Single value
    sheet.columns = [{ header: 'Value', key: 'value', width: 20 }];
    styleHeaderRow(sheet.getRow(1));
    const val = cells.length > 0 ? getCellDisplayValue(cells[0]!) : '';
    const dataRow = sheet.addRow({ value: val });
    if (numFmt && typeof val === 'number') {
      dataRow.getCell(1).numFmt = numFmt;
    }
  } else if (dimensions.length === 1) {
    // Single column of values
    const dim = dimensions[0]!;
    sheet.columns = [
      { header: dim.name, key: 'member', width: 25 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    styleHeaderRow(sheet.getRow(1));

    for (const member of dim.members) {
      const coordKey = makeLookupKey({ [dim.name.toLowerCase()]: member.code || member.name });
      // Try multiple key patterns since coordinates may use slug, id, or name
      let cell: ExportCell | undefined;
      for (const c of cells) {
        const vals = Object.values(c.coordinates);
        if (vals.includes(member.code) || vals.includes(member.name)) {
          cell = c;
          break;
        }
      }
      if (!cell) {
        cell = cellLookup.get(coordKey);
      }
      const val = cell ? getCellDisplayValue(cell) : '';
      const dataRow = sheet.addRow({ member: member.name, value: val });
      if (numFmt && typeof val === 'number') {
        dataRow.getCell(2).numFmt = numFmt;
      }
    }
  } else {
    // 2+ dimensions: rows = dim1 members, columns = dim2 members
    const rowDim = dimensions[0]!;
    const colDim = dimensions[1]!;

    const columns: Partial<ExcelJS.Column>[] = [
      { header: rowDim.name, key: 'rowMember', width: 25 },
    ];
    for (const colMember of colDim.members) {
      columns.push({
        header: colMember.name,
        key: `col_${colMember.code || colMember.name}`,
        width: 18,
      });
    }
    sheet.columns = columns;
    styleHeaderRow(sheet.getRow(1));

    for (const rowMember of rowDim.members) {
      const rowData: Record<string, string | number> = {
        rowMember: rowMember.name,
      };

      for (const colMember of colDim.members) {
        let matchedCell: ExportCell | undefined;
        for (const c of cells) {
          const vals = Object.values(c.coordinates);
          const rowMatch = vals.includes(rowMember.code) || vals.includes(rowMember.name);
          const colMatch = vals.includes(colMember.code) || vals.includes(colMember.name);
          if (rowMatch && colMatch) {
            matchedCell = c;
            break;
          }
        }
        const colKey = `col_${colMember.code || colMember.name}`;
        rowData[colKey] = matchedCell ? getCellDisplayValue(matchedCell) : '';
      }

      const dataRow = sheet.addRow(rowData);
      if (numFmt) {
        for (let i = 2; i <= colDim.members.length + 1; i++) {
          const cellVal = dataRow.getCell(i).value;
          if (typeof cellVal === 'number') {
            dataRow.getCell(i).numFmt = numFmt;
          }
        }
      }
    }
  }

  // Auto-filter on header row
  if (sheet.lastRow && sheet.lastRow.number > 1) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function exportAppToExcel(params: {
  appName: string;
  blocks: Array<{
    name: string;
    cells: ExportCell[];
    dimensions: ExportDimension[];
    formatType?: string;
  }>;
}): Promise<Buffer> {
  const { appName, blocks: blockList } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Planning Platform';
  workbook.created = new Date();

  for (const block of blockList) {
    const sheetName = block.name.slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName);
    const numFmt = getNumberFormat(block.formatType);
    const cellLookup = buildCellLookup(block.cells);

    if (block.dimensions.length === 0) {
      sheet.columns = [{ header: 'Value', key: 'value', width: 20 }];
      styleHeaderRow(sheet.getRow(1));
      const val = block.cells.length > 0 ? getCellDisplayValue(block.cells[0]!) : '';
      const dataRow = sheet.addRow({ value: val });
      if (numFmt && typeof val === 'number') {
        dataRow.getCell(1).numFmt = numFmt;
      }
    } else if (block.dimensions.length === 1) {
      const dim = block.dimensions[0]!;
      sheet.columns = [
        { header: dim.name, key: 'member', width: 25 },
        { header: 'Value', key: 'value', width: 20 },
      ];
      styleHeaderRow(sheet.getRow(1));

      for (const member of dim.members) {
        let cell: ExportCell | undefined;
        for (const c of block.cells) {
          const vals = Object.values(c.coordinates);
          if (vals.includes(member.code) || vals.includes(member.name)) {
            cell = c;
            break;
          }
        }
        const val = cell ? getCellDisplayValue(cell) : '';
        const dataRow = sheet.addRow({ member: member.name, value: val });
        if (numFmt && typeof val === 'number') {
          dataRow.getCell(2).numFmt = numFmt;
        }
      }
    } else {
      const rowDim = block.dimensions[0]!;
      const colDim = block.dimensions[1]!;

      const columns: Partial<ExcelJS.Column>[] = [
        { header: rowDim.name, key: 'rowMember', width: 25 },
      ];
      for (const colMember of colDim.members) {
        columns.push({
          header: colMember.name,
          key: `col_${colMember.code || colMember.name}`,
          width: 18,
        });
      }
      sheet.columns = columns;
      styleHeaderRow(sheet.getRow(1));

      for (const rowMember of rowDim.members) {
        const rowData: Record<string, string | number> = {
          rowMember: rowMember.name,
        };

        for (const colMember of colDim.members) {
          let matchedCell: ExportCell | undefined;
          for (const c of block.cells) {
            const vals = Object.values(c.coordinates);
            const rowMatch = vals.includes(rowMember.code) || vals.includes(rowMember.name);
            const colMatch = vals.includes(colMember.code) || vals.includes(colMember.name);
            if (rowMatch && colMatch) {
              matchedCell = c;
              break;
            }
          }
          const colKey = `col_${colMember.code || colMember.name}`;
          rowData[colKey] = matchedCell ? getCellDisplayValue(matchedCell) : '';
        }

        const dataRow = sheet.addRow(rowData);
        if (numFmt) {
          for (let i = 2; i <= colDim.members.length + 1; i++) {
            const cellVal = dataRow.getCell(i).value;
            if (typeof cellVal === 'number') {
              dataRow.getCell(i).numFmt = numFmt;
            }
          }
        }
      }
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
