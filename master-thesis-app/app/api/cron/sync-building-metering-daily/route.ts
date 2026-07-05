import { withCronAuth, cronJobResponse } from "@/lib/cron/handler";
import { runPipelineJob } from "@/lib/jobs/pipeline-jobs";

export const dynamic = "force-dynamic";

export const GET = withCronAuth(async () => {
  const result = await runPipelineJob("sync-building-metering-daily");
  return cronJobResponse("sync-building-metering-daily", result);
});

export const POST = GET;
