import Redis from 'ioredis';
import crypto from 'node:crypto';
import { config } from '../config.js';

// Lazy-connected shared Redis client used by rate limits + queues.
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (e) => console.error('[redis] error:', e.message));

/**
 * Redis-backed sliding-window rate limiter.
 * windows: array of { max, windowMs } — counts requests per key.
 */
export function rateLimiter({ windows, keyPrefix = 'rl', message = 'Too many requests. Please slow down.' }) {
  return async (req, res, next) => {
    const key = `${keyPrefix}:${req.ip || 'unknown'}`;
    try {
      const now = Date.now();
      const pipeline = redis.pipeline();
      for (const w of windows) {
        const wKey = `${key}:${w.windowMs}`;
        pipeline.zremrangebyscore(wKey, 0, now - w.windowMs);
        pipeline.zcard(wKey);
      }
      const results = await pipeline.exec();
      // zremrangebyscore returns [null, 0]; zcard returns [null, count]
      const counts = [];
      for (let i = 0; i < windows.length; i++) {
        counts.push(results[i * 2 + 1][1]);
      }
      const limited = windows.some((w, i) => counts[i] >= w.max);

      if (limited) {
        res.set('Retry-After', String(Math.ceil(windows[0].windowMs / 1000)));
        return res.status(429).json({ message });
      }

      const addPipeline = redis.pipeline();
      windows.forEach((w, i) => {
        const wKey = `${key}:${w.windowMs}`;
        const member = `${now}:${crypto.randomUUID()}`;
        addPipeline.zadd(wKey, now, member);
        addPipeline.expire(wKey, Math.ceil(w.windowMs / 1000) + 1);
      });
      await addPipeline.exec();
      next();
    } catch (e) {
      console.error('[ratelimit] error:', e.message);
      next();
    }
  };
}

// Named, reusable limiters
export const authLimiter = rateLimiter({
  windows: [
    { max: config.rateLimit.authMax, windowMs: config.rateLimit.authWindowMin * 60 * 1000 },
    { max: config.rateLimit.authMax * 6, windowMs: 60 * 60 * 1000 },
  ],
  keyPrefix: 'rl:auth',
  message: 'Too many login attempts. Try again later.',
});

export const registerLimiter = rateLimiter({
  windows: [{ max: 5, windowMs: 60 * 60 * 1000 }],
  keyPrefix: 'rl:register',
  message: 'Too many signups from this address. Try again later.',
});

export const leadSubmissionLimiter = rateLimiter({
  windows: [
    { max: config.rateLimit.leadMax, windowMs: config.rateLimit.leadWindowMin * 60 * 1000 },
    { max: 60, windowMs: 60 * 60 * 1000 },
  ],
  keyPrefix: 'rl:lead',
  message: 'Too many lead submissions. Please wait a moment.',
});