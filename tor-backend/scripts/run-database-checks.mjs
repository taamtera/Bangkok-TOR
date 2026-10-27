import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['--test', 'tests/backend-schema.integration.test.mjs', 'tests/registration.integration.test.mjs'], {
  stdio: 'inherit', windowsHide: true, env: { ...process.env, BACKEND_DB_TEST: '1', AUTH_REGISTRATION_DB_TEST: '1' }
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
