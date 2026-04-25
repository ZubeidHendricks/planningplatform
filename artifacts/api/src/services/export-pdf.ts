import PDFDocument from 'pdfkit';
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

export async function exportBlockToPDF(params: {
  blockName: string;
  appName: string;
  dimensions: ExportDimension[];
  cells: ExportCell[];
  formatType?: string;
  branding?: { companyName?: string; primaryColor?: string };
}): Promise<Buffer> {
  const { blockName, appName, dimensions, cells, formatType, branding } = params;

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = branding?.primaryColor ?? '#3b82f6';
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // --- Header ---
      doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold');
      doc.text(branding?.companyName ?? appName, 50, 20, { width: pageWidth });
      doc.fontSize(12).font('Helvetica');
      doc.text(blockName, 50, 48, { width: pageWidth });
      doc.fillColor('#333333');

      // --- Date ---
      doc.moveDown(2);
      const y = doc.y;
      doc.fontSize(9).fillColor('#888888');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, y, { width: pageWidth });
      doc.moveDown(1.5);

      // --- Data Table ---
      doc.fillColor('#333333').fontSize(10);

      if (dimensions.length === 0) {
        const val = cells.length > 0 ? getCellDisplayValue(cells[0]!, formatType) : 'N/A';
        doc.font('Helvetica-Bold').text('Value: ', { continued: true });
        doc.font('Helvetica').text(val);
      } else if (dimensions.length === 1) {
        const dim = dimensions[0]!;
        const colWidth = pageWidth / 2;
        const tableTop = doc.y;

        // Header row
        doc.rect(50, tableTop, pageWidth, 22).fill(primaryColor);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
        doc.text(dim.name, 55, tableTop + 6, { width: colWidth - 10 });
        doc.text('Value', 50 + colWidth + 5, tableTop + 6, { width: colWidth - 10 });

        doc.fillColor('#333333').font('Helvetica').fontSize(9);
        let rowY = tableTop + 22;

        for (let i = 0; i < dim.members.length; i++) {
          const member = dim.members[i]!;
          if (rowY > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
          }

          if (i % 2 === 0) {
            doc.rect(50, rowY, pageWidth, 20).fill('#f8fafc');
            doc.fillColor('#333333');
          }

          const cell = findCellForMembers(cells, member.code || member.name);
          const val = cell ? getCellDisplayValue(cell, formatType) : '';

          doc.text(member.name, 55, rowY + 5, { width: colWidth - 10 });
          doc.text(val, 50 + colWidth + 5, rowY + 5, { width: colWidth - 10 });
          rowY += 20;
        }
      } else {
        // 2D table
        const rowDim = dimensions[0]!;
        const colDim = dimensions[1]!;
        const totalCols = colDim.members.length + 1;
        const colWidth = Math.min(pageWidth / totalCols, 120);
        const tableTop = doc.y;

        // Header row
        doc.rect(50, tableTop, pageWidth, 22).fill(primaryColor);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
        doc.text(rowDim.name, 55, tableTop + 6, { width: colWidth - 10 });

        for (let ci = 0; ci < colDim.members.length; ci++) {
          const colMember = colDim.members[ci]!;
          doc.text(
            colMember.name,
            50 + colWidth * (ci + 1) + 5,
            tableTop + 6,
            { width: colWidth - 10 },
          );
        }

        doc.fillColor('#333333').font('Helvetica').fontSize(8);
        let rowY = tableTop + 22;

        for (let ri = 0; ri < rowDim.members.length; ri++) {
          const rowMember = rowDim.members[ri]!;
          if (rowY > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
          }

          if (ri % 2 === 0) {
            doc.rect(50, rowY, pageWidth, 18).fill('#f8fafc');
            doc.fillColor('#333333');
          }

          doc.font('Helvetica-Bold').text(rowMember.name, 55, rowY + 4, { width: colWidth - 10 });
          doc.font('Helvetica');

          for (let ci = 0; ci < colDim.members.length; ci++) {
            const colMember = colDim.members[ci]!;
            const cell = findCellForMembers(
              cells,
              rowMember.code || rowMember.name,
              colMember.code || colMember.name,
            );
            const val = cell ? getCellDisplayValue(cell, formatType) : '';
            doc.text(val, 50 + colWidth * (ci + 1) + 5, rowY + 4, { width: colWidth - 10 });
          }

          rowY += 18;
        }
      }

      // --- Footer ---
      const bottomY = doc.page.height - 40;
      doc.fontSize(7).fillColor('#aaaaaa');
      doc.text('Generated by Planning Platform', 50, bottomY, {
        width: pageWidth,
        align: 'center',
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
