import { getDatabase } from '../config/database.mjs';
import { createHash } from 'node:crypto';
import { httpError } from '../utils/http-error.mjs';
import { toObjectId } from '../utils/object-id.mjs';

function tags() {
  return getDatabase().collection('tags');
}

function normalizeName(value) {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
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
    filter.$or = [{ name: expression }, { text: expression }, { aliases: expression }];
  }

  return tags().find(filter).sort({ category: 1, name: 1 }).toArray();
}

export async function createControlledTag({ name, category, type, aliases = [], description = null, createdByUserId }) {
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

export async function assertActiveTagIds(tagIds) {
  const uniqueTagIds = [...new Set(tagIds)];
  const objectIds = uniqueTagIds.map((tagId) => toObjectId(tagId, 'tagId'));
  const activeCount = await tags().countDocuments({ _id: { $in: objectIds }, status: { $ne: 'inactive' } });

  if (activeCount !== objectIds.length) {
    throw httpError(400, 'UNKNOWN_TAG', 'Every assigned tag must exist and be active.');
  }

  return objectIds;
}
