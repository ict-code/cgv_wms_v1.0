import PDFDocument from 'pdfkit';

const BRAND_BLUE = '#206bc4';
const ROW_ALT = '#f1f5f9';
const TEXT_DARK = '#0f172a';
const TEXT_MUTED = '#64748b';
const ROW_HEIGHT = 20;

export function toPdf(title: string, headers: string[], rows: (string | number | null | undefined)[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: headers.length > 6 ? 'landscape' : 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).fillColor(TEXT_DARK).text(title);
    doc.fontSize(9).fillColor(TEXT_MUTED).text(`Generated ${new Date().toLocaleString()}`);
    doc.moveDown(1);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / headers.length;

    function drawRow(values: (string | number | null | undefined)[], y: number, isHeader: boolean) {
      if (isHeader) {
        doc.rect(doc.page.margins.left, y, pageWidth, ROW_HEIGHT).fill(BRAND_BLUE);
      }
      doc.fontSize(8).fillColor(isHeader ? '#ffffff' : TEXT_DARK);
      values.forEach((v, i) => {
        doc.text(v === null || v === undefined ? '' : String(v), doc.page.margins.left + i * colWidth + 4, y + 6, {
          width: colWidth - 8,
          height: ROW_HEIGHT,
          ellipsis: true,
          lineBreak: false,
        });
      });
    }

    let y = doc.y;
    drawRow(headers, y, true);
    y += ROW_HEIGHT;

    rows.forEach((row, idx) => {
      if (y + ROW_HEIGHT > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawRow(headers, y, true);
        y += ROW_HEIGHT;
      }
      if (idx % 2 === 1) {
        doc.rect(doc.page.margins.left, y, pageWidth, ROW_HEIGHT).fill(ROW_ALT);
      }
      drawRow(row, y, false);
      y += ROW_HEIGHT;
    });

    if (rows.length === 0) {
      doc.fontSize(9).fillColor(TEXT_MUTED).text('No records for the selected filters.', doc.page.margins.left, y + 6);
    }

    doc.end();
  });
}
