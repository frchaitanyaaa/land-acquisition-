// Writes the synthetic sample award used to demo award entry with OCR assist (CLAUDE.md §20, §26.3):
//   data/demo-docs/sample-award-MH-SIN.pdf and apps/portal/public/demo/sample-award-MH-SIN.pdf
// Run: pnpm --filter @bhoomisetu/api demo:award-pdf
//
// A supplementary LAND award for MH-SIN-2025-004 (Satara Industrial Node): asset values found in the joint
// inspection for three families, with solatium on them. One solatium line is deliberately short so the pack's
// SOLATIUM_100 check visibly flags it on the award page. All amounts are synthetic (G18) and live only in this
// generated document — the system never computes them (G1).
//
// The OCR job reads lines of the form `FAMILY: <affectedFamilyId> HEAD: <headCode> AMOUNT: <rupees>`
// (apps/api/src/jobs/ocr-extract.ts). Family ids are deterministic seed ids (SEED=26016, seedId() in
// packages/db/src/scripts/seed/index.ts); if the seed changes them, update FAMILIES and re-run.
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = [
  join(root, 'data/demo-docs/sample-award-MH-SIN.pdf'),
  join(root, 'apps/portal/public/demo/sample-award-MH-SIN.pdf'),
];

const FAMILIES = [
  {
    id: '06895042-6547-4fc3-ac6b-cadd999cb6fe',
    name: 'Asha Kadam',
    survey: '209',
    found: '11 mango trees and one open well',
    assets: '185000.00',
    solatium: '185000.00',
  },
  {
    id: '08e11597-b96e-4825-b6bf-979bd08f8ef9',
    name: 'Ramesh Nikam',
    survey: '218',
    found: 'cattle shed (tin roof, 24 sq m)',
    assets: '42500.00',
    solatium: '40000.00', // deliberately short: the SOLATIUM_100 check flags this family
  },
  {
    id: '0c99b0f7-5476-4bec-84c7-bdbe569bcc4d',
    name: 'Geeta Bhosale',
    survey: '182/1',
    found: 'borewell with pump and 120 m irrigation pipe',
    assets: '96000.00',
    solatium: '96000.00',
  },
];

const inr = (s) => Number(s).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function build(path) {
  mkdirSync(dirname(path), { recursive: true });
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Supplementary award (synthetic demo)' } });
  doc.pipe(createWriteStream(path));

  doc.rect(0, 0, doc.page.width, 22).fill('#b45309');
  doc
    .fill('#ffffff')
    .fontSize(9)
    .text('SYNTHETIC DEMO DOCUMENT — NOT A REAL AWARD — BhoomiSetu prototype (SIH 26016)', 56, 7);
  doc.fill('#111111').moveDown(2);

  doc.fontSize(15).text('OFFICE OF THE LAND ACQUISITION OFFICER, SATARA', { align: 'center' });
  doc.fontSize(11).text('Supplementary award under section 23, RFCTLARR Act, 2013', { align: 'center' }).moveDown();
  doc.fontSize(10);
  doc.text('AWARD NO: MH-SIN-2025-004/LAND/2');
  doc.text('Project: MH-SIN-2025-004 — Satara Industrial Node (Village Pargaon, Taluka Khandala, District Satara)');
  doc.text('Ground: assets on the acquired land recorded in the joint inspection after the original award.').moveDown();

  for (const f of FAMILIES) {
    doc.font('Helvetica-Bold').text(`${f.name} — Survey no. ${f.survey}, Pargaon`);
    doc
      .font('Helvetica')
      .text(`Assets found: ${f.found}. Value of assets Rs ${inr(f.assets)}; solatium Rs ${inr(f.solatium)}.`);
    doc.text(`FAMILY: ${f.id} HEAD: ASSETS AMOUNT: ${f.assets}`);
    doc.text(`FAMILY: ${f.id} HEAD: SOLATIUM AMOUNT: ${f.solatium}`).moveDown();
  }

  doc.moveDown().text('Sd/- Land Acquisition Officer, Satara (synthetic)');
  doc.text('All names, survey numbers and amounts in this document are synthetic demo data.');
  doc.end();
}

for (const path of OUT) build(path);
console.log(`wrote ${OUT.join(' and ')}`);
