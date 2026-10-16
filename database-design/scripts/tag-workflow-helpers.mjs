// Test harness for the single-file n8n artifact. It does not execute n8n or Atlas.
import { readFileSync } from 'node:fs';
const workflow = JSON.parse(readFileSync(new URL('../../n8n-tor-ai-tags.json', import.meta.url)));
function helpers(nodeName, runtimeStart, names) {
  const code = workflow.nodes.find(node => node.name === nodeName)?.parameters.jsCode;
  const end = code?.indexOf(runtimeStart);
  if (!(end >= 0)) throw new Error(`Cannot locate helper definitions in ${nodeName}.`);
  return new Function(`${code.slice(0, end)}\nreturn { ${names.join(', ')} };`)();
}
const prompt = helpers('Build Tag-Aware AI Prompts', "const projects = $('Capture AI Inputs')", ['buildPromptItems']);
const parse = helpers('Parse AI and Build Tag Writes', 'const inputs = $input.all();', ['parseAIResponses', 'buildTagUpsertPipeline', 'slugFor']);
const append = helpers('Build Atomic Assignment Append', "const { projects } = $('Parse AI and Build Tag Writes')", ['buildProjectUpdatePipeline']);
const verify = helpers('Build Verification Query', "const { projects } = $('Parse AI and Build Tag Writes')", ['buildVerificationPipeline']);
export const { buildPromptItems } = prompt;
export const { parseAIResponses, buildTagUpsertPipeline, slugFor } = parse;
export const { buildProjectUpdatePipeline } = append;
export const { buildVerificationPipeline } = verify;
