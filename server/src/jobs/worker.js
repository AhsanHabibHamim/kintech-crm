import { createWorker, scheduleFollowupSweep } from './queue.js';
import { processAutoValidation } from './validationWorker.js';
import { followupSweep } from './followup.js';

async function main() {
  const validationWorker = createWorker('validation', processAutoValidation, { concurrency: 5 });
  const followupWorker = createWorker('followup', async (job) => {
    if (job.name === 'followup-sweep') return followupSweep();
  });

  // Ensure the hourly sweep is registered on boot (jobId makes it idempotent).
  try {
    await scheduleFollowupSweep();
  } catch (e) {
    console.log('[worker] could not schedule repeat (dup perhaps):', e.message);
  }

  validationWorker.on('completed', (job) => console.log('[worker] validation complete', job.id));
  validationWorker.on('failed', (job, err) => console.error('[worker] validation failed', job?.id, err.message));
  followupWorker.on('failed', (job, err) => console.error('[worker] followup failed', err.message));
  console.log('[worker] KinTech worker started. Press Ctrl+C to stop.');

  // Run one followup sweep immediately on boot for freshness.
  followupSweep().then((r) => console.log('[worker] initial followup sweep:', r)).catch((e) => console.error('[worker] initial sweep failed', e.message));
}

main().catch((e) => {
  console.error('[worker] boot failed:', e);
  process.exit(1);
});