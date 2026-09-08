import { MongoClient } from 'mongodb';
import { createGzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const [uri, dbName, output] = process.argv.slice(2);
if (!uri || !dbName || !output) {
  console.error('usage: node mongo-backup.mjs <uri> <dbName> <output.json.gz>');
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
await client.connect();
const db = client.db(dbName);

const out = { exported_at: new Date().toISOString(), db: dbName, collections: {} };

for (const { name } of await db.listCollections().toArray()) {
  const docs = await db.collection(name).find({}, { sort: { _id: 1 } }).toArray();
  out.collections[name] = docs;
}

await pipeline(
  Readable.from([JSON.stringify(out)]),
  createGzip(),
  createWriteStream(output),
);

await client.close();
console.log(`[mongo-backup] exported ${Object.keys(out.collections).length} collections to ${output}`);