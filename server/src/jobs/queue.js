import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../middleware/rateLimit.js';

const DEFAULT_OPTS = { connection: redis };

export const validationQueue = new Queue('validation', DEFAULT_OPTS);
export const followupQueue = new Queue('followup', DEFAULT_OPTS);
export const queueEvents = new QueueEvents('validation', DEFAULT_OPTS);

export function enqueueValidation(leadId) {
  return validationQueue.add('auto-validate', { leadId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 500 });
}

export function scheduleFollowupSweep() {
  return followupQueue.add('followup-sweep', {}, {
    repeat: { pattern: '0 * * * *' }, // hourly
    jobId: 'followup-sweep-hourly',
    removeOnComplete: true,
  });
}

export function createWorker(name, handler, opts = {}) {
  return new Worker(name, handler, { connection: redis, concurrency: opts.concurrency || 5 });
}

export function closeQueues() {
  return Promise.allSettled([validationQueue.close(), followupQueue.close(), redis.quit()]);
}