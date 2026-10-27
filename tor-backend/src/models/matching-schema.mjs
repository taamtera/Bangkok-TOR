// Preserve existing constraints and historical records while allowing policy-3 coverage results.
export function matchingValidator(validator) {
  const result = structuredClone(validator);
  if (!Array.isArray(result?.$jsonSchema?.required)) throw new Error('Expected company_matches JSON schema was not found.');
  result.$jsonSchema.required = result.$jsonSchema.required.filter(field => field !== 'recommendation');
  return result;
}
