import cron, { type ScheduledTask } from "node-cron";
import { claimDueCampaigns, dispatchCampaign } from "./campaign.service";

/**
 * The Customer Messaging / Campaign system's backend scheduler. Runs
 * entirely server-side via `node-cron` — a weekly/monthly/custom campaign
 * fires on schedule whether or not any admin/customer browser is open, per
 * the spec's explicit requirement. This is intentionally the only scheduled
 * job in the project; if a second one is ever needed, this file is where it
 * should live rather than each feature spinning up its own `cron.schedule`.
 */

let task: ScheduledTask | null = null;

async function tick(): Promise<void> {
  const dueIds = await claimDueCampaigns();
  for (const id of dueIds) {
    await dispatchCampaign(id, "scheduled");
  }
}

/** Idempotent — safe to call more than once (e.g. in tests), only ever schedules one task. */
export function startCampaignScheduler(): void {
  if (task) return;
  // Every minute: coarse enough to be cheap, fine enough that a scheduled
  // send fires within a minute of its configured time.
  task = cron.schedule("* * * * *", () => {
    tick().catch((err) => console.error("[scheduler] campaign tick failed:", (err as Error).message));
  });
}

export function stopCampaignScheduler(): void {
  task?.stop();
  task = null;
}

/** Exposed for tests — runs one tick synchronously without waiting for the cron clock. */
export { tick as runCampaignSchedulerTick };
