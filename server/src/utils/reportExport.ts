import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface ReportColumn<T> {
  key: string;
  label: string;
  /** Custom rendering; defaults to `row[key]` when omitted. */
  formatter?: (row: T) => string | number | boolean | null | undefined;
}

function cellValue<T>(column: ReportColumn<T>, row: T): string | number | boolean | null | undefined {
  return column.formatter ? column.formatter(row) : (row as Record<string, unknown>)[column.key] as never;
}

function escapeCsvCell(value: unknown): string {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv<T>(columns: ReportColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(cellValue(c, row))).join(','));
  return [header, ...lines].join('\r\n');
}

export async function toExcelBuffer<T>(
  columns: ReportColumn<T>[],
  rows: T[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel sheet-name length limit

  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: 20 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const record: Record<string, unknown> = {};
    for (const c of columns) record[c.key] = cellValue(c, row);
    sheet.addRow(record);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** A simple paginated table renderer — generic across all report types. */
export function buildTablePdf<T>(
  title: string,
  columns: ReportColumn<T>[],
  rows: T[],
): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    layout: columns.length > 6 ? 'landscape' : 'portrait',
  });

  doc.fontSize(16).text(title);
  doc.moveDown();

  const left = 40;
  const usableWidth = doc.page.width - left * 2;
  const colWidth = usableWidth / columns.length;
  const bottomLimit = doc.page.height - 60;

  function drawHeader(): number {
    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    columns.forEach((c, i) => doc.text(c.label, left + i * colWidth, y, { width: colWidth }));
    y += 16;
    doc.moveTo(left, y).lineTo(doc.page.width - left, y).stroke();
    doc.font('Helvetica');
    return y + 6;
  }

  let y = drawHeader();
  for (const row of rows) {
    if (y > bottomLimit) {
      doc.addPage();
      y = drawHeader();
    }
    columns.forEach((c, i) => {
      const value = cellValue(c, row);
      doc.fontSize(8).text(value === undefined || value === null ? '' : String(value), left + i * colWidth, y, {
        width: colWidth,
      });
    });
    y += 16;
  }

  return doc;
}
