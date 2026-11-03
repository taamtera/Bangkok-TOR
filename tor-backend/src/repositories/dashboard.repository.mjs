import { getDatabase } from '../config/database.mjs';

// Aggregate dashboard figures that live in collections the browser cannot read
// directly (matches, vendors, crawl runs, demand tags). TOR-derived figures
// (count, value, methods) are computed on the client from /api/tors.
export async function getDashboardStats() {
  const db = getDatabase();

  const [matchAgg] = await db.collection('company_matches').aggregate([
    { $group: { _id: null, total: { $sum: 1 }, avg: { $avg: '$score' }, companies: { $addToSet: '$companyId' } } }
  ]).toArray();

  const vendors = await db.collection('companies').countDocuments();

  const [crawlAgg] = await db.collection('ingestion_runs').aggregate([
    { $group: { _id: null, runs: { $sum: 1 }, items: { $sum: '$itemsReceived' } } }
  ]).toArray();

  const sourceDocs = await db.collection('sources')
    .find({}, { projection: { name: 1, code: 1 } })
    .toArray();

  const topDemand = await db.collection('tor_announcements').aggregate([
    { $unwind: '$tagAssignments' },
    { $group: { _id: '$tagAssignments.tagId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'tags', localField: '_id', foreignField: '_id', as: 'tag' } },
    { $project: {
      _id: 0,
      count: 1,
      name: { $ifNull: [{ $arrayElemAt: ['$tag.text', 0] }, { $ifNull: [{ $arrayElemAt: ['$tag.name', 0] }, 'ไม่ระบุ'] }] }
    } }
  ]).toArray();

  return {
    matches: {
      total: matchAgg?.total ?? 0,
      avgScore: matchAgg?.avg != null ? Math.round(matchAgg.avg * 10) / 10 : 0,
      companiesMatched: matchAgg?.companies?.length ?? 0
    },
    vendors,
    crawl: { runs: crawlAgg?.runs ?? 0, itemsFetched: crawlAgg?.items ?? 0 },
    sources: { count: sourceDocs.length, names: sourceDocs.map((s) => s.name || s.code).filter(Boolean) },
    topDemand
  };
}
