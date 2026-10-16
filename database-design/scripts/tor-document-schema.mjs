export const torDocumentsSchema = {
  bsonType: 'array',
  items: {
    bsonType: 'object',
    // Historical attachment metadata remains supported; new extraction fields are optional.
    additionalProperties: true,
    properties: {
      filename: { bsonType: ['string', 'null'] },
      sourceFormat: { bsonType: 'string' },
      extractionStatus: { bsonType: 'string' },
      pages: { oneOf: [
        { bsonType: ['int', 'long', 'double', 'decimal'], minimum: 0, multipleOf: 1 },
        { bsonType: 'array' },
        { bsonType: 'null' }
      ] },
      extractedText: { bsonType: 'string' }
    }
  }
};

// Extend just this property, keeping all other validator clauses and document fields.
export function extendTorDocumentsValidator(validator = {}) {
  const result = structuredClone(validator);
  if (!result.$jsonSchema) {
    return { ...result, $jsonSchema: { bsonType: 'object', properties: { documents: torDocumentsSchema } } };
  }
  const schema = result.$jsonSchema;
  const previous = schema.properties?.documents ?? {};
  const items = previous.items ?? {};
  schema.properties = { ...schema.properties, documents: {
    ...previous, ...torDocumentsSchema,
    items: { ...items, ...torDocumentsSchema.items,
      properties: { ...items.properties, ...torDocumentsSchema.items.properties } }
  } };
  return result;
}
