// Enqueues one run of the subscription renewal job. Kept as its own script
// (rather than folded into trigger-sync.ts) since billing wants a daily
// cadence, not the more frequent one calendar/news sync might run at — an
// external scheduler should call this and trigger-sync.ts separately.
import { subscriptionRenewalQueue, SYNC_JOB_OPTIONS } from "@/lib/queue/queues";

async function main() {
  await subscriptionRenewalQueue.add("renew", {}, SYNC_JOB_OPTIONS);
  console.log("Enqueued subscriptionRenewal.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
