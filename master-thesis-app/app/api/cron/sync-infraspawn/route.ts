import { withCronAuth, cronJobResponse } from "@/lib/cron/handler";
import {
  emitInfraspawnSyncCompletedIfNeeded,
  runSyncInfraspawnSourcesJob,
} from "@/lib/jobs/pipeline-jobs";

export const dynamic = "force-dynamic";

export const GET = withCronAuth(async () => {
  const sync = await runSyncInfraspawnSourcesJob();
  const followUp = await emitInfraspawnSyncCompletedIfNeeded(sync);
  return cronJobResponse("sync-infraspawn", { sync, followUp });
});

export const POST = GET;
