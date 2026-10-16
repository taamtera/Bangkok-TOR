import { MongoClient, ServerApiVersion } from 'mongodb';
import { loadEnvironment } from './env.mjs';
import { ingestionDefinitions, assertProjectIdentitiesReady, REMOVED_ENRICHMENT_FIELDS } from './ingestion-schema.mjs';

const { uri, databaseName } = loadEnvironment();
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

const requiredCollections = [
  'sources',
  'organizations',
  'procurement_projects',
  'tor_announcements',
  'thumbnails',
  'tor_versions',
  'ingestion_runs',
  'raw_ingestion_items',
  'rss_query_state',
  'users',
  'auth_tokens',
  'sessions',
  'audit_logs',
  'companies',
  'tags',
  'ai_evaluations',
  'company_matches',
  'saved_tors',
  'notifications'
];

const expectedRequiredFields = {
  sources: ['rawRetentionDays'],
  organizations: ['ancestorIds'],
  procurement_projects: ['externalProjectId', 'organizationId'],
  ...Object.fromEntries(Object.entries(ingestionDefinitions).map(([name, definition]) => [name, definition.required])),
  rss_query_state: ['queryKey', 'reportedCount', 'itemsReceived', 'complete', 'splitLevel', 'status', 'retryCount', 'lastCheckedAt'],
  users: ['notificationPreferences'],
  tags: [],
  ai_evaluations: ['retryCount', 'lastAttemptAt', 'nextAttemptAt', 'lastError'],
  notifications: ['attemptCount', 'nextAttemptAt', 'deliveryError']
};

const expectedNestedRequiredFields = {
  tor_announcements: {},
  users: {
    notificationPreferences: ['channels', 'alertTypes']
  },
  ai_evaluations: {
    lastError: ['code', 'message', 'retryable']
  },
  notifications: {
    deliveryError: ['code', 'message', 'lastAttemptAt']
  }
};

const expectedIndexes = {
  organizations: ['ix_organizations_ancestors'],
  procurement_projects: ['uq_projects_source_external'],
  ingestion_runs: ['ix_rss_ingestion_source_fetched'],
  raw_ingestion_items: ['ttl_raw_ingestion_expiry'],
  rss_query_state: ['uq_rss_query_source_key', 'ix_rss_query_retry_queue'],
  audit_logs: ['ttl_audit_expiry'],
  tags: ['uq_tags_category_text', 'ix_tags_category_status_name', 'ix_tags_aliases'],
  companies: ['ix_companies_tags_verification'],
  thumbnails: ['uq_thumbnails_project_id'],
  tor_announcements: ['uq_tors_project_id', 'tx_rss_tors_discovery', 'ix_rss_tors_tags_level'],
  ai_evaluations: ['uq_ai_tor_version', 'ix_ai_queue_ready'],
  company_matches: ['uq_matches_company_tor_version'],
  saved_tors: ['uq_saved_user_tor'],
  notifications: ['ix_notifications_delivery_queue']
};

try {
  await client.connect();
  const database = client.db(databaseName);
  await assertProjectIdentitiesReady(database);
  const existingCollections = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name)
  );
  const missingCollections = requiredCollections.filter((name) => !existingCollections.has(name));

  if (missingCollections.length > 0) {
    throw new Error(`Missing collections: ${missingCollections.join(', ')}`);
  }

  for (const collectionName of requiredCollections) {
    const collection = database.collection(collectionName);
    const documentCount = await collection.countDocuments({});
    const collectionInfo = await database.listCollections({ name: collectionName }).next();
    const jsonSchema = collectionInfo?.options?.validator?.$jsonSchema;
    const requiredFields = new Set(jsonSchema?.required || []);
    const indexes = await collection.listIndexes().toArray();
    const indexCount = indexes.length;

    if (collectionName === 'tor_announcements') {
      for (const field of REMOVED_ENRICHMENT_FIELDS) {
        if (JSON.stringify(jsonSchema?.properties?.[field]) !== JSON.stringify({ not: {} })) {
          throw new Error(`Removed enrichment field must be forbidden: ${collectionName}.${field}`);
        }
      }
    }

    for (const fieldName of expectedRequiredFields[collectionName] || []) {
      if (!requiredFields.has(fieldName)) {
        throw new Error(`Missing required validator field: ${collectionName}.${fieldName}`);
      }
    }

    for (const [objectName, nestedFields] of Object.entries(expectedNestedRequiredFields[collectionName] || {})) {
      const nestedRequired = new Set(jsonSchema?.properties?.[objectName]?.required || []);
      for (const fieldName of nestedFields) {
        if (!nestedRequired.has(fieldName)) {
          throw new Error(`Missing nested validator field: ${collectionName}.${objectName}.${fieldName}`);
        }
      }
    }

    for (const indexName of expectedIndexes[collectionName] || []) {
      const index = indexes.find(({ name }) => name === indexName);
      if (!index) {
        throw new Error(`Missing index: ${collectionName}.${indexName}`);
      }
      if (['uq_tors_project_id', 'uq_thumbnails_project_id'].includes(indexName) && (index.key?.projectId !== 1 || Object.keys(index.key).length !== 1 || index.partialFilterExpression || index.sparse)) {
        throw new Error(`Index must cover every string projectId: ${collectionName}.${indexName}`);
      }
      if (indexName.startsWith('uq_') && index.unique !== true) {
        throw new Error(`Index must be unique: ${collectionName}.${indexName}`);
      }
      if (indexName.startsWith('ttl_') && index.expireAfterSeconds !== 0) {
        throw new Error(`Index must expire at the document date: ${collectionName}.${indexName}`);
      }
    }

    console.log(`${collectionName}: ${documentCount} document(s), ${indexCount} index(es)`);
  }

  console.log(`Database verification passed: ${databaseName}`);
} finally {
  await client.close();
}
