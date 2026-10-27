// Contract: tor-backend/docs/company-evaluation.openapi.json. Simulation fixtures only.
const http = require('node:http');
http.createServer(async (req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST' || new URL(req.url, 'http://localhost').pathname !== '/webhook/eval') return send(501, { error: 'Endpoint not modeled' });
  let body = req.body;
  if (!body) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    try { body = JSON.parse(raw); } catch { return send(400, { error: 'Invalid JSON' }); }
  }
  if (body.schemaVersion !== 1 || !body.company?.companyId || !body.tor?.projectId || !/^[a-f0-9]{64}$/.test(body.inputHash || '')) return send(400, { error: 'Invalid evaluation payload' });
  if (body.company.contactEmail || body.company.passwordHash) return send(400, { error: 'Unexpected private fields' });
  if (body.tor.projectId === 'sim-error') return send(502, { error: { code: 'MODEL_UNAVAILABLE' } });
  if (body.tor.projectId === 'sim-html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>Proxy error</html>'); }
  await new Promise(resolve => setTimeout(resolve, body.tor.projectId === 'sim-slow' ? 1800 : 120));
  const evaluation = { summary: `Simulation assessment for ${body.company.name}.`, priceScore: null,
    priceAssessment: 'Insufficient cost evidence to assess budget feasibility.', qualificationMatchScore: 70,
    qualificationAnalysis: 'Selected services overlap the provided TOR requirements.', riskLevel: 'Medium',
    riskAnalysis: 'Eligibility and certification evidence must be checked.', keyRequirementsExtracted: ['Provide the requested service'],
    strengths: ['Relevant service selection'], gaps: ['No independently verified delivery evidence'], missingInformation: ['Supplier cost estimate'] };
  if (body.tor.projectId === 'sim-invalid') evaluation.qualificationMatchScore = 'excellent';
  send(200, { schemaVersion: 1, inputHash: body.inputHash, requestId: body.requestId, model: 'qwen3.5:9bu', evaluation });
}).listen(process.env.PORT || 4500);
