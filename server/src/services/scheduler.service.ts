import cron, { type ScheduledTask } from "node-cron";
import { claimDueCampaigns, dispatchCampaign } from "./campaign.service";
import { reconcileStalePayments } from "./payment.service";

/**
 * The project's single background scheduler, running server-side via
 * `node-cron` so its jobs fire whether or not any browser is open. As noted
 * when this file only drove campaigns: a second scheduled job belongs here
 * rather than spinning up its own `cron.schedule`.
 *
 * Two jobs share the one tick:
 *  - Customer Messaging campaigns — a weekly/monthly/custom campaign fires on
 *    schedule, per that spec's explicit requirement.
 *  - bKash payment reconciliation — resolves payments whose customer never
 *    made it back to the callback. This is what keeps payment verification
 *    fully automatic, with no manual staff step anywhere in the system.
 */

let task: ScheduledTask | null = null;

async function tick(): Promise<void> {
  const dueIds = await claimDueCampaigns();
  for (const id of dueIds) {
    await dispatchCampaign(id, "scheduled");
  }
}

/**
 * Kept separate from the campaign tick so neither job's failure can suppress
 * the other — a gateway outage must not stop scheduled campaigns, and vice
 * versa. `reconcileStalePayments` already swallows per-payment errors.
 */
async function paymentTick(): Promise<void> {
  await reconcileStalePayments();
}

/** Idempotent — safe to call more than once (e.g. in tests), only ever schedules one task. */
export function startCampaignScheduler(): void {
  if (task) return;
  // Every minute: coarse enough to be cheap, fine enough that a scheduled
  // send fires within a minute of its configured time. Payment reconciliation
  // rides the same tick — it has its own much longer grace window before a
  // payment is even eligible, so the tick rate costs it nothing.
  task = cron.schedule("* * * * *", () => {
    tick().catch((err) => console.error("[scheduler] campaign tick failed:", (err as Error).message));
    paymentTick().catch((err) =>
      console.error("[scheduler] payment reconciliation tick failed:", (err as Error).message)
    );
  });
}

export function stopCampaignScheduler(): void {
  task?.stop();
  task = null;
}

/** Exposed for tests — runs one tick synchronously without waiting for the cron clock. */
export { tick as runCampaignSchedulerTick };
export { paymentTick as runPaymentReconciliationTick };
