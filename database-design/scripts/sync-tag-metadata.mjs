import { MongoClient, BSON } from 'mongodb';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvironment } from './env.mjs';

// Explicit classification of the six established vocabulary entries, not TOR facts.
const knownTypes = {
  nodejs: 'specification', mongodb: 'specification', docker: 'specification',
  'iso-27001': 'contractor_requirement', microservices: 'specification',
  'web-development': 'specification'
};
const apply = process.argv.includes('--apply');
const { uri, databaseName } = loadEnvironment();
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const db = client.db(databaseName);
  const infosBefore = await db.listCollections().toArray();
  const validatorsBefore = JSON.stringify(infosBefore.map(({ name, options }) => ({ name, validator: options?.validator ?? null })).sort((a,b) => a.name.localeCompare(b.name)));
  const tags = db.collection('tags');
  const documents = await tags.find({}).toArray();
  const changes = [];
  const unresolved = [];
  for (const tag of documents) {
    const set = {};
    if ((!tag.text || typeof tag.text !== 'string') && typeof tag.name === 'string' && tag.name.trim()) set.text = tag.name.trim();
    if (!tag.type || typeof tag.type !== 'string') {
      if (knownTypes[tag.slug]) set.type = knownTypes[tag.slug];
      else unresolved.push({ tagId: tag._id.toString(), text: tag.text ?? tag.name, reason: 'Type requires explicit classification; no guessed default.' });
    }
    if (Object.keys(set).length) changes.push({ _id: tag._id, set, before: tag });
  }
  console.log(JSON.stringify({ database: databaseName, mode: apply ? 'apply' : 'preview', changes: changes.map(c => ({ tagId: c._id.toString(), text: c.before.text ?? c.before.name, set: c.set })), unresolved }, null, 2));
  if (unresolved.length) throw new Error('Classify unresolved canonical tags before applying this migration.');
  if (apply && changes.length) {
    const backupDirectory = resolve('backups');
    await mkdir(backupDirectory, { recursive: true });
    const backupPath = resolve(backupDirectory, `tags-before-metadata-${Date.now()}.ejson`);
    await writeFile(backupPath, BSON.EJSON.stringify({ database: databaseName, capturedAt: new Date(), documents: changes.map(c => c.before) }, null, 2), { flag: 'wx' });
    let modified = 0;
    for (const change of changes) {
      // Match previous values to avoid overwriting concurrent edits.
      const filter = { _id: change._id };
      for (const field of Object.keys(change.set)) filter[field] = Object.hasOwn(change.before, field) ? change.before[field] : { $exists: false };
      const result = await tags.updateOne(filter, { $set: { ...change.set, updatedAt: new Date() } });
      if (result.matchedCount !== 1) throw new Error('A tag changed concurrently; rerun the preview. Earlier updates are preserved in the backup.');
      modified += result.modifiedCount;
    }
    console.log(JSON.stringify({ modified, backupPath }));
  }
  const infosAfter = await db.listCollections().toArray();
  const validatorsAfter = JSON.stringify(infosAfter.map(({ name, options }) => ({ name, validator: options?.validator ?? null })).sort((a,b) => a.name.localeCompare(b.name)));
  if (validatorsBefore !== validatorsAfter) throw new Error('Database validators changed concurrently during the metadata sync.');
  console.log(JSON.stringify({ validatorsUnchanged: true, tags: await tags.find({}, { projection: { text: 1, name: 1, category: 1, type: 1 } }).toArray(), canonicalTagsWithRequirementLevel: await tags.countDocuments({ requirementLevel: { $exists: true } }) }, null, 2));
} finally { await client.close(); }
