import { getDatabase } from '../config/database.mjs';
import { httpError } from '../utils/http-error.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { coreTagForName, normalizeTagName, isFlaggedTagName, tagText, tagTypeForCategory } from '../services/tag-catalog.mjs';
import { serializeTag } from '../serializers/tag.serializer.mjs';

const tags = () => getDatabase().collection('tags');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const duplicate = () => httpError(409, 'TAG_ALREADY_EXISTS', 'A tag with this text already exists in this category.');

// The current unique key is category + text. Legacy name is a read/input alias only.
async function findByText(name, category, excludeId = null, session = undefined) {
  const normalized = normalizeTagName(name);
  const candidates = await tags().find({ category, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }, { session }).toArray();
  return candidates.find(tag => normalizeTagName(tagText(tag)) === normalized) || null;
}

export async function listControlledTags({ category = null, search = null, status = 'active' } = {}) {
  const filter = { ...(category ? { category } : {}), ...(status ? { status: status === 'active' ? { $ne: 'inactive' } : status } : {}) };
  if (search) {
    if (typeof search !== 'string') throw httpError(400, 'INVALID_TAG_INPUT', 'search must be text.');
    const expression = new RegExp(escapeRegex(search.trim()), 'iu');
    filter.$or = [{ text: expression }, { name: expression }, { contractorLabel: expression }, { aliases: expression }];
  }
  return (await tags().find(filter).sort({ category: 1, text: 1 }).toArray()).map(serializeTag);
}

export async function createControlledTag({ name, category, type, contractorLabel = null, aliases = [], description = null, createdByUserId }) {
  const text = name.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (await findByText(text, category)) throw duplicate();
  const now = new Date();
  const document = { text, category, type, contractorLabel: contractorLabel?.trim() || null,
    aliases, description, status: 'active', createdByUserId: toObjectId(createdByUserId, 'createdByUserId'), createdAt: now, updatedAt: now };
  try {
    const result = await tags().insertOne(document);
    return serializeTag({ ...document, _id: result.insertedId });
  } catch (error) { if (error?.code === 11000) throw duplicate(); throw error; }
}

// Reuse the canonical catalog without creating legacy indexes or keys.
// Profile-sourced values remain self-reported; AI entries retain source-cited provenance.
export async function findOrCreateCatalogTag({ name, category, contractorLabel = null, source = 'profile' }, { session } = {}) {
  if (isFlaggedTagName(name)) return null;
  const core = coreTagForName(name, { profile: source === 'profile' });
  name = (core?.name || name).normalize('NFC').trim().replace(/\s+/gu, ' ');
  category = core?.category || category;
  const existing = await findByText(name, category, null, session);
  if (existing) return existing.status !== 'inactive' ? serializeTag(existing) : null;
  const now = new Date();
  const document = { text: name, category, type: tagTypeForCategory(category),
    contractorLabel: contractorLabel?.trim() || null, aliases: core?.aliases || [],
    ...(core ? { conceptKey: core.conceptKey } : {}),
    description: source === 'ai' ? 'Created from a source-cited TOR requirement.' : 'Self-reported company profile capability; not independently verified.',
    status: 'active', createdByUserId: null, createdAt: now, updatedAt: now };
  try {
    const result = await tags().insertOne(document, { session });
    return serializeTag({ ...document, _id: result.insertedId });
  } catch (error) {
    if (error?.code === 11000 && !session) {
      const raced = await findByText(name, category);
      if (raced) return raced.status !== 'inactive' ? serializeTag(raced) : null;
    }
    throw error;
  }
}

export async function findControlledTagById(tagId) {
  return serializeTag(await tags().findOne({ _id: toObjectId(tagId, 'tagId') }));
}

export async function updateControlledTag(tagId, updates) {
  const objectId = toObjectId(tagId, 'tagId');
  const current = await tags().findOne({ _id: objectId });
  if (!current) throw httpError(404, 'TAG_NOT_FOUND', 'The tag does not exist.');
  const name = (updates.name ?? tagText(current)).normalize('NFC').trim().replace(/\s+/gu, ' ');
  const category = updates.category ?? current.category;
  if ((Object.hasOwn(updates, 'name') || Object.hasOwn(updates, 'category')) && await findByText(name, category, objectId)) throw duplicate();
  const { name: _name, ...fields } = updates;
  if (Object.hasOwn(updates, 'name')) fields.text = name;
  try {
    return serializeTag(await tags().findOneAndUpdate({ _id: objectId }, { $set: { ...fields, updatedAt: new Date() } }, { returnDocument: 'after' }));
  } catch (error) { if (error?.code === 11000) throw duplicate(); throw error; }
}

export async function deactivateControlledTag(tagId) {
  return updateControlledTag(tagId, { status: 'inactive' });
}

export async function assertActiveTagIds(tagIds) {
  const objectIds = [...new Set(tagIds.map(id => toObjectId(id, 'tagId').toHexString()))].map(id => toObjectId(id, 'tagId'));
  const activeCount = await tags().countDocuments({ _id: { $in: objectIds }, status: { $ne: 'inactive' } });
  if (activeCount !== objectIds.length) throw httpError(400, 'UNKNOWN_TAG', 'Every assigned tag must exist and be active.');
  return objectIds;
}
