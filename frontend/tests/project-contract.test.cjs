const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the actual pure TypeScript helpers in memory, without a Next.js server.
function loadHelper(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/lib', name + '.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const helper = new Module(filename, module);
  helper.filename = filename;
  helper.paths = module.paths;
  const originalRequire = helper.require.bind(helper);
  helper.require = name => dependencies[name] ?? originalRequire(name);
  helper._compile(source, filename);
  return helper.exports;
}
const api = loadHelper('torApi', { './api': loadHelper('api') });
const presentation = loadHelper('torPresentation');

test('project mapping preserves source strings and does not recreate removed fields', () => {
  const removed = ['opend', 'opendLookup', 'province', 'district', 'subdistrict', 'projectLocation', 'projectMoney', 'referencePrice', 'totalContractValue', 'contractProjectStatus', 'contracts', 'opendUpdatedAt', 'locationFilter'];
  const legacy = Object.fromEntries(removed.map(field => [field, { stale: 'data' }]));
  const project = api.toTorContract({ ...legacy, projectId: '00123456789', _id: 'internal', departmentId: '0001',
    itemParams: { templateId: 'raw-template' }, budget: { maxAmount: 0 }, status: 'invitation_published' });
  assert.equal(project.id, '00123456789');
  assert.equal(project.departmentId, '0001');
  assert.equal(project.price, 0);
  assert.equal(project.priceFormatted, '0 THB');
  assert.equal(project.thumbnail, '/api/thumbnail/00123456789');
  assert.equal(project.status, 'invitation_published');
  assert.equal(project.itemParams.templateId, 'raw-template');
  for (const field of removed) assert.equal(field in project, false);
  const missing = api.toTorContract({ projectId: 'P69100015073' });
  assert.equal(missing.identityScope, 'plan');
  assert.equal(missing.price, null);
  for (const field of removed) assert.equal(field in missing, false);
  assert.throws(() => api.toTorContract({ projectId: 123 }), /Project ID/);
});

test('same-day stages display and filter individually, excluding older observations', () => {
  const project = api.toTorContract({ projectId: '123', status: 'multiple_announcements_same_day',
    statusOrderAmbiguous: true, statusPublishedAt: '2026-10-08', stageObservations: {
      D0: { publishedAt: '2026-10-08' }, W1: { publishedAt: '2026-10-08' }, B0: { publishedAt: '2026-10-01' }
    } });
  assert.deepEqual(presentation.getLatestStageCodes(project), ['D0', 'W1']);
  assert.equal(presentation.matchesStage(project, 'D0'), true);
  assert.equal(presentation.matchesStage(project, 'W1'), true);
  assert.equal(presentation.matchesStage(project, 'B0'), false);
  assert.equal(presentation.matchesStage(project, 'multiple_announcements_same_day'), true);
  assert.equal(presentation.getStatusLabel('invitation_published'), 'Invitation Published');
  assert.deepEqual(presentation.getLatestStageCodes(api.toTorContract({ projectId: 'missing' })), []);
});

test('project discovery requests only the selected page and preserves query strings', async () => {
  const originalFetch = global.fetch;
  const pages = [];
  global.fetch = async (url, options) => {
    pages.push(url);
    assert.equal(options.cache, 'no-store');
    const page = new URL(url).searchParams.get('page');
    return { ok: true, json: async () => ({ items: [{ projectId: page === '1' ? '00001' : '00002' }], pagination: { total: 2, totalPages: 2 } }) };
  };
  try {
    const result = await api.listTors({page: 2, departmentId: '0001', search: 'software IT'});
    assert.deepEqual(result.items.map(project => project.id), ['00002']);
    assert.equal(pages.length, 1);
    assert.equal(new URL(pages[0]).searchParams.get('departmentId'), '0001');
  } finally { global.fetch = originalFetch; }
});

test('project discovery skips records with invalid IDs instead of failing the entire page', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({
    items: [{ projectId: null }, { projectId: '   ' }, { projectId: '00042' }],
    pagination: { total: 3, totalPages: 1 }
  }) });
  try {
    const result = await api.listTors();
    assert.deepEqual(result.items.map(project => project.projectId), ['00042']);
    assert.equal(result.total, 3);
  } finally { global.fetch = originalFetch; }
});
