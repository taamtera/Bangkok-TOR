import { readFile, writeFile } from 'node:fs/promises';

const code = name => readFile(new URL(`../workflows/company-evaluation/${name}.js`, import.meta.url), 'utf8');
const [build, normalize] = await Promise.all([code('build-prompt'), code('normalize-response')]);
const nodes = [
  { id: 'ff5eb5e6-718c-493c-99c4-d1f6b8ea1157', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2.2,
    position: [-520, 16], webhookId: 'f1500ebc-17b2-455f-bfaf-ae2a32f09256',
    parameters: { httpMethod: 'POST', path: 'eval', responseMode: 'responseNode', options: {} } },
  { id: 'b04437a5-e93d-48d1-9010-ff417bac2ddf', name: 'Build Evaluation Prompt', type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [-300, 16], parameters: { mode: 'runOnceForAllItems', jsCode: build } },
  { id: '174dcb28-d9bb-4cd4-8b8e-272f6ecb7946', name: 'Enough Data?', type: 'n8n-nodes-base.if', typeVersion: 2.2,
    position: [-160, 16], parameters: { conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: '5abca05a-a330-4d09-85cc-eac59215650f', leftValue: '={{ $json.canEvaluate }}',
        rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and'
    }, options: {} } },
  { id: '23908b33-2416-44ef-a17e-d663e30c8e7d', name: 'Qwen Company Evaluation', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [-60, 16], onError: 'continueRegularOutput', parameters: { method: 'POST',
      url: 'http://100.77.43.106:11434/api/chat', sendBody: true, specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ model: 'qwen3.5:9bu', stream: false, think: true, format: $json.evaluationSchema, options: { num_ctx: 32000, temperature: 0.2, num_predict: 8192 }, messages: [{ role: 'system', content: $json.aiSystemPrompt }, { role: 'user', content: $json.requestPrompt }] }) }}",
      options: { response: { response: { responseFormat: 'json' } }, timeout: 1800000 } } },
  { id: 'a5e350f5-cb52-4b26-a501-fae4d2157731', name: 'Validate Evaluation Response', type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [180, 16], parameters: { mode: 'runOnceForAllItems', jsCode: normalize } },
  { id: '05b16a96-ff31-4acf-bb9f-3b3ba31eb81c', name: 'Respond to Webhook', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.5,
    position: [420, 16], parameters: { respondWith: 'json', responseBody: '={{ $json.body }}',
      options: { responseCode: '={{ $json.statusCode }}' } } }
];
const connections = Object.fromEntries(nodes.slice(0, -1).map((node, index) => [node.name,
  { main: [[{ node: nodes[index + 1].name, type: 'main', index: 0 }]] }]));
connections['Enough Data?'] = { main: [
  [{ node: 'Qwen Company Evaluation', type: 'main', index: 0 }],
  [{ node: 'Respond to Webhook', type: 'main', index: 0 }]
] };
const workflow = { name: 'TOR Company Evaluation - Production', nodes, connections, pinData: {},
  settings: { executionOrder: 'v1', executionTimeout: 1860 }, active: false };
await writeFile(new URL('../../n8n-tor-company-evaluation.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('Built n8n-tor-company-evaluation.json');
