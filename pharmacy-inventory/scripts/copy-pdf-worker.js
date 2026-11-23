const fs = require('node:fs');
const path = require('node:path');

const pdfjsEntry = require.resolve('pdfjs-dist');
const workerSource = path.join(path.dirname(pdfjsEntry), 'pdf.worker.min.mjs');
const workerDestination = path.resolve(__dirname, '../public/pdf.worker.min.mjs');

if (!fs.existsSync(workerSource)) {
  throw new Error(`PDF.js worker was not found at ${workerSource}`);
}

fs.copyFileSync(workerSource, workerDestination);
