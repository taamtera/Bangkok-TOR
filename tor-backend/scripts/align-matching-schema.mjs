import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { BSON } from 'mongodb';
import { connectDatabase, closeDatabase } from '../src/config/database.mjs';
import { matchingValidator } from '../src/models/matching-schema.mjs';

// Preview by default. Applies only the two compatibility changes needed by current APIs.
try {
  const db = await connectDatabase();
  const info = await db.listCollections({ name: 'company_matches' }).next();
  const validator = matchingValidator(info?.options?.validator);
  const changed = JSON.stringify(validator) !== JSON.stringify(info.options.validator);
  const sources = await db.listCollections({ name: 'requirement_sources' }).next();
  const indexes = sources ? await db.collection('requirement_sources').indexes() : [];
  const sourceKey = { torId: 1, torVersion: 1, sourceUrl: 1, documentHash: 1 };
  const hasSourceIndex = indexes.some(index => index.unique && JSON.stringify(index.key) === JSON.stringify(sourceKey));
  console.log(JSON.stringify({ database: db.databaseName, mode: process.argv.includes('--apply') ? 'apply' : 'preview',
    removeRequiredRecommendation: changed, addSourceSnapshotUniqueIndex: !hasSourceIndex }));
  if (process.argv.includes('--apply') && (changed || !hasSourceIndex)) {
    const directory = join(tmpdir(), 'tor-schema-backups');
    await mkdir(directory, { recursive: true });
    const backupPath = join(directory, `matching-${randomUUID()}.ejson`);
    await writeFile(backupPath, BSON.EJSON.stringify({ database: db.databaseName, capturedAt: new Date(),
      companyMatchesOptions: info.options, requirementSourceIndexes: indexes }), { flag: 'wx', mode: 0o600 });
    // Refuse duplicate snapshots before changing any validation rule.
    if (sources) {
      const duplicate = await db.collection('requirement_sources').aggregate([
        { $group: { _id: { torId: '$torId', torVersion: '$torVersion', sourceUrl: '$sourceUrl', documentHash: '$documentHash' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }, { $limit: 1 }
      ]).next();
      if (duplicate) throw new Error('Duplicate source snapshots must be resolved before applying this migration.');
    }
    if (!hasSourceIndex) await db.collection('requirement_sources').createIndex(sourceKey, { unique: true, name: 'uq_requirement_source' });
    if (changed) await db.command({ collMod: 'company_matches', validator,
      validationLevel: info.options.validationLevel || 'strict', validationAction: info.options.validationAction || 'error' });
    console.log(JSON.stringify({ applied: true, backupPath }));
  }
} finally { await closeDatabase(); }
