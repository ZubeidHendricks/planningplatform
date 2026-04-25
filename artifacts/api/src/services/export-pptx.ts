import PptxGenJSModule from 'pptxgenjs';
const PptxGenJS = (PptxGenJSModule as any).default ?? PptxGenJSModule;
import type { ExportDimension, ExportCell } from './export-excel.js';

function getCellDisplayValue(cell: ExportCell, formatType?: string): string {
  if (cell.numericValue !== null && cell.numericValue !== undefined) {
    switch (formatType) {
      case 'currency':
        return `$${cell.numericValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${(cell.numericValue * 100).toFixed(2)}%`;
      case 'number':
        return cell.numericValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      default:
        return String(cell.numericValue);
    }
  }
  return cell.textValue ?? '';
}

function findCellForMembers(cells: ExportCell[], ...memberIds: string[]): ExportCell | undefined {
  for (const c of cells) {
    const vals = Object.values(c.coordinates);
    if (memberIds.every((id) => vals.includes(id))) {
      return c;
    }
  }
  return undefined;
}

function hexToRgb(hex: string): string {
  // Strip '#' and return 6-char hex for pptxgenjs
  return hex.replace('#', '').toUpperCase();
}

export async function exportBlockToPPTX(params: {
  blockName: string;
  appName: string;
  dimensions: ExportDimension[];
  cells: ExportCell[];
  formatType?: string;
  branding?: { companyName?: string; primaryColor?: string };
}): Promise<Buffer> {
  const { blockName, appName, dimensions, cells, formatType, branding } = params;

  const pres = new PptxGenJS();
  pres.author = 'Planning Platform';
  pres.title = `${appName} - ${blockName}`;
  pres.subject = 'Data Export';

  const primaryHex = hexToRgb(branding?.primaryColor ?? '#3b82f6');
  const companyName = branding?.companyName ?? appName;

  // --- Title Slide ---
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: primaryHex };

  titleSlide.addText(companyName, {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    h: 1.0,
    fontSize: 32,
    fontFace: 'Arial',
    color: 'FFFFFF',
    bold: true,
  });

  titleSlide.addText(blockName, {
    x: 0.5,
    y: 2.2,
    w: 9.0,
    h: 0.6,
    fontSize: 20,
    fontFace: 'Arial',
    color: 'FFFFFF',
  });

  titleSlide.addText(
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    {
      x: 0.5,
      y: 4.5,
      w: 9.0,
      h: 0.4,
      fontSize: 12,
      fontFace: 'Arial',
      color: 'CCCCCC',
    },
  );

  // --- Data Slide ---
  const dataSlide = pres.addSlide();

  dataSlide.addText(`${blockName}`, {
    x: 0.5,
    y: 0.2,
    w: 9.0,
    h: 0.5,
    fontSize: 18,
    fontFace: 'Arial',
    bold: true,
    color: '333333',
  });

  if (dimensions.length === 0) {
    const val = cells.length > 0 ? getCellDisplayValue(cells[0]!, formatType) : 'N/A';
    dataSlide.addText(`Value: ${val}`, {
      x: 0.5,
      y: 1.5,
      w: 9.0,
      h: 1.0,
      fontSize: 24,
      fontFace: 'Arial',
      color: '333333',
      align: 'center',
    });
  } else if (dimensions.length === 1) {
    const dim = dimensions[0]!;
    const tableRows: PptxGenJS.TableRow[] = [];

    // Header row
    tableRows.push([
      {
        text: dim.name,
        options: { bold: true, fill: { color: primaryHex }, color: 'FFFFFF', fontSize: 10, fontFace: 'Arial' },
      },
      {
        text: 'Value',
        options: { bold: true, fill: { color: primaryHex }, color: 'FFFFFF', fontSize: 10, fontFace: 'Arial' },
      },
    ]);

    for (let i = 0; i < dim.members.length; i++) {
      const member = dim.members[i]!;
      const cell = findCellForMembers(cells, member.code || member.name);
      const val = cell ? getCellDisplayValue(cell, formatType) : '';
      const rowFill = i % 2 === 0 ? 'F8FAFC' : 'FFFFFF';

      tableRows.push([
        { text: member.name, options: { fontSize: 9, fontFace: 'Arial', fill: { color: rowFill } } },
        { text: val, options: { fontSize: 9, fontFace: 'Arial', fill: { color: rowFill }, align: 'right' } },
      ]);
    }

    dataSlide.addTable(tableRows, {
      x: 0.5,
      y: 0.9,
      w: 9.0,
      colW: [4.5, 4.5],
      border: { type: 'solid', pt: 0.5, color: 'DDDDDD' },
      autoPage: true,
      autoPageRepeatHeader: true,
    });
  } else {
    // 2D table
    const rowDim = dimensions[0]!;
    const colDim = dimensions[1]!;
    const tableRows: PptxGenJS.TableRow[] = [];

    // Header
    const headerRow: PptxGenJS.TableCell[] = [
      {
        text: rowDim.name,
        options: { bold: true, fill: { color: primaryHex }, color: 'FFFFFF', fontSize: 9, fontFace: 'Arial' },
      },
    ];
    for (const colMember of colDim.members) {
      headerRow.push({
        text: colMember.name,
        options: { bold: true, fill: { color: primaryHex }, color: 'FFFFFF', fontSize: 9, fontFace: 'Arial', align: 'center' },
      });
    }
    tableRows.push(headerRow);

    // Data rows
    for (let ri = 0; ri < rowDim.members.length; ri++) {
      const rowMember = rowDim.members[ri]!;
      const rowFill = ri % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
      const dataRow: PptxGenJS.TableCell[] = [
        { text: rowMember.name, options: { fontSize: 9, fontFace: 'Arial', bold: true, fill: { color: rowFill } } },
      ];

      for (const colMember of colDim.members) {
        const cell = findCellForMembers(
          cells,
          rowMember.code || rowMember.name,
          colMember.code || colMember.name,
        );
        const val = cell ? getCellDisplayValue(cell, formatType) : '';
        dataRow.push({
          text: val,
          options: { fontSize: 9, fontFace: 'Arial', align: 'right', fill: { color: rowFill } },
        });
      }

      tableRows.push(dataRow);
    }

    const totalCols = colDim.members.length + 1;
    const availableWidth = 9.0;
    const firstColWidth = Math.min(2.5, availableWidth * 0.3);
    const otherColWidth = (availableWidth - firstColWidth) / colDim.members.length;
    const colWidths = [firstColWidth, ...colDim.members.map(() => otherColWidth)];

    dataSlide.addTable(tableRows, {
      x: 0.5,
      y: 0.9,
      w: availableWidth,
      colW: colWidths,
      border: { type: 'solid', pt: 0.5, color: 'DDDDDD' },
      autoPage: true,
      autoPageRepeatHeader: true,
    });
  }

  // Footer on data slide
  dataSlide.addText('Generated by Planning Platform', {
    x: 0.5,
    y: 5.2,
    w: 9.0,
    h: 0.3,
    fontSize: 7,
    fontFace: 'Arial',
    color: 'AAAAAA',
    align: 'center',
  });

  const output = await pres.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
