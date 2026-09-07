import ExcelJS from 'exceljs';

export async function toXlsx(sheetName: string, headers: string[], rows: (string | number | null | undefined)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row.map((v) => v ?? ''));
  sheet.columns.forEach((col) => {
    col.width = 20;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
