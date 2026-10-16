import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { httpError } from '../utils/http-error.mjs';
import { getDatabase } from '../config/database.mjs';
import { findLatestTorVersions } from '../repositories/match.repository.mjs';
import { findTorByProjectId } from '../repositories/tor.repository.mjs';

export function allowedRequirementUrl(value) {
  try {
    const url = new URL(value);
    if (!['process.gprocurement.go.th', 'process5.gprocurement.go.th'].includes(url.hostname)
      || url.username || url.password || (url.port && url.port !== (url.protocol === 'http:' ? '80' : '443'))) return null;
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url : null;
  } catch { return null; }
}
export async function fetchRequirementPdf(value, fetcher = fetch) {
  let url = allowedRequirementUrl(value);
  if (!url) throw httpError(403, 'DOCUMENT_HOST_NOT_ALLOWED', 'This document host is not supported by the requirements integration.');
  const signal = AbortSignal.timeout(20000);
  let response;
  for (let count = 0; count <= 5; count++) {
    response = await fetcher(url.href, { redirect: 'manual', signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location'); await response.body?.cancel();
    url = location ? allowedRequirementUrl(new URL(location, url).href) : null;
    if (!url) throw httpError(403, 'DOCUMENT_HOST_NOT_ALLOWED', 'The document redirect is not allowed.');
  }
  if (!response?.ok) throw httpError(502, 'DOCUMENT_UNAVAILABLE', 'The source document is unavailable.');
  const chunks = []; let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > 20 * 1024 * 1024) throw httpError(413, 'DOCUMENT_TOO_LARGE', 'The PDF exceeds 20 MB.');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw httpError(415, 'PDF_REQUIRED', 'The requirements integration currently needs a PDF document.');
  return { bytes, resolvedUrl: url.href, documentHash: createHash('sha256').update(bytes).digest('hex') };
}
export function extractPdfPages(bytes) {
  return new Promise((resolve, reject) => {
    const worker = spawn(process.execPath, ['--max-old-space-size=256', fileURLToPath(new URL('./pdf-text-worker.mjs', import.meta.url))], {
      windowsHide: true, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, stdio: ['pipe', 'pipe', 'ignore']
    });
    const chunks = []; let length = 0; let settled = false;
    const timer = setTimeout(() => fail(), 30000);
    function fail() {
      if (settled) return; settled = true; clearTimeout(timer); worker.kill();
      reject(httpError(422, 'PDF_TEXT_UNAVAILABLE', 'PDF text could not be prepared. Scanned documents may require OCR integration.'));
    }
    worker.stdout.on('data', (chunk) => { length += chunk.length; if (length > 3 * 1024 * 1024) return fail(); chunks.push(chunk); });
    worker.on('error', fail); worker.stdin.on('error', fail);
    worker.on('close', (code) => {
      if (settled) return;
      if (code !== 0) return fail();
      try {
        const output = Buffer.concat(chunks).toString('utf8');
        const marker = output.lastIndexOf('\nTOR_SOURCE_JSON:');
        if (marker < 0) return fail();
        const pages = JSON.parse(output.slice(marker + 17));
        if (!pages.some((page) => page.text.trim().length >= 15)) return fail();
        settled = true; clearTimeout(timer); resolve(pages);
      } catch { fail(); }
    });
    worker.stdin.end(bytes);
  });
}
export async function prepareRequirementSource(projectId) {
  const db = getDatabase();
  const tor = await findTorByProjectId(projectId);
  if (!tor) throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  const sourceUrl = tor.documentUrl || tor.url;
  const version = (await findLatestTorVersions([tor._id])).get(String(tor._id)) ?? tor.version ?? tor.torVersion ?? 1;
  const pdf = await fetchRequirementPdf(sourceUrl);
  const filter = { torId: tor._id, torVersion: version, sourceUrl, documentHash: pdf.documentHash };
  let snapshot = await db.collection('requirement_sources').findOne(filter);
  if (!snapshot) {
    const pages = await extractPdfPages(pdf.bytes);
    const now = new Date();
    snapshot = await db.collection('requirement_sources').findOneAndUpdate(filter, { $setOnInsert: {
      ...filter, pages, resolvedUrl: pdf.resolvedUrl, fetchedAt: now, createdAt: now
    } }, { upsert: true, returnDocument: 'after' });
  }
  const result = await db.collection('tor_announcements').updateOne({ _id: tor._id,
    ...(tor.documentUrl ? { documentUrl: sourceUrl } : { url: sourceUrl }) }, {
    $set: { requirementSource: { snapshotId: snapshot._id, documentHash: snapshot.documentHash, sourceUrl, torVersion: version } }
  });
  if (!result.matchedCount) throw httpError(409, 'AI_SOURCE_STALE', 'The source URL changed during preparation.');
  return { sourceId: String(snapshot._id), projectId, torVersion: version, sourceUrl,
    documentHash: snapshot.documentHash, fetchedAt: snapshot.fetchedAt, pages: snapshot.pages };
}
