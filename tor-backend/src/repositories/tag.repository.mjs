import { getDatabase } from '../config/database.mjs';
import { createHash } from 'node:crypto';
import { httpError } from '../utils/http-error.mjs';
import { toObjectId } from '../utils/object-id.mjs';
import { coreTagForName, normalizeTagName, isFlaggedTagName } from '../services/tag-catalog.mjs';
import { serializeTag } from '../serializers/tag.serializer.mjs';

function tags() {
  return getDatabase().collection('tags');
}

function normalizeName(value) {
  return normalizeTagName(value);
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function profileTagSlug(name, category) {
  return `${slugify(name) || 'profile'}-${category}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export async function listControlledTags({ category = null, search = null, status = 'active' } = {}) {
  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (status) {
    filter.status = status === 'active' ? { $ne: 'inactive' } : status;
  }

  if (search?.trim()) {
    const expression = new RegExp(escapeRegex(search.trim()), 'iu');
    filter.$or = [{ name: expression }, { text: expression }, { contractorLabel: expression }, { aliases: expression }];
  }

  return (await tags().find(filter).sort({ category: 1, name: 1 }).toArray()).map(serializeTag);
}

export async function createControlledTag({ name, category, type, contractorLabel = null, aliases = [], description = null, createdByUserId }) {
  const normalizedName = normalizeName(name);
  const readableSlug = slugify(name);
  const slug = readableSlug || `${category}-${createHash('sha256').update(normalizedName).digest('hex').slice(0, 12)}`;
  const existing = await tags().findOne({
    $or: [{ slug }, { category, normalizedName }, { category, text: name.trim() }]
  });

  if (existing) {
    throw httpError(409, 'TAG_ALREADY_EXISTS', 'A tag with this name already exists.');
  }

  const now = new Date();
  const document = {
    name: name.trim(),
    text: name.trim(),
    normalizedName,
    slug,
    category,
    type,
    contractorLabel: contractorLabel?.trim() || null,
    aliases: [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))],
    description: description?.trim() || null,
    status: 'active',
    createdByUserId: toObjectId(createdByUserId, 'createdByUserId'),
    createdAt: now,
    updatedAt: now
  };
  const result = await tags().insertOne(document);
  return { ...document, _id: result.insertedId };
}

// Company-entered profile values are self-reported claims. Turn those exact
// values into reusable catalog entries so companies can use matching without
// waiting for an administrator to create each capability tag. This does not
// create or approve TOR requirements.
export async function findOrCreateProfileTag({ name, category, contractorLabel = null }) {
  if (isFlaggedTagName(name)) return null;
  const core = coreTagForName(name, { profile: true });
  name = core?.name || name;
  category = core?.category || category;
  const cleanName = name.trim();
  const normalizedName = normalizeName(cleanName);
  const lookup = { category, $or: [{ normalizedName }, { text: cleanName }, { name: cleanName }] };
  const existing = await tags().findOne(lookup);
  if (existing) return existing.status !== 'inactive' ? serializeTag(existing) : null;

  const now = new Date();
  const document = {
    name: cleanName,
    text: cleanName,
    contractorLabel: contractorLabel?.trim() || null,
    normalizedName,
    slug: profileTagSlug(cleanName, category),
    category,
    aliases: core?.aliases || [],
    ...(core ? { conceptKey: core.conceptKey } : {}),
    description: 'Self-reported company profile capability; not independently verified.',
    status: 'active',
    createdByUserId: null,
    createdAt: now,
    updatedAt: now
  };

  try {
    const result = await tags().insertOne(document);
    return { ...document, _id: result.insertedId };
  } catch (error) {
    // Concurrent profile saves can create the same canonical tag. Re-read the
    // winning entry rather than failing the profile save.
    if (error?.code === 11000) {
      const raced = await tags().findOne(lookup);
      if (raced) return raced.status !== 'inactive' ? serializeTag(raced) : null;
      document.slug = `${profileTagSlug(cleanName, category)}-${createHash('sha256').update(normalizedName).digest('hex').slice(0, 8)}`;
      const result = await tags().insertOne(document);
      return { ...document, _id: result.insertedId };
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
  if (!current) {
    throw httpError(404, 'TAG_NOT_FOUND', 'The tag does not exist.');
  }

  const name = updates.name ?? current.name ?? current.text;
  const category = updates.category ?? current.category;
  const normalizedName = normalizeName(name);
  const normalizedNameChanged = (Object.hasOwn(updates, 'name') || Object.hasOwn(updates, 'category'))
    && (normalizedName !== current.normalizedName || category !== current.category);

  if (normalizedNameChanged) {
    const duplicate = await tags().findOne({
      _id: { $ne: objectId },
      category,
      normalizedName
    });
    if (duplicate) {
      throw httpError(409, 'TAG_ALREADY_EXISTS', 'A tag with this name already exists in this category.');
    }
  }

  const fields = { ...updates, updatedAt: new Date() };
  if (Object.hasOwn(updates, 'name')) fields.text = name;
  if (Object.hasOwn(updates, 'name') || Object.hasOwn(updates, 'category')) {
    fields.normalizedName = normalizedName;
  }

  try {
    return serializeTag(await tags().findOneAndUpdate(
      { _id: objectId },
      { $set: fields },
      { returnDocument: 'after' }
    ));
  } catch (error) {
    if (error?.code === 11000) {
      throw httpError(409, 'TAG_ALREADY_EXISTS', 'A tag with this name or slug already exists.');
    }
    throw error;
  }
}

export async function deactivateControlledTag(tagId) {
  return updateControlledTag(tagId, { status: 'inactive' });
}

export async function assertActiveTagIds(tagIds) {
  const uniqueTagIds = [...new Set(tagIds)];
  const objectIds = uniqueTagIds.map((tagId) => toObjectId(tagId, 'tagId'));
  const activeCount = await tags().countDocuments({ _id: { $in: objectIds }, status: { $ne: 'inactive' } });

  if (activeCount !== objectIds.length) {
    throw httpError(400, 'UNKNOWN_TAG', 'Every assigned tag must exist and be active.');
  }

  return objectIds;
}
