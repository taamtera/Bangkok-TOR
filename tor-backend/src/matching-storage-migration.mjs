// Narrow, idempotent migration. It preserves every validation rule except the
// old obligation to label a rules-based match as a recommendation.
import { MongoClient } from 'mongodb';
import { env } from './config/env.mjs';

if (env.mongodbDatabaseName !== 'tor_software_test') {
  throw new Error('This migration is restricted to tor_software_test.');
}
const client = new MongoClient(env.mongodbUri);
try {
  await client.connect();
  const database = client.db(env.mongodbDatabaseName);
  const [collection] = await database.listCollections({ name: 'company_matches' }).toArray();
  const validator = collection?.options?.validator;
  if (!validator?.$jsonSchema?.required) throw new Error('Expected company_matches schema was not found.');
  validator.$jsonSchema.required = validator.$jsonSchema.required.filter((field) => field !== 'recommendation');
  await database.command({ collMod: 'company_matches', validator,
    validationLevel: collection.options.validationLevel || 'strict',
    validationAction: collection.options.validationAction || 'error' });
  console.log('Updated company_matches validator in tor_software_test; profile and TOR records were not changed.');
} finally { await client.close(); }
