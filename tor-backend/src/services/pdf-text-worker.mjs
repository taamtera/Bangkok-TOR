import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Separate bounded process: parsing source PDFs never receives DB credentials.
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const bytes = Buffer.concat(chunks);
const job = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false,
  disableFontFace: true, useSystemFonts: false });
try {
  const document = await job.promise;
  if (document.numPages > 200) throw new Error('PDF page limit exceeded');
  const pages = [];
  for (let page = 1; page <= document.numPages; page++) {
    const content = await (await document.getPage(page)).getTextContent();
    pages.push({ page, text: content.items.filter((item) => typeof item.str === 'string').map((item) => item.str + (item.hasEOL ? '\n' : ' ')).join('') });
  }
  process.stdout.write('\nTOR_SOURCE_JSON:' + JSON.stringify(pages));
} finally { await job.destroy(); }
