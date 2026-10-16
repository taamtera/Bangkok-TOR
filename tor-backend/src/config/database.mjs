import { MongoClient, ServerApiVersion } from 'mongodb';
import { env } from './env.mjs';

let client;
let database;

export async function connectDatabase() {
  if (database) {
    return database;
  }

  client = new MongoClient(env.mongodbUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    },
    maxPoolSize: 20,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000
  });

  await client.connect();
  database = client.db(env.mongodbDatabaseName);
  await database.command({ ping: 1 });

  return database;
}

export function getDatabase() {
  if (!database) {
    throw new Error('Database connection has not been initialized.');
  }

  return database;
}

export function startDatabaseSession() {
  if (!client) throw new Error('Database connection has not been initialized.');
  return client.startSession();
}

export async function closeDatabase() {
  if (client) {
    await client.close();
  }

  client = undefined;
  database = undefined;
}

