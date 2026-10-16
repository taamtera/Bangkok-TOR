import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { httpError } from '../utils/http-error.mjs';

const script = fileURLToPath(new URL('../../matching/engine.py', import.meta.url));
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

// Fixed executable/script; no shell interpolation, API credentials, or DB URI
// are passed to the pure Python worker.
export async function runPythonMatching(payload) {
  return new Promise((resolve, reject) => {
    const executable = process.env.MATCHING_PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'python' : 'python3');
    const child = spawn(executable, [script], {
      shell: false, windowsHide: true,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
        PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(httpError(503, 'MATCHING_ENGINE_UNAVAILABLE', 'Matching is temporarily unavailable. Your company profile remains saved.'));
    };
    const timer = setTimeout(fail, 15000);
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.stderr.resume(); // Never log company input or worker tracebacks.
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) { fail(); return; }
      chunks.push(chunk);
    });
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) { fail(); return; }
      try {
        const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (result.policyVersion !== 3 || !Array.isArray(result.items)) { fail(); return; }
        settled = true;
        clearTimeout(timer);
        resolve(result);
      } catch { fail(); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
