import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, degrees, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePdfPath = path.join(__dirname, 'fixtures', 'sample.pdf');

test('smoke test: load and inspect sample fixture PDF', async () => {
  const pdfBytes = fs.readFileSync(fixturePdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  assert.equal(pdfDoc.getPageCount(), 1);
});

test('smoke test: merge operation on fixture PDFs', async () => {
  const pdfBytes = fs.readFileSync(fixturePdfPath);
  const mergedPdf = await PDFDocument.create();

  const doc1 = await PDFDocument.load(pdfBytes);
  const doc2 = await PDFDocument.load(pdfBytes);

  const [page1] = await mergedPdf.copyPages(doc1, [0]);
  const [page2] = await mergedPdf.copyPages(doc2, [0]);

  mergedPdf.addPage(page1);
  mergedPdf.addPage(page2);

  assert.equal(mergedPdf.getPageCount(), 2);
  const savedBytes = await mergedPdf.save();
  assert.ok(savedBytes.length > 0);
});

test('smoke test: rotate operation on fixture PDF', async () => {
  const pdfBytes = fs.readFileSync(fixturePdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  
  const initialAngle = page.getRotation().angle;
  page.setRotation(degrees(initialAngle + 90));
  
  assert.equal(page.getRotation().angle, 90);
  const savedBytes = await pdfDoc.save();
  assert.ok(savedBytes.length > 0);
});

test('smoke test: watermark operation on fixture PDF', async () => {
  const pdfBytes = fs.readFileSync(fixturePdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPage(0);
  
  page.drawText('CONFIDENTIAL', {
    x: 50,
    y: 100,
    size: 24,
    color: rgb(1, 0, 0),
    opacity: 0.5,
  });

  const savedBytes = await pdfDoc.save();
  assert.ok(savedBytes.length > 0);
});
