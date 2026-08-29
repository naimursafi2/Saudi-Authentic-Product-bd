import cron, { type ScheduledTask } from "node-cron";
import { claimDueCampaigns, dispatchCampaign } from "./campaign.service";
import { reconcileStalePayments } from "./payment.service";
import { purgeExpiredAssets } from "./internalAsset.service";

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

/**
 * Permanently deletes Recycle Bin items whose 15-day retention has elapsed.
 * `purgeExpiredAssets` contains its own per-item error handling, so a file
 * Cloudinary refuses is counted and left in the bin for the next tick rather
 * than stopping the sweep or being lost track of.
 */
async function assetPurgeTick(): Promise<void> {
  const { purged, failed } = await purgeExpiredAssets();
  if (purged > 0 || failed > 0) {
    console.log(`[assets] purge sweep: ${purged} deleted, ${failed} failed (will retry).`);
  }
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
    assetPurgeTick().catch((err) =>
      console.error("[scheduler] asset purge tick failed:", (err as Error).message)
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
export { assetPurgeTick as runAssetPurgeTick };
