import { ensureIndexes, close } from './mongodb.js';

// The old SQL schema has been replaced by MongoDB. "Migration" now just means
// ensuring collections exist with the right unique/query indexes (idempotent).
try {
  await ensureIndexes();
  console.log('[migrate] ensured MongoDB collections + indexes');
} finally {
  await close();
}