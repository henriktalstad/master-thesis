import { withCronAuth, cronJobResponse } from "@/lib/cron/handler";
import { runPipelineJob } from "@/lib/jobs/pipeline-jobs";

export const dynamic = "force-dynamic";

export const GET = withCronAuth(async () => {
  const result = await runPipelineJob("ensure-thesis-mpc-data");
  return cronJobResponse("ensure-thesis-mpc-data", result);
});

export const POST = GET;
