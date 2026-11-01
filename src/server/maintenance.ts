// In-process housekeeping. Railway runs the app as one long-lived Node process
// (no serverless, and no cron service in the project — nothing calls
// /api/cron/* there), so jobs that must happen on time run on a timer here.
// Every job is idempotent: a run that overlaps another, or that also happens
// through the cron route, does nothing twice.

import { purgeExpiredClients } from "@/lib/client-trash-data";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";
import { topUpOpenEndedSeries } from "@/lib/series-topup";
import { sendSubscriptionNotices } from "@/lib/subscription-notices-data";
import { retryFailedSupportEmails } from "@/lib/support-data";

const FIRST_RUN_MS = 60 * 1000; // a minute after boot
const EVERY_MS = 60 * 60 * 1000; // then hourly

const globalForMaintenance = globalThis as unknown as { psyMaintenance?: boolean };

export async function runMaintenance(
  now = new Date(),
): Promise<{
  clientsPurged: number;
  seriesExtended: number;
  supportEmailsSent: number;
  subscriptionNoticesSent: number;
}> {
  let clientsPurged = 0;
  let seriesExtended = 0;
  let supportEmailsSent = 0;
  let subscriptionNoticesSent = 0;
  try {
    // Clients 30 days in the recycle bin are deleted for good
    clientsPurged = await purgeExpiredClients(now);
    if (clientsPurged > 0) console.log(`Maintenance: purged ${clientsPurged} deleted client(s)`);
  } catch (err) {
    console.error("Maintenance: client purge failed:", err);
  }
  try {
    // Ongoing (קבוע) series that run low on future meetings get the next batch.
    // Sends nothing itself: it only books meetings and queues their reminders.
    seriesExtended = await topUpOpenEndedSeries();
    if (seriesExtended > 0) console.log(`Maintenance: extended ${seriesExtended} ongoing series`);
  } catch (err) {
    console.error("Maintenance: series top-up failed:", err);
  }
  try {
    // Support requests whose email to support failed are sent again
    supportEmailsSent = await retryFailedSupportEmails(now);
    if (supportEmailsSent > 0) console.log(`Maintenance: re-sent ${supportEmailsSent} support request email(s)`);
  } catch (err) {
    console.error("Maintenance: support email retry failed:", err);
  }
  try {
    // Rate-limit counters whose window has passed
    await purgeExpiredRateLimits(now);
  } catch (err) {
    console.error("Maintenance: rate-limit purge failed:", err);
  }
  try {
    // Trial/subscription ending emails to account owners (never their clients)
    subscriptionNoticesSent = await sendSubscriptionNotices(now);
    if (subscriptionNoticesSent > 0) {
      console.log(`Maintenance: sent ${subscriptionNoticesSent} subscription notice(s)`);
    }
  } catch (err) {
    console.error("Maintenance: subscription notices failed:", err);
  }
  return { clientsPurged, seriesExtended, supportEmailsSent, subscriptionNoticesSent };
}

export function startMaintenance(): void {
  // Once per process — dev hot reloads re-run instrumentation
  if (globalForMaintenance.psyMaintenance) return;
  globalForMaintenance.psyMaintenance = true;
  const tick = () => void runMaintenance();
  setTimeout(tick, FIRST_RUN_MS).unref();
  setInterval(tick, EVERY_MS).unref();
}
