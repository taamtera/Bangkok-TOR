// The crawler writes only these three collections. Application collections are separate.
export const STAGE_STATUS = {
  P0: 'procurement_planned', '15': 'reference_price_published', B0: 'draft_tender_published',
  D0: 'invitation_published', W0: 'award_published', D1: 'invitation_cancelled',
  W1: 'award_cancelled', D2: 'invitation_amended', W2: 'award_amended'
};
export const REMOVED_ENRICHMENT_FIELDS = ['opend', 'opendLookup', 'province', 'district', 'subdistrict', 'projectLocation', 'projectMoney', 'referencePrice', 'totalContractValue', 'contractProjectStatus', 'contracts', 'opendUpdatedAt', 'locationFilter'];
const text = { bsonType: ['string', 'null'] };
const timestamp = { bsonType: 'string' };
const date = { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const count = { bsonType: ['int', 'long', 'double'], minimum: 0 };
const observation = {
  bsonType: 'object',
  properties: {
    title: text, description: text, publishedAt: date, url: text, documentUrl: text,
    channelParams: { bsonType: 'object' }, itemParams: { bsonType: 'object' },
    firstSeenAt: timestamp, lastSeenAt: timestamp
  }
};

export const ingestionDefinitions = {
  tor_announcements: {
    required: ['projectId', 'scope', 'identityScope', 'title', 'description', 'departmentId',
      'publishedAt', 'url', 'procurementMethod', 'channelParams', 'itemParams', 'firstSeenAt',
      'lastSeenAt', 'status', 'statusPublishedAt', 'statusOrderAmbiguous', 'stageObservations', 'biddingOpenVerified'],
    properties: {
      projectId: { bsonType: 'string', minLength: 1 },
      // Explicitly reject the retired top-level identities while permitting raw itemParams.
      templateId: { not: {} }, projectKey: { not: {} }, announcementType: { not: {} },
      scope: { enum: ['department'] }, linkedProjectId: text,
      identityScope: { enum: ['project', 'plan'] },
      departmentId: text, departmentName: text, title: text, description: text,
      procurementMethod: { bsonType: ['string', 'object', 'null'] }, publishedAt: date,
      url: text, documentUrl: text, thumbnail: text, thumbnailSourceUrl: text,
      channelParams: { bsonType: 'object' }, itemParams: { bsonType: 'object' },
      firstSeenAt: timestamp, lastSeenAt: timestamp,
      status: { enum: [...Object.values(STAGE_STATUS), 'multiple_announcements_same_day', 'unknown'] },
      statusPublishedAt: date, statusOrderAmbiguous: { bsonType: 'bool' },
      stageObservations: {
        bsonType: 'object', additionalProperties: false,
        properties: Object.fromEntries(Object.keys(STAGE_STATUS).map(code => [code, observation]))
      },
      biddingOpenVerified: { bsonType: 'bool' },
      titleMatchedKeywords: { bsonType: 'array', items: { bsonType: 'string' } },
      ...Object.fromEntries(REMOVED_ENRICHMENT_FIELDS.map(field => [field, { not: {} }]))
    }
  },
  thumbnails: {
    required: ['projectId', 'contentType', 'data', 'sourceUrl', 'sourcePublishedAt', 'width', 'quality', 'size', 'updatedAt'],
    properties: {
      projectId: { bsonType: 'string', minLength: 1 }, templateId: { not: {} },
      contentType: { enum: ['image/webp'] }, data: { bsonType: 'string', minLength: 1 },
      sourceUrl: { bsonType: 'string', minLength: 1 }, sourcePublishedAt: date,
      width: { bsonType: ['int', 'long'], minimum: 1 },
      quality: { bsonType: ['int', 'long'], minimum: 1, maximum: 100 },
      size: { bsonType: ['int', 'long'], minimum: 1 }, updatedAt: timestamp
    }
  },
  ingestion_runs: {
    required: ['fetchedAt', 'request', 'reportedCount', 'itemsReceived', 'complete'],
    properties: {
      sourceId: { bsonType: 'string' }, fetchedAt: { bsonType: ['string', 'date'] },
      request: { bsonType: 'object', properties: { departmentId: text, announcementType: text } },
      departmentId: text, announcementType: text,
      channelParams: { bsonType: 'object' }, lastBuildDate: { bsonType: ['string', 'date', 'null'] },
      reportedCount: count, itemsReceived: count, rawReceivedCount: count,
      keywordMatchedCount: count, keywordRejectedCount: count,
      complete: { bsonType: 'bool' }
    }
  }
};

export const ingestionIndexes = {
  tor_announcements: [
    [{ projectId: 1 }, { unique: true, name: 'uq_tors_project_id' }],
    [{ departmentId: 1, publishedAt: -1 }, { name: 'ix_rss_tors_department_published' }],
    [{ status: 1, statusPublishedAt: -1 }, { name: 'ix_tors_status_published' }],
    [{ procurementMethod: 1, publishedAt: -1 }, { name: 'ix_rss_tors_method_published' }],
    [{ title: 'text', description: 'text' }, { default_language: 'none', weights: { title: 10, description: 2 }, name: 'tx_rss_tors_discovery' }],
    [{ 'tagAssignments.tagId': 1, 'tagAssignments.requirementLevel': 1 }, { name: 'ix_rss_tors_tags_level' }]
  ],
  thumbnails: [
    [{ projectId: 1 }, { unique: true, name: 'uq_thumbnails_project_id' }],
    [{ updatedAt: -1 }, { name: 'ix_thumbnails_updated' }]
  ],
  ingestion_runs: [
    [{ sourceId: 1, fetchedAt: -1 }, { name: 'ix_rss_ingestion_source_fetched' }],
    [{ complete: 1, fetchedAt: -1 }, { name: 'ix_rss_ingestion_complete_fetched' }]
  ]
};

export const retiredIdentityIndexes = {
  tor_announcements: ['ix_tors_project_money', 'uq_rss_tors_template', 'uq_rss_tors_source_url', 'ix_rss_tors_type_published'],
  thumbnails: ['uq_thumbnails_template']
};

export async function assertProjectIdentitiesReady(database) {
  for (const name of ['tor_announcements', 'thumbnails']) {
    if (!(await database.listCollections({ name }, { nameOnly: true }).hasNext())) continue;
    const collection = database.collection(name);
    const invalid = await collection.countDocuments({ $or: [
      { projectId: { $not: { $type: 'string' } } }, { projectId: '' },
      { templateId: { $exists: true } }, { projectKey: { $exists: true } },
      ...(name === 'tor_announcements' ? [{ announcementType: { $exists: true } }, { stageObservations: { $exists: false } }, ...REMOVED_ENRICHMENT_FIELDS.map(field => ({ [field]: { $exists: true } }))] : [])
    ] });
    const duplicates = await collection.aggregate([
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $limit: 1 }
    ]).toArray();
    if (invalid || duplicates.length) throw new Error(`${name} needs migration before setup. Run npm run db:migrate, review the preview, then apply it with a backup.`);
  }
}
