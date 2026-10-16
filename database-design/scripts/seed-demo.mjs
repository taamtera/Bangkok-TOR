import { MongoClient, ServerApiVersion } from 'mongodb';
import { loadEnvironment } from './env.mjs';

const { uri, databaseName } = loadEnvironment();
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

const now = new Date();

async function upsertAndGetId(collection, filter, document) {
  const result = await collection.findOneAndUpdate(
    filter,
    {
      $set: { ...document, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, returnDocument: 'after', includeResultMetadata: false }
  );

  return result._id;
}

try {
  await client.connect();
  const database = client.db(databaseName);
  await database.command({ ping: 1 });

  const sourceSamples = [
    { code: 'EGP', name: 'Thai Government Procurement', baseUrl: 'https://www.gprocurement.go.th', adapterType: 'egp-feed', enabled: true },
    { code: 'BMA', name: 'Bangkok Metropolitan Administration', baseUrl: 'https://www.bangkok.go.th', adapterType: 'bma-procurement', enabled: true },
    { code: 'DGA', name: 'Digital Government Development Agency', baseUrl: 'https://www.dga.or.th', adapterType: 'dga-procurement', enabled: true },
    { code: 'ETDA', name: 'Electronic Transactions Development Agency', baseUrl: 'https://www.etda.or.th', adapterType: 'etda-procurement', enabled: true },
    { code: 'DEPA', name: 'Digital Economy Promotion Agency', baseUrl: 'https://www.depa.or.th', adapterType: 'depa-procurement', enabled: true },
    { code: 'NSTDA', name: 'National Science and Technology Development Agency', baseUrl: 'https://www.nstda.or.th', adapterType: 'nstda-procurement', enabled: true }
  ];

  const sourceIds = {};
  for (const source of sourceSamples) {
    sourceIds[source.code] = await upsertAndGetId(database.collection('sources'), { code: source.code }, {
      ...source,
      rawRetentionDays: 14,
      crawlSchedule: { frequency: 'daily', timezone: 'Asia/Bangkok' },
      lastSuccessfulRunAt: null
    });
  }

  const organizationId = await upsertAndGetId(
    database.collection('organizations'),
    { sourceId: sourceIds.BMA, externalId: 'BMA-MEDICAL-SERVICE' },
    {
      sourceId: sourceIds.BMA,
      externalId: 'BMA-MEDICAL-SERVICE',
      nameTh: 'Medical Service Department, Bangkok Metropolitan Administration',
      nameEn: 'Medical Service Department, Bangkok Metropolitan Administration',
      organizationType: 'department',
      parentOrganizationId: null,
      ancestorIds: []
    }
  );

  const tagSamples = [
    { name: 'Node.js', normalizedName: 'node.js', slug: 'nodejs', category: 'technology', aliases: ['NodeJS', 'Node JS'] },
    { name: 'MongoDB', normalizedName: 'mongodb', slug: 'mongodb', category: 'technology', aliases: ['Mongo DB'] },
    { name: 'Docker', normalizedName: 'docker', slug: 'docker', category: 'technology', aliases: [] },
    { name: 'ISO 27001', normalizedName: 'iso 27001', slug: 'iso-27001', category: 'certification', aliases: ['ISO/IEC 27001'] },
    { name: 'Microservices', normalizedName: 'microservices', slug: 'microservices', category: 'capability', aliases: ['Microservice Architecture'] },
    { name: 'Web Development', normalizedName: 'web development', slug: 'web-development', category: 'project_type', aliases: ['Web Application'] }
  ];
  const tagIds = {};

  for (const tag of tagSamples) {
    tagIds[tag.slug] = await upsertAndGetId(database.collection('tags'), { slug: tag.slug }, {
      ...tag,
      text: tag.name,
      type: tag.category === 'certification' ? 'contractor_requirement' : 'specification',
      description: null,
      status: 'active',
      createdByUserId: null
    });
  }

  const companyTagAssignments = [
    ['nodejs', 'experienced'],
    ['mongodb', 'experienced'],
    ['docker', 'experienced'],
    ['iso-27001', 'verified'],
    ['microservices', 'verified'],
    ['web-development', 'experienced']
  ].map(([slug, verificationLevel]) => ({
    tagId: tagIds[slug],
    source: 'manual',
    confidence: 1,
    verificationLevel,
    reviewStatus: 'approved',
    evidence: null,
    reviewedByUserId: null,
    reviewedAt: now,
    assignedAt: now
  }));

  const companyId = await upsertAndGetId(
    database.collection('companies'),
    { taxId: 'DEMO-0105566123456' },
    {
      legalName: 'TechBangkok Solutions Co., Ltd.',
      displayName: 'TechBangkok Solutions',
      taxId: 'DEMO-0105566123456',
      companySize: '25-50 Employees',
      district: 'Chatuchak',
      contact: { email: 'contact@example.com', phone: null, website: null },
      technologies: ['Next.js', 'React', 'TypeScript', 'Node.js', 'MongoDB', 'Docker', 'Google Cloud'],
      qualifications: [
        { code: 'ISO-27001', name: 'ISO 27001 Information Security Certified', category: 'certification', verified: true, evidenceUrl: null },
        { code: 'MICROSERVICES', name: 'Node.js and Microservices Architecture', category: 'capability', verified: true, evidenceUrl: null }
      ],
      tagAssignments: companyTagAssignments,
      ownerUserId: null,
      memberUserIds: [],
      profileCompleteness: 92,
      verificationStatus: 'verified'
    }
  );

  const userId = await upsertAndGetId(
    database.collection('users'),
    { emailNormalized: 'somchai@example.com' },
    {
      email: 'somchai@example.com',
      emailNormalized: 'somchai@example.com',
      displayName: 'Somchai Jaidee',
      passwordHash: '$2b$12$DEMO_ONLY_REPLACE_WITH_A_REAL_BCRYPT_HASH',
      profile: {
        firstName: 'Somchai',
        lastName: 'Jaidee',
        phone: null,
        avatarUrl: null,
        jobTitle: 'Company Administrator'
      },
      role: 'company_admin',
      companyId,
      notificationPreferences: {
        channels: ['in_app', 'email'],
        alertTypes: ['new_match', 'tor_updated', 'deadline_reminder'],
        deadlineReminderDays: 7
      },
      status: 'active',
      registrationSource: 'self',
      emailVerifiedAt: now,
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      termsAcceptedAt: now,
      deletedAt: null
    }
  );

  await database.collection('companies').updateOne(
    { _id: companyId },
    { $set: { ownerUserId: userId, memberUserIds: [userId], updatedAt: now } }
  );

  await database.collection('audit_logs').updateOne(
    { actorUserId: userId, event: 'user.registration', 'metadata.demoSeed': true },
    {
      $setOnInsert: {
        actorUserId: userId,
        event: 'user.registration',
        outcome: 'success',
        targetType: 'user',
        targetId: userId,
        requestId: null,
        userAgent: null,
        ipAddressHash: null,
        metadata: { demoSeed: true, registrationSource: 'self' },
        createdAt: now
      }
    },
    { upsert: true }
  );

  console.log(`Non-RSS demo data is ready in MongoDB Atlas database: ${databaseName}`);
} finally {
  await client.close();
}
