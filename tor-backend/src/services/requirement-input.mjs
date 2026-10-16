import { env } from '../config/env.mjs';
import { conceptForTag } from './tag-catalog.mjs';

function reviewedRequirements(tor, tagsById) {
  return (tor.tagAssignments || []).filter((assignment) => assignment.reviewStatus === 'approved'
    && ['required', 'preferred', 'informational'].includes(assignment.requirementLevel)
    && typeof assignment.evidence === 'string' && assignment.evidence.trim()
    && tagsById.has(assignment.tagId?.toString())).map((assignment, index) => ({
      key: `tag-${assignment.tagId}-${index}`, tagId: assignment.tagId.toString(),
      text: tagsById.get(assignment.tagId.toString()).name,
      importance: assignment.requirementLevel, sourceType: 'reviewed_requirement',
      evidence: assignment.evidence,
      sourceUrl: assignment.sourceDocumentUrl || tor.documentUrl || tor.url || null,
      sourcePage: assignment.sourcePage == null ? null : String(assignment.sourcePage)
    }));
}

export function prepareMatchingTors(tors, tags, versions, evaluations) {
  const tagsById = new Map(tags.map((tag) => [tag._id.toString(), tag]));
  return tors.map((tor) => {
    const version = versions.get(tor._id.toString()) ?? tor.version ?? tor.torVersion ?? 1;
    // The existing seed is the only accepted demo input. A completed AI record
    // or a title mention alone is not proof of extracted tender requirements.
    const demo = env.demoMatchingEnabled && tor.projectId === 'BMA-DHR-2026-001'
      ? evaluations.find((row) => row.torId.toString() === tor._id.toString()
        && row.torVersion === version && row.status === 'completed'
        && row.requirements?.length && row.requirements.every((requirement) =>
          requirement.evidence?.excerpt === 'Demo evidence text')) : null;
    const extracted = evaluations.find((row) => String(row.torId) === String(tor._id)
      && row.torVersion === version && row.validation?.status === 'passed'
      && row.validation?.method === 'source_quote_v1'
      && row.validation.sourceUrl === (tor.documentUrl || tor.url)
      && String(row.validation.sourceId) === String(tor.requirementSource?.snapshotId)
      && row.validation.documentHash === tor.requirementSource?.documentHash);
    const requirements = extracted ? extracted.requirements.map((item) => {
      const clauses = item.clauses.map((clause) => ({ anyOf: clause.anyOfTagIds.map((id) => {
        const tag = tagsById.get(String(id));
        return tag && !tag.matchingExcluded ? conceptForTag(tag) : `unavailable:${id}`;
      }) }));
      return { key: item.key, text: item.text, importance: item.importance, clauses,
        sourceType: extracted.validation.dataMode === 'demo' ? 'demo' : 'ai_extracted_requirement',
        evidence: item.evidence.excerpt, sourceUrl: item.evidence.sourceUrl, sourcePage: String(item.evidence.page) };
    }).filter(Boolean) : demo ? demo.requirements.map((item, index) => ({
      key: item.key || `demo-${index}`, text: item.text,
      importance: ['required', 'preferred', 'informational'].includes(item.importance) ? item.importance : 'required',
      sourceType: 'demo', evidence: 'Demo requirement; not extracted from an official tender.',
      sourceUrl: null, sourcePage: null
    })).filter((item) => typeof item.text === 'string' && item.text.trim())
      : reviewedRequirements(tor, tagsById);
    return { ...tor, matchingVersion: version, matchingRequirements: requirements };
  });
}
