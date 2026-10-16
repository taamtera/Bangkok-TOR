const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '../src', name);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = module.paths;
  cache.set(filename, compiled);
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = dependency => {
    // Load the distributed CommonJS icon bundle in memory; its package declares ESM.
    if (dependency === 'lucide-react') {
      const iconFile = require.resolve(dependency);
      const icons = new Module(iconFile, module);
      icons.filename = iconFile;
      icons.paths = module.paths;
      icons._compile(fs.readFileSync(iconFile, 'utf8'), iconFile);
      return icons.exports;
    }
    if (dependency.startsWith('@/') || dependency.startsWith('.')) {
      const target = dependency.startsWith('@/') ? dependency.slice(2) : path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), dependency));
      for (const extension of ['', '.ts', '.tsx', '.json']) {
        const resolved = path.resolve(__dirname, '../src', target + extension);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          return resolved.endsWith('.json') ? JSON.parse(fs.readFileSync(resolved, 'utf8')) : load(target + extension);
        }
      }
    }
    return originalRequire(dependency);
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename);
  return compiled.exports;
}
const { LanguageProvider } = load('lib/LanguageProvider.tsx');
const { FilterBar } = load('components/FilterBar.tsx');
const { Header } = load('components/Header.tsx');
const { AuthModal } = load('components/AuthModal.tsx');
const { DocumentPreview } = load('components/PDFReader.tsx');
const { ProjectObservations } = load('components/ProjectObservations.tsx');
const { ContractorServices } = load('components/ContractorServices.tsx');
const { companyDataToProfile, profileToCompanyData } = load('lib/userProfile.ts');
const { TORCard } = load('components/TORCard.tsx');
const { DEFAULT_FILTERS } = load('lib/discovery.ts');
const { toTorContract } = load('lib/torApi.ts');
const { procurementMethodLabel } = load('lib/translate.ts');
const render = (language, component, props) => renderToStaticMarkup(React.createElement(LanguageProvider,
  { initialLanguage: language }, React.createElement(component, props)));

test('contractor profile displays live contractorLabel values instead of project tag text', () => {
  const tags = [{ tagId: '6ad1754a40f2d3dadd04ffda', text: 'Internet Service', contractorLabel: 'Internet Service Provider' }];
  for (const language of ['en', 'th']) {
    const html = render(language, ContractorServices, { tags });
    assert.match(html, /Internet Service Provider/);
    assert.doesNotMatch(html, />Internet Service</);
  }
  assert.match(render('th', ContractorServices, { tags: [] }), /ยังไม่ได้เลือกบริการของผู้รับจ้าง/);
  assert.doesNotMatch(render('en', ContractorServices, { tags: [{ ...tags[0], contractorLabel: null }] }), /Internet Service Provider|>Internet Service</);
});

test('profile hydration keeps resolved labels but sends only tagId links when saving', () => {
  const base = { companyName: 'Example', properties: [], technologies: [] };
  const tags = [{ tagId: '6ad1754a40f2d3dadd04ffda', text: 'Internet Service', contractorLabel: 'Internet Service Provider' }];
  const profile = companyDataToProfile(base, { displayName: 'Example', companySize: '', district: '', qualifications: [], technologies: [], tags });
  assert.deepEqual(profile.tags, tags);
  assert.deepEqual(profileToCompanyData(profile).tags, [{ tagId: tags[0].tagId }]);
  assert.equal(Object.hasOwn(profileToCompanyData(base), 'tags'), false);
  assert.deepEqual(profileToCompanyData({ ...profile, tags: [] }).tags, []);
});

test('filters render one language while preserving original IDs and method values', () => {
  const props = { filters: { ...DEFAULT_FILTERS, datePreset: '7', status: 'D0', department: '0001' }, setFilters() {}, onResetFilters() {},
    onRefresh() {}, isLoading: false, resultCount: 1, departments: [{ value: '0001', name: 'Source department', count: 1 }],
    methods: [{ value: 'เฉพาะเจาะจง', count: 1 }] };
  const en = render('en', FilterBar, props), th = render('th', FilterBar, props);
  assert.match(en, /Search projects/);
  assert.match(en, /All Stages/);
  assert.match(en, /Last 7 Days/);
  assert.match(en, /Specific Selection/);
  assert.doesNotMatch(en, /วันล่าสุด|ทุกหน่วยงาน|ประกาศเชิญชวน/);
  assert.match(th, /ค้นหาโครงการ/);
  assert.match(th, /ทุกขั้นตอน/);
  assert.match(th, /7 วันล่าสุด/);
  assert.doesNotMatch(th, /Search projects|All Departments|Last 7 Days|Specific Selection/);
  for (const html of [en, th]) {
    assert.match(html, /Source department \(0001\)/);
    assert.match(html, /Source department/);
    assert.match(html, /value="เฉพาะเจาะจง"/);
  }
});

test('language selector and navigation use the selected language', () => {
  const props = { activeTab: 'find', currentUser: null, notificationCount: 0, themeMode: 'light', setActiveTab() {},
    onOpenAuth() {}, onLogout() {}, onOpenProfile() {}, onToggleTheme() {} };
  const en = render('en', Header, props), th = render('th', Header, props);
  assert.match(en, /aria-label="Language"/);
  assert.match(en, /value="en" lang="en" selected=""/);
  assert.match(en, /Find TORs/);
  assert.doesNotMatch(en, /ค้นหา TOR|เข้าสู่ระบบ/);
  assert.match(th, /aria-label="ภาษา"/);
  assert.match(th, /value="th" lang="th" selected=""/);
  assert.match(th, /ค้นหา TOR/);
  assert.doesNotMatch(th, /Find TORs|Log In/);
});

test('stage badges and detail labels translate without changing source announcements', () => {
  const project = toTorContract({ projectId: '00123', title: 'โครงการจากแหล่งข้อมูล', status: 'invitation_published',
    statusPublishedAt: '2026-10-08', stageObservations: { D0: { title: 'ประกาศต้นฉบับ', publishedAt: '2026-10-08' } } });
  const en = render('en', ProjectObservations, { project }), th = render('th', ProjectObservations, { project });
  assert.match(en, /Project announcement stages/);
  assert.match(en, /Invitation Published/);
  assert.doesNotMatch(en, /ขั้นตอนประกาศของโครงการ|ประกาศเชิญชวน/);
  assert.match(th, /ขั้นตอนประกาศของโครงการ/);
  assert.match(th, /ประกาศเชิญชวน/);
  assert.doesNotMatch(th, /Project announcement stages|Invitation Published/);
  for (const html of [en, th]) assert.match(html, /ประกาศต้นฉบับ/);
  assert.equal(procurementMethodLabel('เฉพาะเจาะจง', 'en'), 'Specific Selection');
  assert.equal(procurementMethodLabel('เฉพาะเจาะจง', 'th'), 'เฉพาะเจาะจง');
});

test('reference price and invitation published together render normally in cards and details', () => {
  const project = toTorContract({ projectId: '00123', title: 'Concurrent announcements',
    status: 'multiple_announcements_same_day', statusOrderAmbiguous: true,
    statusPublishedAt: '2026-10-09', stageObservations: {
      '15': { publishedAt: '2026-10-09' }, D0: { publishedAt: '2026-10-09' },
      B0: { publishedAt: '2026-10-01' }
    } });
  for (const [component, props] of [[TORCard, { contract: project, onSelect() {} }], [ProjectObservations, { project }]]) {
    const en = render('en', component, props);
    const th = render('th', component, props);
    assert.match(en, /Reference Price Published/);
    assert.match(en, /Invitation Published/);
    assert.match(th, /เผยแพร่ราคากลาง/);
    assert.match(th, /ประกาศเชิญชวน/);
    for (const html of [en, th]) {
      assert.doesNotMatch(html, /order unknown|ไม่ทราบลำดับ/);
    }
  }
  assert.match(render('en', TORCard, { contract: project, onSelect() {} }), /Multiple announcements/);
  assert.match(render('th', TORCard, { contract: project, onSelect() {} }), /หลายประกาศ/);
});

test('registration dialog has separate English and Thai labels', () => {
  const props = { isOpen: true, mode: 'signin', onClose() {}, onSuccess() {} };
  const en = render('en', AuthModal, props), th = render('th', AuthModal, props);
  assert.match(en, /Sign Up/);
  assert.match(en, /Confirm Password/);
  assert.doesNotMatch(en, /ลงทะเบียน|ยืนยันรหัสผ่าน|ชื่อบริษัท/);
  assert.match(th, /ลงทะเบียน/);
  assert.match(th, /ยืนยันรหัสผ่าน/);
  assert.doesNotMatch(th, /Sign Up|Confirm Password|Full Name/);
});

test('document popup uses a format-neutral frame and offers source and download actions', () => {
  const contract = toTorContract({ projectId: '00123', documentUrl: 'https://process.gprocurement.go.th/page.html', title: 'Source title' });
  const en = render('en', DocumentPreview, { contract, onDownload() {} });
  assert.match(en, /<iframe/);
  assert.match(en, /\/api\/tors\/documents\/00123/);
  assert.doesNotMatch(en, /<embed|type="application\/pdf"|00123\.pdf|sandbox=/);
  assert.match(en, /Open original document/);
  assert.match(en, /Download document/);
  const th = render('th', DocumentPreview, { contract, onDownload() {} });
  assert.match(th, /เปิดเอกสารต้นฉบับ/);
  assert.doesNotMatch(th, /Open original document/);
  const missing = render('en', DocumentPreview, { contract: toTorContract({ projectId: 'missing' }), onDownload() {} });
  assert.doesNotMatch(missing, /<iframe/);
  assert.match(missing, /No source document is available/);
});
