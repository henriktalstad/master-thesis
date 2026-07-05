import { withCronAuth, cronJobResponse } from "@/lib/cron/handler";
import { runPipelineJob } from "@/lib/jobs/pipeline-jobs";

export const dynamic = "force-dynamic";

export const GET = withCronAuth(async () => {
  const result = await runPipelineJob("run-control-tick");
  return cronJobResponse("run-control-tick", result);
});

export const POST = GET;
