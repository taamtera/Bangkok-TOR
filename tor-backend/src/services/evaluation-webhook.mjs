import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

// Use an explicit total deadline and socket timeout for long-running model calls.
// The browser polls the saved job and never holds this connection itself.
export function postEvaluationWebhook(url, payload, { timeoutMs, token } = {}) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(url);
    if (!['https:', 'http:'].includes(endpoint.protocol)) throw new Error('Invalid evaluation webhook protocol.');
    const data = Buffer.from(JSON.stringify(payload));
    const headers = { 'content-type': 'application/json', 'content-length': data.length };
    if (token) headers['x-evaluation-token'] = token;
    let settled = false;
    let deadline;
    const finish = (error, result) => {
      if (settled) return;
      settled = true; clearTimeout(deadline);
      if (error) reject(error); else resolve(result);
    };
    const request = (endpoint.protocol === 'https:' ? httpsRequest : httpRequest)(endpoint, {
      method: 'POST', headers, timeout: timeoutMs
    }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 200000) {
          const error = new Error('The AI response was too large.');
          error.status = 502; error.code = 'AI_EVALUATION_INVALID';
          finish(error); request.destroy(); response.destroy(); return;
        }
        chunks.push(chunk);
      });
      response.on('error', error => finish(error));
      response.on('end', () => finish(null, { status: response.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    const timeout = () => {
      const error = new Error('The evaluation timed out.'); error.name = 'TimeoutError';
      finish(error); request.destroy(error);
    };
    request.on('timeout', timeout);
    request.on('error', error => finish(error));
    deadline = setTimeout(timeout, timeoutMs);
    request.end(data);
  });
}
