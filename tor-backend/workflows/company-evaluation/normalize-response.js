const request = $('Build Evaluation Prompt').first().json;
try {
  if ($json.error || !$json.message?.content) throw new Error('The model did not return evaluation content.');
  const content = $json.message.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const evaluation = JSON.parse(content);
  for (const field of request.evaluationSchema.required) {
    if (!(field in evaluation)) throw new Error(`Missing field: ${field}`);
  }
  for (const field of ['priceScore', 'qualificationMatchScore']) {
    if (evaluation[field] !== null && !(typeof evaluation[field] === 'number' && Number.isFinite(evaluation[field]) && evaluation[field] >= 0 && evaluation[field] <= 100)) {
      throw new Error(`Invalid score: ${field}`);
    }
  }
  if (!['Low', 'Medium', 'High', 'Unknown'].includes(evaluation.riskLevel)) throw new Error('Invalid risk level.');
  for (const field of ['summary', 'priceAssessment', 'qualificationAnalysis', 'riskAnalysis']) {
    if (typeof evaluation[field] !== 'string' || !evaluation[field].trim()) throw new Error(`Invalid text: ${field}`);
  }
  for (const field of ['keyRequirementsExtracted', 'strengths', 'gaps', 'missingInformation']) {
    if (!Array.isArray(evaluation[field]) || evaluation[field].some(item => typeof item !== 'string')) throw new Error(`Invalid list: ${field}`);
  }
  return [{ json: { statusCode: 200, body: { schemaVersion: 1, requestId: request.requestId,
    inputHash: request.inputHash, projectId: request.projectId, companyId: request.companyId,
    model: $json.model || 'qwen3.5:9bu', evaluation } } }];
} catch (error) {
  return [{ json: { statusCode: 502, body: { schemaVersion: 1, inputHash: request.inputHash,
    error: { code: 'EVALUATION_MODEL_FAILED', message: error.message } } } }];
}
