import { withCronAuth, cronJobResponse } from "@/lib/cron/handler";
import { runPipelineJob } from "@/lib/jobs/pipeline-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withCronAuth(async () => {
  const result = await runPipelineJob("sync-weather");
  return cronJobResponse("sync-weather", result);
});

export const POST = GET;
