import { MongoClient, ServerApiVersion } from 'mongodb';
import { loadEnvironment } from './env.mjs';
import { ingestionDefinitions, ingestionIndexes, retiredIdentityIndexes, assertProjectIdentitiesReady } from './ingestion-schema.mjs';

const { uri, databaseName } = loadEnvironment();
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true
  }
});

const collectionDefinitions = {
  ...ingestionDefinitions,
  sources: {
    required: ['code', 'name', 'baseUrl', 'adapterType', 'enabled', 'rawRetentionDays', 'createdAt', 'updatedAt'],
    properties: {
      code: { bsonType: 'string', minLength: 2 },
      name: { bsonType: 'string', minLength: 2 },
      baseUrl: { bsonType: 'string', minLength: 8 },
      adapterType: { bsonType: 'string', minLength: 2 },
      enabled: { bsonType: 'bool' },
      rawRetentionDays: { bsonType: ['int', 'long'], minimum: 1, maximum: 365 },
      crawlSchedule: { bsonType: 'object' },
      lastSuccessfulRunAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  organizations: {
    required: ['sourceId', 'nameTh', 'organizationType', 'ancestorIds', 'createdAt', 'updatedAt'],
    properties: {
      sourceId: { bsonType: 'objectId' },
      externalId: { bsonType: ['string', 'null'] },
      nameTh: { bsonType: 'string', minLength: 2 },
      nameEn: { bsonType: ['string', 'null'] },
      organizationType: { enum: ['agency', 'department', 'purchasing_unit'] },
      parentOrganizationId: { bsonType: ['objectId', 'null'] },
      ancestorIds: { bsonType: 'array', items: { bsonType: 'objectId' } },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  procurement_projects: {
    required: ['sourceId', 'externalProjectId', 'organizationId', 'createdAt', 'updatedAt'],
    properties: {
      sourceId: { bsonType: 'objectId' },
      externalProjectId: { bsonType: 'string', minLength: 1 },
      organizationId: { bsonType: 'objectId' },
      title: { bsonType: ['string', 'null'] },
      summary: { bsonType: ['string', 'null'] },
      metadata: { bsonType: 'object' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  tor_versions: {
    required: ['torId', 'version', 'contentHash', 'changeType', 'snapshot', 'capturedAt'],
    properties: {
      torId: { bsonType: 'objectId' },
      version: { bsonType: ['int', 'long'], minimum: 1 },
      contentHash: { bsonType: 'string', minLength: 8 },
      changeType: { enum: ['created', 'updated', 'cancelled', 'restored'] },
      changedFields: { bsonType: 'array', items: { bsonType: 'string' } },
      snapshot: { bsonType: 'object' },
      rawItem: { bsonType: ['object', 'string', 'null'] },
      ingestionRunId: { bsonType: ['objectId', 'null'] },
      capturedAt: { bsonType: 'date' }
    }
  },
  raw_ingestion_items: {
    required: ['ingestionRunId', 'sourceId', 'environment', 'sourceUrl', 'contentHash', 'processingStatus', 'validationErrors', 'expiresAt', 'createdAt', 'updatedAt'],
    properties: {
      ingestionRunId: { bsonType: 'objectId' },
      sourceId: { bsonType: 'objectId' },
      environment: { enum: ['development', 'test', 'production'] },
      sourceUrl: { bsonType: 'string', minLength: 8 },
      externalProjectId: { bsonType: ['string', 'null'] },
      templateType: { bsonType: ['string', 'null'] },
      tempAnnoun: { bsonType: ['string', 'null'] },
      tempItemNo: { bsonType: ['string', 'null'] },
      seqNo: { bsonType: ['string', 'null'] },
      announcementKey: { bsonType: ['string', 'null'] },
      contentHash: { bsonType: 'string', minLength: 8 },
      rawPayload: { bsonType: ['object', 'string', 'null'] },
      rawPayloadLocation: { bsonType: ['string', 'null'] },
      processingStatus: { enum: ['pending', 'normalized', 'rejected', 'failed'] },
      validationErrors: { bsonType: 'array', items: { bsonType: 'object' } },
      normalizedPreview: { bsonType: ['object', 'null'] },
      normalizedTorId: { bsonType: ['objectId', 'null'] },
      expiresAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  rss_query_state: {
    required: ['sourceId', 'date', 'queryKey', 'reportedCount', 'itemsReceived', 'complete', 'splitLevel', 'status', 'retryCount', 'lastCheckedAt', 'createdAt', 'updatedAt'],
    properties: {
      sourceId: { bsonType: 'objectId' },
      date: { bsonType: 'date' },
      departmentId: { bsonType: ['string', 'null'] },
      subdepartmentId: { bsonType: ['string', 'null'] },
      announcementType: { bsonType: ['string', 'null'] },
      methodId: { bsonType: ['string', 'null'] },
      queryKey: { bsonType: 'string', minLength: 3 },
      reportedCount: { bsonType: ['int', 'long'], minimum: 0 },
      itemsReceived: { bsonType: ['int', 'long'], minimum: 0 },
      complete: { bsonType: 'bool' },
      splitLevel: { bsonType: ['int', 'long'], minimum: 0 },
      status: { enum: ['pending', 'running', 'complete', 'partial', 'failed'] },
      retryCount: { bsonType: ['int', 'long'], minimum: 0 },
      nextRetryAt: { bsonType: ['date', 'null'] },
      lastCheckedAt: { bsonType: 'date' },
      lastIngestionRunId: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  users: {
    required: ['email', 'emailNormalized', 'passwordHash', 'profile', 'role', 'status', 'failedLoginAttempts', 'passwordChangedAt', 'termsAcceptedAt', 'notificationPreferences', 'createdAt', 'updatedAt'],
    properties: {
      email: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
      emailNormalized: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
      passwordHash: { bsonType: 'string', minLength: 20 },
      displayName: { bsonType: ['string', 'null'] },
      profile: {
        bsonType: 'object',
        required: ['firstName', 'lastName'],
        properties: {
          firstName: { bsonType: 'string', minLength: 1 },
          lastName: { bsonType: 'string', minLength: 1 },
          phone: { bsonType: ['string', 'null'] },
          avatarUrl: { bsonType: ['string', 'null'] },
          jobTitle: { bsonType: ['string', 'null'] }
        }
      },
      role: { enum: ['company_admin', 'company_member', 'project_manager', 'system_admin'] },
      companyId: { bsonType: ['objectId', 'null'] },
      notificationPreferences: {
        bsonType: 'object',
        required: ['channels', 'alertTypes'],
        properties: {
          channels: {
            bsonType: 'array',
            items: { enum: ['in_app', 'email'] }
          },
          alertTypes: {
            bsonType: 'array',
            items: { enum: ['new_match', 'tor_updated', 'deadline_reminder'] }
          },
          deadlineReminderDays: { bsonType: ['int', 'long'], minimum: 1, maximum: 30 }
        }
      },
      status: { enum: ['pending_verification', 'active', 'suspended', 'disabled'] },
      registrationSource: { enum: ['self', 'invitation', 'admin'] },
      emailVerifiedAt: { bsonType: ['date', 'null'] },
      lastLoginAt: { bsonType: ['date', 'null'] },
      failedLoginAttempts: { bsonType: ['int', 'long'], minimum: 0 },
      lockedUntil: { bsonType: ['date', 'null'] },
      passwordChangedAt: { bsonType: 'date' },
      termsAcceptedAt: { bsonType: 'date' },
      deletedAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  auth_tokens: {
    required: ['type', 'tokenHash', 'emailNormalized', 'expiresAt', 'createdAt'],
    properties: {
      type: { enum: ['email_verification', 'password_reset', 'company_invitation'] },
      tokenHash: { bsonType: 'string', minLength: 32 },
      userId: { bsonType: ['objectId', 'null'] },
      companyId: { bsonType: ['objectId', 'null'] },
      emailNormalized: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
      expiresAt: { bsonType: 'date' },
      usedAt: { bsonType: ['date', 'null'] },
      revokedAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' }
    }
  },
  sessions: {
    required: ['userId', 'refreshTokenHash', 'status', 'expiresAt', 'createdAt', 'lastUsedAt'],
    properties: {
      userId: { bsonType: 'objectId' },
      refreshTokenHash: { bsonType: 'string', minLength: 32 },
      status: { enum: ['active', 'revoked'] },
      userAgent: { bsonType: ['string', 'null'] },
      ipAddressHash: { bsonType: ['string', 'null'] },
      expiresAt: { bsonType: 'date' },
      lastUsedAt: { bsonType: 'date' },
      revokedAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' }
    }
  },
  audit_logs: {
    required: ['event', 'outcome', 'targetType', 'createdAt'],
    properties: {
      actorUserId: { bsonType: ['objectId', 'null'] },
      event: { bsonType: 'string', minLength: 3 },
      outcome: { enum: ['success', 'failure'] },
      targetType: { bsonType: 'string', minLength: 2 },
      targetId: { bsonType: ['objectId', 'null'] },
      requestId: { bsonType: ['string', 'null'] },
      userAgent: { bsonType: ['string', 'null'] },
      ipAddressHash: { bsonType: ['string', 'null'] },
      metadata: { bsonType: 'object' },
      expiresAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' }
    }
  },
  companies: {
    required: ['legalName', 'displayName', 'companySize', 'technologies', 'qualifications', 'verificationStatus', 'createdAt', 'updatedAt'],
    properties: {
      legalName: { bsonType: 'string', minLength: 2 },
      description: { bsonType: 'string', maxLength: 2000 },
      certifications: { bsonType: 'array', maxItems: 100, items: { bsonType: 'string', maxLength: 200 } },
      displayName: { bsonType: 'string', minLength: 2 },
      taxId: { bsonType: ['string', 'null'] },
      companySize: { bsonType: 'string' },
      district: { bsonType: ['string', 'null'] },
      contact: { bsonType: 'object' },
      technologies: { bsonType: 'array', items: { bsonType: 'string' } },
      qualifications: { bsonType: 'array', items: { bsonType: 'object' } },
      tagAssignments: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['tagId', 'source', 'confidence', 'verificationLevel', 'reviewStatus', 'assignedAt'],
          properties: {
            tagId: { bsonType: 'objectId' },
            source: { enum: ['manual', 'ai', 'crawler'] },
            confidence: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 1 },
            verificationLevel: { enum: ['claimed', 'experienced', 'verified'] },
            reviewStatus: { enum: ['suggested', 'approved', 'rejected'] },
            evidence: { bsonType: ['string', 'null'] },
            reviewedByUserId: { bsonType: ['objectId', 'null'] },
            reviewedAt: { bsonType: ['date', 'null'] },
            assignedAt: { bsonType: 'date' }
          }
        }
      },
      ownerUserId: { bsonType: ['objectId', 'null'] },
      memberUserIds: { bsonType: 'array', items: { bsonType: 'objectId' } },
      profileCompleteness: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 100 },
      verificationStatus: { enum: ['unverified', 'pending', 'verified', 'rejected'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  tags: {
    required: ['name', 'normalizedName', 'slug', 'category', 'aliases', 'status', 'createdAt', 'updatedAt'],
    properties: {
      name: { bsonType: 'string', minLength: 2 },
      normalizedName: { bsonType: 'string', minLength: 2 },
      slug: { bsonType: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      category: { enum: ['technology', 'skill', 'certification', 'industry', 'project_type', 'capability', 'requirement'] },
      aliases: { bsonType: 'array', items: { bsonType: 'string', minLength: 1 } },
      description: { bsonType: ['string', 'null'] },
      status: { enum: ['active', 'inactive'] },
      createdByUserId: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  requirement_sources: {
    required: ['torId', 'torVersion', 'sourceUrl', 'documentHash', 'pages', 'fetchedAt', 'createdAt'],
    properties: {
      torId: { bsonType: 'objectId' }, torVersion: { bsonType: ['int', 'long'], minimum: 1 },
      sourceUrl: { bsonType: 'string' }, documentHash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
      pages: { bsonType: 'array', maxItems: 200, items: { bsonType: 'object', required: ['page', 'text'],
        properties: { page: { bsonType: ['int', 'long'], minimum: 1 }, text: { bsonType: 'string' } } } },
      fetchedAt: { bsonType: 'date' }, createdAt: { bsonType: 'date' }
    }
  },
  ai_evaluations: {
    required: ['torId', 'torVersion', 'status', 'retryCount', 'lastAttemptAt', 'nextAttemptAt', 'lastError', 'requirements', 'model', 'createdAt', 'updatedAt'],
    properties: {
      torId: { bsonType: 'objectId' },
      torVersion: { bsonType: ['int', 'long'], minimum: 1 },
      status: { enum: ['queued', 'processing', 'completed', 'failed'] },
      retryCount: { bsonType: ['int', 'long'], minimum: 0 },
      lastAttemptAt: { bsonType: ['date', 'null'] },
      nextAttemptAt: { bsonType: ['date', 'null'] },
      lastError: {
        bsonType: ['object', 'null'],
        required: ['code', 'message', 'retryable'],
        properties: {
          code: { bsonType: 'string', minLength: 2 },
          message: { bsonType: 'string', minLength: 2 },
          retryable: { bsonType: 'bool' }
        }
      },
      requirements: { bsonType: 'array', items: { bsonType: 'object' } },
      budgetObservation: { bsonType: ['object', 'null'] },
      riskFlags: { bsonType: 'array', items: { bsonType: 'object' } },
      summary: { bsonType: ['string', 'null'] },
      model: { bsonType: 'object' },
      generatedAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  company_matches: {
    required: ['companyId', 'torId', 'torVersion', 'score', 'requirementMatches', 'computedAt', 'createdAt', 'updatedAt'],
    properties: {
      companyId: { bsonType: 'objectId' },
      torId: { bsonType: 'objectId' },
      torVersion: { bsonType: ['int', 'long'], minimum: 1 },
      score: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 100 },
      // Retained for old records only. New Python results contain requirement
      // coverage; AI suitability recommendations are a separate stage.
      recommendation: { enum: ['strong_match', 'possible_match', 'not_recommended'] },
      resultType: { enum: ['requirement_match'] },
      dataMode: { enum: ['demo', 'source'] },
      evidenceScore: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 100 },
      status: { enum: ['compared', 'requirements_unavailable'] },
      counts: { bsonType: 'object' },
      companyCapabilities: { bsonType: 'array', items: { bsonType: 'object' } },
      requirementMatches: { bsonType: 'array', items: { bsonType: 'object' } },
      strengths: { bsonType: 'array', items: { bsonType: 'string' } },
      gaps: { bsonType: 'array', items: { bsonType: 'string' } },
      explanation: { bsonType: ['string', 'null'] },
      profileCompleteness: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 100 },
      policyVersion: { bsonType: ['int', 'long'], minimum: 1 },
      computedAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  company_tor_evaluations: {
    required: ['companyId', 'torId', 'projectId', 'inputHash', 'status', 'requestId', 'createdAt', 'updatedAt'],
    properties: {
      companyId: { bsonType: 'objectId' }, torId: { bsonType: 'objectId' }, projectId: { bsonType: 'string' },
      inputHash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' }, requestId: { bsonType: 'string' },
      status: { enum: ['processing', 'completed', 'failed'] },
      evaluation: { bsonType: ['object', 'null'] }, error: { bsonType: ['object', 'null'] },
      leaseExpiresAt: { bsonType: 'date' }, completedAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' }
    }
  },
  saved_tors: {
    required: ['userId', 'torId', 'followUpStatus', 'createdAt', 'updatedAt'],
    properties: {
      userId: { bsonType: 'objectId' },
      torId: { bsonType: 'objectId' },
      note: { bsonType: ['string', 'null'] },
      followUpStatus: { enum: ['watching', 'reviewing', 'preparing_bid', 'submitted', 'dismissed'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    }
  },
  notifications: {
    required: ['eventKey', 'userId', 'type', 'channel', 'status', 'attemptCount', 'nextAttemptAt', 'deliveryError', 'title', 'message', 'createdAt'],
    properties: {
      eventKey: { bsonType: 'string', minLength: 3 },
      userId: { bsonType: 'objectId' },
      companyId: { bsonType: ['objectId', 'null'] },
      torId: { bsonType: ['objectId', 'null'] },
      type: { enum: ['new_match', 'tor_updated', 'deadline_reminder', 'system'] },
      channel: { enum: ['in_app', 'email'] },
      status: { enum: ['queued', 'sent', 'failed', 'read'] },
      attemptCount: { bsonType: ['int', 'long'], minimum: 0 },
      nextAttemptAt: { bsonType: ['date', 'null'] },
      deliveryError: {
        bsonType: ['object', 'null'],
        required: ['code', 'message', 'lastAttemptAt'],
        properties: {
          code: { bsonType: 'string', minLength: 2 },
          message: { bsonType: 'string', minLength: 2 },
          lastAttemptAt: { bsonType: 'date' }
        }
      },
      title: { bsonType: 'string', minLength: 2 },
      message: { bsonType: 'string', minLength: 2 },
      sentAt: { bsonType: ['date', 'null'] },
      readAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' }
    }
  }
};

const indexes = {
  ...ingestionIndexes,
  sources: [
    [{ code: 1 }, { unique: true, name: 'uq_sources_code' }],
    [{ enabled: 1, lastSuccessfulRunAt: 1 }, { name: 'ix_sources_schedule' }]
  ],
  organizations: [
    [{ sourceId: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } }, name: 'uq_organizations_source_external' }],
    [{ parentOrganizationId: 1, organizationType: 1 }, { name: 'ix_organizations_parent_type' }],
    [{ ancestorIds: 1 }, { name: 'ix_organizations_ancestors' }],
    [{ nameTh: 1 }, { name: 'ix_organizations_name_th' }]
  ],
  procurement_projects: [
    [{ sourceId: 1, externalProjectId: 1 }, { unique: true, name: 'uq_projects_source_external' }],
    [{ organizationId: 1, updatedAt: -1 }, { name: 'ix_projects_organization_updated' }],
    [{ sourceId: 1, updatedAt: -1 }, { name: 'ix_projects_source_updated' }]
  ],
  tor_versions: [
    [{ torId: 1, version: 1 }, { unique: true, name: 'uq_tor_versions_number' }],
    [{ torId: 1, contentHash: 1 }, { unique: true, name: 'uq_tor_versions_content' }],
    [{ capturedAt: -1 }, { name: 'ix_tor_versions_captured' }]
  ],
  raw_ingestion_items: [
    [{ ingestionRunId: 1, sourceId: 1, contentHash: 1 }, { unique: true, name: 'uq_raw_run_source_content' }],
    [{ ingestionRunId: 1, processingStatus: 1 }, { name: 'ix_raw_run_status' }],
    [{ environment: 1, processingStatus: 1, createdAt: -1 }, { name: 'ix_raw_environment_status' }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_raw_ingestion_expiry' }]
  ],
  rss_query_state: [
    [{ sourceId: 1, queryKey: 1 }, { unique: true, name: 'uq_rss_query_source_key' }],
    [{ sourceId: 1, date: -1, status: 1 }, { name: 'ix_rss_query_source_date_status' }],
    [{ status: 1, nextRetryAt: 1 }, { name: 'ix_rss_query_retry_queue' }],
    [{ lastIngestionRunId: 1 }, { name: 'ix_rss_query_ingestion_run' }]
  ],
  users: [
    [{ emailNormalized: 1 }, { unique: true, name: 'uq_users_email_normalized' }],
    [{ companyId: 1, status: 1 }, { name: 'ix_users_company_status' }],
    [{ status: 1, lockedUntil: 1 }, { name: 'ix_users_status_lock' }]
  ],
  auth_tokens: [
    [{ tokenHash: 1 }, { unique: true, name: 'uq_auth_tokens_hash' }],
    [{ userId: 1, type: 1, createdAt: -1 }, { name: 'ix_auth_tokens_user_type' }],
    [{ emailNormalized: 1, type: 1, createdAt: -1 }, { name: 'ix_auth_tokens_email_type' }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_auth_tokens_expiry' }]
  ],
  sessions: [
    [{ refreshTokenHash: 1 }, { unique: true, name: 'uq_sessions_refresh_hash' }],
    [{ userId: 1, status: 1, expiresAt: -1 }, { name: 'ix_sessions_user_status' }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_sessions_expiry' }]
  ],
  audit_logs: [
    [{ actorUserId: 1, createdAt: -1 }, { name: 'ix_audit_actor_created' }],
    [{ event: 1, outcome: 1, createdAt: -1 }, { name: 'ix_audit_event_outcome' }],
    [{ targetType: 1, targetId: 1, createdAt: -1 }, { name: 'ix_audit_target_created' }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_audit_expiry' }]
  ],
  companies: [
    [{ taxId: 1 }, { unique: true, partialFilterExpression: { taxId: { $type: 'string' } }, name: 'uq_companies_tax_id' }],
    [{ verificationStatus: 1, profileCompleteness: -1 }, { name: 'ix_companies_verification_profile' }],
    [{ technologies: 1 }, { name: 'ix_companies_technologies' }],
    [{ 'tagAssignments.tagId': 1, verificationStatus: 1 }, { name: 'ix_companies_tags_verification' }]
  ],
  tags: [
    [{ category: 1, text: 1 }, { unique: true, name: 'uq_tags_category_text' }],
    [{ category: 1, status: 1, name: 1 }, { name: 'ix_tags_category_status_name' }],
    [{ aliases: 1 }, { name: 'ix_tags_aliases' }]
  ],
  requirement_sources: [
    [{ torId: 1, torVersion: 1, sourceUrl: 1, documentHash: 1 }, { unique: true, name: 'uq_requirement_source' }]
  ],
  ai_evaluations: [
    [{ torId: 1, torVersion: 1 }, { unique: true, name: 'uq_ai_tor_version' }],
    [{ status: 1, nextAttemptAt: 1, createdAt: 1 }, { name: 'ix_ai_queue_ready' }]
  ],
  company_matches: [
    [{ companyId: 1, torId: 1, torVersion: 1 }, { unique: true, name: 'uq_matches_company_tor_version' }],
    [{ companyId: 1, score: -1, computedAt: -1 }, { name: 'ix_matches_company_score' }],
    [{ torId: 1, score: -1 }, { name: 'ix_matches_tor_score' }]
  ],
  company_tor_evaluations: [
    [{ companyId: 1, projectId: 1, inputHash: 1 }, { unique: true, name: 'uq_company_tor_evaluation_input' }]
  ],
  saved_tors: [
    [{ userId: 1, torId: 1 }, { unique: true, name: 'uq_saved_user_tor' }],
    [{ userId: 1, followUpStatus: 1, updatedAt: -1 }, { name: 'ix_saved_user_status' }]
  ],
  notifications: [
    [{ eventKey: 1 }, { unique: true, name: 'uq_notifications_event' }],
    [{ userId: 1, status: 1, createdAt: -1 }, { name: 'ix_notifications_user_status' }],
    [{ status: 1, nextAttemptAt: 1, createdAt: 1 }, { name: 'ix_notifications_delivery_queue' }]
  ]
};

const obsoleteIndexes = {
  tags: ['uq_tags_category_name', 'uq_tags_slug'],
  thumbnails: retiredIdentityIndexes.thumbnails,
  users: ['uq_users_email'],
  ai_evaluations: ['ix_ai_status_created'],
  notifications: ['ix_notifications_delivery_queue'],
  tor_announcements: [
    ...retiredIdentityIndexes.tor_announcements,
    'uq_tors_source_dedup',
    'uq_announcements_source_key',
    'ix_announcements_project_published',
    'ix_tors_status_deadline',
    'ix_tors_category_budget',
    'ix_tors_organization_published',
    'ix_tors_organization_ancestors_published',
    'ix_tors_source_seen',
    'tx_tors_discovery'
  ],
  ingestion_runs: [
    'ix_ingestion_status_started',
    'ix_ingestion_source_started',
    'ix_ingestion_environment_status',
    'ix_ingestion_triggered_started'
  ]
};

function validatorFor(definition) {
  return {
    $jsonSchema: {
      bsonType: 'object',
      required: definition.required,
      properties: definition.properties
    }
  };
}

async function createOrUpdateCollection(database, collectionName, definition) {
  const exists = await database.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();
  // The simplified tag contract is specified in the application, not enforced
  // through MongoDB JSON-schema validation. Optional metadata may be omitted.
  const validator = collectionName === 'tags' ? {} : validatorFor(definition);
  const validationLevel = collectionName === 'tags' ? 'off' : 'strict';

  if (!exists) {
    await database.createCollection(collectionName, {
      validator,
      validationLevel,
      validationAction: 'error'
    });
    console.log(`Created collection: ${collectionName}`);
    return;
  }

  await database.command({
    collMod: collectionName,
    validator,
    validationLevel,
    validationAction: 'error'
  });
  console.log(`Updated validation: ${collectionName}`);
}

try {
  await client.connect();
  const database = client.db(databaseName);
  await database.command({ ping: 1 });

  await assertProjectIdentitiesReady(database);

  for (const [collectionName, definition] of Object.entries(collectionDefinitions)) {
    await createOrUpdateCollection(database, collectionName, definition);
  }

  for (const [collectionName, collectionIndexes] of Object.entries(indexes)) {
    const collection = database.collection(collectionName);
    const existingIndexNames = new Set((await collection.listIndexes().toArray()).map(({ name }) => name));

    for (const obsoleteIndexName of obsoleteIndexes[collectionName] || []) {
      if (existingIndexNames.has(obsoleteIndexName)) {
        await collection.dropIndex(obsoleteIndexName);
        console.log(`Removed obsolete index: ${collectionName}.${obsoleteIndexName}`);
      }
    }

    for (const [keys, options] of collectionIndexes) {
      await collection.createIndex(keys, options);
    }

    console.log(`Created indexes: ${collectionName}`);
  }

  console.log(`Database setup complete: ${databaseName}`);
} finally {
  await client.close();
}
