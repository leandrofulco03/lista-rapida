// F05: el motor de pdf.js corre en su propio Web Worker. Al cargarse dentro de un worker,
// pdf.js se conecta solo a los mensajes de este worker; por eso no puede compartir el de lectura.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
