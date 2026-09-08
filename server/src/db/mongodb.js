import { MongoClient } from 'mongodb';
import { config } from '../config.js';

const client = new MongoClient(config.mongodbUri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
});

await client.connect();

export const mongo = client;
export const db = client.db(config.mongodbName);
export const col = (name) => db.collection(name);

const counters = db.collection('counters');

/**
 * Numeric auto-increment ID (mirrors the old Postgres SERIAL keys so route IDs,
 * JWT subjects and CSV output keep working unchanged). The value lives in a
 * counters collection and is incremented atomically.
 */
export async function nextId(name) {
  const doc = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { val: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.val;
}

/**
 * Insert one doc with a numeric id. `_id` equals `id` so reads never need a mapper
 * and `doc.id` continues to behave like the old `rows[0].id`.
 */
export async function insertOne(name, doc) {
  const id = await nextId(name);
  const now = new Date();
  const full = {
    _id: id,
    id,
    created_at: doc.created_at || now,
    updated_at: doc.updated_at || now,
    ...doc,
  };
  await col(name).insertOne(full);
  return full;
}

export async function close() {
  await client.close();
}

/** All collections + indexes that mirror the old relational schema. */
export async function ensureIndexes() {
  await Promise.all([
    col('users').createIndex({ email: 1 }, { unique: true }),
    col('users').createIndex({ referral_code: 1 }, { unique: true, sparse: true }),
    col('users').createIndex({ role: 1, status: 1 }),
    col('leads').createIndex({ email: 1 }),
    col('leads').createIndex({ whatsapp_number: 1 }),
    col('leads').createIndex({ agent_id: 1, status: 1 }),
    col('leads').createIndex({ status: 1, created_at: 1 }),
    col('leads').createIndex({ agent_id: 1, created_at: -1 }),
    col('commission_rates').createIndex({ type: 1, _id: -1 }),
    col('earnings').createIndex({ agent_id: 1, created_at: -1 }),
    col('earnings').createIndex({ lead_id: 1, type: 1 }, { unique: true }),
    col('payout_requests').createIndex({ agent_id: 1, created_at: -1 }),
    col('payout_requests').createIndex({ status: 1, created_at: 1 }),
    col('audit_logs').createIndex({ user_id: 1, created_at: -1 }),
    col('audit_logs').createIndex({ action: 1, created_at: -1 }),
    col('audit_logs').createIndex({ created_at: -1 }),
    col('notifications').createIndex({ user_id: 1, is_read: 1, created_at: -1 }),
  ]);
}