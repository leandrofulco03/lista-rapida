// En las pruebas (Node) no hay Web Workers: pdf.js corre en el mismo hilo con su motor cargado acá.
const globalPdf = globalThis as { pdfjsWorker?: unknown };
globalPdf.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');

export {};
