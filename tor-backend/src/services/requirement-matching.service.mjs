import { findCompanyForMatching, findLatestTorVersions, listActiveTagsForMatching,
  listCompaniesForMatching, listRequirementEvaluations, listTorsForMatching, saveCompanyMatches } from '../repositories/match.repository.mjs';
import { serializeTor } from '../serializers/tor.serializer.mjs';
import { httpError } from '../utils/http-error.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { prepareMatchingTors } from './requirement-input.mjs';
import { runPythonMatching } from './python-matching.mjs';

async function context(tors = null) {
  const projects = tors || await listTorsForMatching();
  const ids = projects.map(({ _id }) => _id);
  const [tags, versions, evaluations] = await Promise.all([
    listActiveTagsForMatching(), findLatestTorVersions(ids), listRequirementEvaluations(ids)
  ]);
  return { activeTags: tags, tors: prepareMatchingTors(projects, tags, versions, evaluations) };
}

function companyInput(company) {
  return { _id: company._id, technologies: company.technologies || [],
    qualifications: company.qualifications || [], tagAssignments: company.tagAssignments || [] };
}

function workerInput(companies, source) {
  return { companies: companies.map(companyInput),
    activeTags: source.activeTags.map(({ _id, name, aliases, conceptKey }) => ({ _id, name, aliases, conceptKey })),
    tors: source.tors.map(({ _id, matchingVersion, matchingRequirements }) =>
      ({ _id, matchingVersion, matchingRequirements })) };
}

async function calculate(companies, source) {
  if (!companies.length || !source.tors.length) return [];
  const result = await runPythonMatching(workerInput(companies, source));
  const computedAt = new Date();
  const records = result.items.map((item) => ({ ...item, computedAt,
    companyId: toObjectId(item.companyId, 'companyId'), torId: toObjectId(item.torId, 'torId') }));
  // Save zero and unavailable results as well: profile edits must overwrite a
  // previous positive match instead of leaving stale recommendations in storage.
  await saveCompanyMatches(records);
  return records;
}

export async function getCompanyMatches(companyId, { page = 1, limit = 20, projectId } = {}) {
  if (!companyId) throw httpError(403, 'COMPANY_REQUIRED', 'A company profile is required to view matches.');
  const company = await findCompanyForMatching(companyId);
  if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'The company does not exist.');
  const source = await context();
  const records = await calculate([company], source);
  const torsById = new Map(source.tors.map((tor) => [tor._id.toString(), tor]));
  const compared = records.filter((record) => record.status === 'compared'
    && (!projectId || torsById.get(record.torId.toString()).projectId === projectId));
  compared.sort((a, b) => b.score - a.score || String(a.torId).localeCompare(String(b.torId)));
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  return {
    resultType: 'requirement_match', engine: 'python-rules', policyVersion: 3,
    items: compared.slice((safePage - 1) * safeLimit, safePage * safeLimit).map((record) => {
      const { companyId: _companyId, torId: _torId, companyCapabilities: _capabilities, ...publicMatch } = record;
      return { ...publicMatch, tor: serializeTor(torsById.get(record.torId.toString())) };
    }),
    pagination: { page: safePage, limit: safeLimit, total: compared.length,
      totalPages: Math.ceil(compared.length / safeLimit) }
  };
}

export async function getAiRecommendationInput(companyId) {
  if (!companyId) throw httpError(403, 'COMPANY_REQUIRED', 'A company profile is required.');
  const company = await findCompanyForMatching(companyId);
  if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'The company does not exist.');
  const source = await context();
  const records = await calculate([company], source);
  const byId = new Map(source.tors.map((tor) => [tor._id.toString(), tor]));
  return {
    schemaVersion: 1, policyVersion: 3, resultType: 'ai_recommendation_input',
    company: { id: company._id.toString(), name: company.displayName || company.legalName,
      technologies: company.technologies || [], qualifications: (company.qualifications || []).map((item) =>
        typeof item === 'string' ? item : { name: item.name, evidenceUrl: item.evidenceUrl || null }) },
    projects: records.filter((record) => record.status === 'compared').map((record) => {
      const tor = byId.get(record.torId.toString());
      const { companyId: _companyId, torId: _torId, ...matching } = record;
      return { projectId: tor.projectId, torVersion: record.torVersion,
        title: tor.title, description: tor.description, budget: tor.budget || null,
        submissionDeadline: tor.submissionDeadline || null,
        sourceUrl: tor.documentUrl || tor.url || null, matching };
    })
  };
}

export async function refreshCompanyRequirementMatches(companyId) {
  await getCompanyMatches(companyId, { page: 1, limit: 1 });
}

export async function refreshTorRequirementMatches(tor) {
  if (!tor?._id) return;
  const [companies, source] = await Promise.all([listCompaniesForMatching(), context([tor])]);
  for (let offset = 0; offset < companies.length; offset += 100) {
    await calculate(companies.slice(offset, offset + 100), source);
  }
}
