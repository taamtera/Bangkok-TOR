import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { BSON } from 'mongodb';
import { connectDatabase, closeDatabase, startDatabaseSession } from './config/database.mjs';
import { coreTags, normalizeTagName, isFlaggedTagName, remapTagReferences } from './services/tag-catalog.mjs';
const EJSON = BSON.EJSON;

export function planCatalogCleanup(tags) {
  const groups = new Map(); const mapping = new Map(); const duplicates = []; const survivors = [];
  for (const tag of [...tags].sort((a, b) => String(a._id).localeCompare(String(b._id)))) {
    const key = `${tag.category}:${normalizeTagName(tag.name)}`;
    if (groups.has(key)) { mapping.set(String(tag._id), groups.get(key)._id); duplicates.push(tag); }
    else { groups.set(key, tag); survivors.push(tag); }
  }
  const usedSlugs = new Set();
  const updates = survivors.map((tag) => {
    const group = tags.filter((item) => `${item.category}:${normalizeTagName(item.name)}` === `${tag.category}:${normalizeTagName(tag.name)}`);
    let slug = tag.slug || `tag-${tag._id}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${tag._id}`; usedSlugs.add(slug);
    const flagged = isFlaggedTagName(tag.name);
    return { ...tag, normalizedName: normalizeTagName(tag.name), slug,
      aliases: [...new Set(group.flatMap((item) => item.aliases || []))],
      ...(flagged ? { status: 'inactive', matchingExcluded: true, qualityIssue: 'Possible ISO 27001 typo; original profile text is preserved.' } : {}) };
  });
  return { mapping, duplicates, updates };
}

export async function migrateCatalog(db, { apply = false } = {}) {
  if (db.databaseName !== 'tor_software_test') throw new Error('Catalog migration is restricted to tor_software_test.');
  const preview = planCatalogCleanup(await db.collection('tags').find({}).toArray());
  if (!apply) return { mode: 'preview', duplicateRecords: preview.duplicates.length,
    flaggedRecords: preview.updates.filter((tag) => tag.matchingExcluded).length, sharedTags: coreTags.length };
  const session = startDatabaseSession(); let backupPath; let merged;
  try {
    await session.withTransaction(async () => {
      const collections = ['tags', 'companies', 'tor_announcements', 'company_matches', 'ai_evaluations'];
      const backup = {};
      for (const name of collections) backup[name] = await db.collection(name).find({}, { session }).toArray();
      const plan = planCatalogCleanup(backup.tags); merged = plan.duplicates.length;
      const directory = process.env.CATALOG_BACKUP_DIR || join(tmpdir(), 'tor-tag-backups');
      await mkdir(directory, { recursive: true });
      backupPath = join(directory, `catalog-${randomUUID()}.ejson`);
      await writeFile(backupPath, EJSON.stringify({ database: db.databaseName, createdAt: new Date(), records: backup }), { flag: 'wx', mode: 0o600 });
      for (const name of collections.filter((name) => name !== 'tags')) {
        for (const record of backup[name]) {
          const remapped = remapTagReferences(record, plan.mapping);
          if (EJSON.stringify(remapped) !== EJSON.stringify(record)) await db.collection(name).replaceOne({ _id: record._id }, remapped, { session });
        }
      }
      for (const tag of plan.duplicates) {
        await db.collection('tag_catalog_archives').updateOne({ _id: tag._id }, { $setOnInsert: {
          ...tag, mergedInto: plan.mapping.get(String(tag._id)), archivedAt: new Date()
        } }, { session, upsert: true });
        await db.collection('tags').deleteOne({ _id: tag._id }, { session });
      }
      for (const tag of plan.updates) await db.collection('tags').replaceOne({ _id: tag._id }, tag, { session });
      for (const tag of coreTags) {
        const normalizedName = normalizeTagName(tag.name); const now = new Date();
        await db.collection('tags').updateOne({ category: tag.category, normalizedName }, {
          $set: { conceptKey: tag.conceptKey, updatedAt: now }, $addToSet: { aliases: { $each: tag.aliases } },
          $setOnInsert: { name: tag.name, normalizedName, category: tag.category, status: 'active',
            slug: `shared-${createHash('sha256').update(`${tag.category}:${normalizedName}`).digest('hex').slice(0, 20)}`,
            description: 'Shared matching concept; assignment evidence remains separate.', createdAt: now, createdByUserId: null }
        }, { session, upsert: true });
      }
    });
  } finally { await session.endSession(); }
  await db.collection('tags').createIndex({ category: 1, normalizedName: 1 }, { unique: true, name: 'uq_tags_category_name' });
  await db.collection('tags').createIndex({ slug: 1 }, { unique: true, name: 'uq_tags_slug' });
  await db.collection('requirement_sources').createIndex({ torId: 1, torVersion: 1, sourceUrl: 1, documentHash: 1 }, { unique: true, name: 'uq_requirement_source' });
  await db.collection('ai_evaluations').createIndex({ torId: 1, torVersion: 1 }, { unique: true, name: 'uq_ai_tor_version' });
  return { mode: 'applied', mergedRecords: merged, activeTags: await db.collection('tags').countDocuments({ status: 'active' }), backupPath };
}
if (process.argv[1]?.endsWith('tag-catalog-migration.mjs')) {
  try { const db = await connectDatabase(); console.log(JSON.stringify(await migrateCatalog(db, { apply: process.argv.includes('--apply') }), null, 2)); }
  finally { await closeDatabase(); }
}
