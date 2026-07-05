import { withCronAuth, cronJobResponse } from "@/lib/cron/handler";
import { runPipelineJob } from "@/lib/jobs/pipeline-jobs";

export const dynamic = "force-dynamic";

export const GET = withCronAuth(async () => {
  const result = await runPipelineJob("sync-energy-prices");
  return cronJobResponse("sync-energy-prices", result);
});

export const POST = GET;
