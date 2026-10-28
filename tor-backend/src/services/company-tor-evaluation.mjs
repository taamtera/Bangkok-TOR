import { usableTorTagAssignment } from './tor-tag-eligibility.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database.mjs';
import { findCompanyProfileById } from '../repositories/company.repository.mjs';
import { findTorByProjectId } from '../repositories/tor.repository.mjs';
import { toCompanyProfile } from '../serializers/company.serializer.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { httpError } from '../utils/http-error.mjs';
import { postEvaluationWebhook } from './evaluation-webhook.mjs';

const records = () => getDatabase().collection('company_tor_evaluations');
let indexes;
const ensureIndexes = () => indexes ||= records().createIndex({ companyId: 1, projectId: 1, inputHash: 1 },
  { unique: true, name: 'uq_company_tor_evaluation_input' }).catch(error => { indexes = undefined; throw error; });
const timeoutMs = () => Math.min(7200000, Math.max(1000, Number(process.env.TOR_EVALUATION_TIMEOUT_MS) || 1920000));
const clean = (value, limit = 2000) => typeof value === 'string' ? value.slice(0, limit) : null;

export function buildEvaluationInput(company, tor) {
  const profile = toCompanyProfile(company);
  let remaining = 12000;
  const documents = (tor.documents || []).map(document => {
    const text = clean(document.extractedText, remaining) || '';
    remaining -= text.length;
    return { filename: document.filename ?? null, sourceFormat: document.sourceFormat ?? null,
      extractionStatus: document.extractionStatus ?? null, extractedText: text,
      documentHash: createHash('sha256').update(document.extractedText || '').digest('hex'),
      textTruncated: typeof document.extractedText === 'string' && document.extractedText.length > text.length };
  }).slice(0, 20);
  return {
    schemaVersion: 1,
    evaluationPolicyVersion: 1,
    company: { companyId: String(company._id), name: profile.displayName,
      legalName: company.legalName || profile.displayName, description: profile.description,
      companySize: profile.companySize, district: profile.district,
      qualifications: profile.qualifications, certifications: profile.certifications,
      technologies: profile.technologies, services: profile.tags.map(tag => ({ tagId: tag.tagId,
        text: tag.text, contractorLabel: tag.contractorLabel, category: tag.category, type: tag.type })) },
    tor: { projectId: tor.projectId, title: tor.title ?? null, description: clean(tor.description, 4000),
      departmentName: tor.departmentName ?? null, procurementMethod: tor.procurementMethod ?? null,
      status: tor.status ?? null, publishedAt: tor.publishedAt ?? null, statusPublishedAt: tor.statusPublishedAt ?? null,
      budget: tor.budget ?? null, projectStartAt: tor.projectStartAt ?? null, projectEndAt: tor.projectEndAt ?? null,
      submissionDeadline: tor.submissionDeadline ?? null, documentUrl: tor.documentUrl || tor.url || null,
      tags: (tor.tagAssignments || []).filter(tag => usableTorTagAssignment(tor, tag)).map(tag => ({ tagId: String(tag.tagId), text: tag.tagText ?? null,
        requirementLevel: tag.requirementLevel ?? null, evidence: clean(tag.evidence, 500) })),
      extractedRequirements: (tor.aiExtractedRequirements || []).slice(0, 40).map(item => ({
        text: clean(item.text, 500), category: item.category ?? null, requirementLevel: item.requirementLevel ?? null,
        evidence: clean(item.evidence, 500) })), documents },
    limitations: { companyInformationIsSelfReported: true, stageDoesNotConfirmOpenBidding: true,
      documentTextAvailable: documents.some(doc => doc.extractedText), documentTextTruncated: documents.some(doc => doc.textTruncated),
      budgetAvailable: tor.budget?.maxAmount != null || tor.budget?.minAmount != null }
  };
}

export function validateEvaluationResponse(body, inputHash) {
  if (body?.schemaVersion !== 1 || body.inputHash !== inputHash || !body.evaluation) {
    throw httpError(502, 'AI_EVALUATION_INVALID', 'The AI workflow returned an incompatible response.');
  }
  const value = body.evaluation;
  for (const field of ['priceScore', 'qualificationMatchScore']) {
    if (value[field] !== null && !(typeof value[field] === 'number' && Number.isFinite(value[field]) && value[field] >= 0 && value[field] <= 100)) {
      throw httpError(502, 'AI_EVALUATION_INVALID', `The AI workflow returned an invalid ${field}.`);
    }
  }
  for (const field of ['summary', 'priceAssessment', 'qualificationAnalysis', 'riskAnalysis']) {
    if (typeof value[field] !== 'string' || !value[field].trim() || value[field].length > 6000) {
      throw httpError(502, 'AI_EVALUATION_INVALID', `The AI workflow returned an invalid ${field}.`);
    }
  }
  if (!['Low', 'Medium', 'High', 'Unknown'].includes(value.riskLevel)) throw httpError(502, 'AI_EVALUATION_INVALID', 'The AI workflow returned an invalid risk level.');
  const result = Object.fromEntries(['summary', 'priceScore', 'priceAssessment', 'qualificationMatchScore',
    'qualificationAnalysis', 'riskLevel', 'riskAnalysis'].map(key => [key, value[key]]));
  for (const field of ['keyRequirementsExtracted', 'strengths', 'gaps', 'missingInformation']) {
    if (!Array.isArray(value[field]) || value[field].length > 100 || value[field].some(item => typeof item !== 'string' || item.length > 2000)) {
      throw httpError(502, 'AI_EVALUATION_INVALID', `The AI workflow returned an invalid ${field}.`);
    }
    result[field] = value[field];
  }
  return { ...result, aiModel: clean(body.model, 150) || 'Ollama', evaluatedAt: new Date().toISOString() };
}

export function evaluationMissingInformation(payload) {
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const company = payload.company;
  const hasProfile = hasText(company.description)
    || ['qualifications', 'certifications', 'technologies'].some(key => (company[key] || []).some(hasText))
    || (company.services || []).some(service => hasText(service.text) || hasText(service.contractorLabel));
  return [
    ...(!hasProfile ? ['Company description, qualifications, certifications, technologies or contractor services'] : []),
    ...(!(payload.tor.documents || []).some(document => hasText(document.extractedText)) ? ['Extracted TOR document text'] : [])
  ];
}

function publicResult(record) {
  return record ? { status: record.status, evaluation: record.status === 'completed' ? record.evaluation : null,
    error: record.status === 'failed' ? record.error : null } : { status: 'missing', evaluation: null, error: null };
}

async function run(record, payload) {
  try {
    const response = await postEvaluationWebhook(process.env.TOR_EVALUATION_WEBHOOK_URL,
      { ...payload, inputHash: record.inputHash, requestId: record.requestId },
      { timeoutMs: timeoutMs(), token: process.env.TOR_EVALUATION_WEBHOOK_TOKEN });
    if (response.status < 200 || response.status >= 300) throw httpError(502, 'AI_EVALUATION_UPSTREAM', `The evaluation workflow returned HTTP ${response.status}.`);
    const text = response.text;
    let body;
    try { body = JSON.parse(text); } catch { throw httpError(502, 'AI_EVALUATION_INVALID', 'The AI workflow returned unreadable JSON.'); }
    const evaluation = validateEvaluationResponse(body, record.inputHash);
    await records().updateOne({ _id: record._id, requestId: record.requestId }, {
      $set: { status: 'completed', evaluation, error: null, completedAt: new Date(), updatedAt: new Date() },
      $unset: { leaseExpiresAt: '' }
    });
  } catch (error) {
    const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
    await records().updateOne({ _id: record._id, requestId: record.requestId }, {
      $set: { status: 'failed', error: { code: timeout ? 'AI_EVALUATION_TIMEOUT' : error.code || 'AI_EVALUATION_UNAVAILABLE',
        message: timeout ? 'The evaluation timed out. Please retry.' : error.status ? error.message : 'The evaluation service could not be reached. Please retry.' },
      updatedAt: new Date() }, $unset: { leaseExpiresAt: '' }
    });
  }
}

export async function companyTorEvaluation(companyId, projectId, { start = false } = {}) {
  const [company, tor] = await Promise.all([findCompanyProfileById(companyId), findTorByProjectId(projectId)]);
  if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'The linked company profile does not exist.');
  if (!tor) throw httpError(404, 'TOR_NOT_FOUND', 'The TOR does not exist.');
  const payload = buildEvaluationInput(company, tor);
  const missingInformation = evaluationMissingInformation(payload);
  if (missingInformation.length) return { status: 'insufficient_data', evaluation: null, error: null, missingInformation };
  const inputHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const key = { companyId: toObjectId(companyId, 'companyId'), projectId, inputHash };
  await ensureIndexes();
  let record = await records().findOne(key);
  if (record?.status === 'processing' && record.leaseExpiresAt <= new Date()) {
    await records().updateOne({ _id: record._id, requestId: record.requestId, leaseExpiresAt: { $lte: new Date() } }, {
      $set: { status: 'failed', error: { code: 'AI_EVALUATION_INTERRUPTED', message: 'The evaluation was interrupted. Please retry.' }, updatedAt: new Date() }
    });
    record = await records().findOne(key);
  }
  if (!start || record?.status === 'completed' || record?.status === 'processing') return publicResult(record);
  if (!process.env.TOR_EVALUATION_WEBHOOK_URL) throw httpError(503, 'AI_EVALUATION_NOT_CONFIGURED', 'The company evaluation workflow is not configured.');
  const now = new Date(), requestId = randomUUID();
  if (!record) {
    try {
      const result = await records().insertOne({ ...key, torId: tor._id, status: 'processing', requestId,
        leaseExpiresAt: new Date(Date.now() + timeoutMs() + 60000), createdAt: now, updatedAt: now, evaluation: null, error: null });
      record = { _id: result.insertedId, ...key, requestId, status: 'processing' };
    } catch (error) { if (error.code === 11000) return publicResult(await records().findOne(key)); throw error; }
  } else {
    record = await records().findOneAndUpdate({ ...key, status: 'failed' }, { $set: { status: 'processing', requestId,
      error: null, leaseExpiresAt: new Date(Date.now() + timeoutMs() + 60000), updatedAt: now } }, { returnDocument: 'after' });
    if (!record) return publicResult(await records().findOne(key));
  }
  void run(record, payload).catch(() => console.error('Could not persist the company TOR evaluation result.'));
  return publicResult(record);
}
