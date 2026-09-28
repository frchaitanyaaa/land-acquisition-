import PDFDocument from 'pdfkit';

/** Renders an MIS report's rows (§24.4) as a simple tabular PDF — same rows the CSV export uses. */
export function renderReportPdf(type: string, data: Array<Record<string, unknown>>, generatedAt: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(14).text(`BhoomiSetu — ${type}`, { continued: false });
    doc.fontSize(8).fillColor('#666').text(`Generated ${generatedAt.toISOString()}`);
    doc.moveDown(0.5).fillColor('#000');

    if (!data.length) {
      doc.fontSize(10).text('No rows match the current filters.');
      doc.end();
      return;
    }

    const cols = Object.keys(data[0]!);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / cols.length;
    const cell = (v: unknown): string =>
      v === null || v === undefined
        ? ''
        : typeof v === 'bigint'
          ? v.toString()
          : v instanceof Date
            ? v.toISOString()
            : typeof v === 'object'
              ? JSON.stringify(v)
              : String(v);

    const rowHeight = 16;
    let y = doc.y;
    doc.fontSize(7).font('Helvetica-Bold');
    cols.forEach((c, i) => doc.text(c, doc.page.margins.left + i * colWidth, y, { width: colWidth - 4 }));
    y += rowHeight;
    doc.font('Helvetica');

    for (const row of data) {
      if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      cols.forEach((c, i) =>
        doc.text(cell(row[c]), doc.page.margins.left + i * colWidth, y, { width: colWidth - 4, ellipsis: true }),
      );
      y += rowHeight;
    }
    doc.end();
  });
}
