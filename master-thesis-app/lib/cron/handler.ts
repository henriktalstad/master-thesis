import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron/auth";
import { isJobResultOk, jobResultError } from "@/lib/cron/job-result";

type CronHandler = () => Promise<Response>;

export function withCronAuth(handler: CronHandler) {
  return async (request: Request) => {
    if (!isAuthorizedCronRequest(request)) {
      return unauthorizedCronResponse();
    }
    return handler();
  };
}

export function cronJobResponse(job: string, result: unknown) {
  const ok = isJobResultOk(result);
  return Response.json(
    {
      ok,
      job,
      status: ok ? "completed" : "failed",
      result,
      ...(ok ? {} : { error: jobResultError(result) ?? "Job failed" }),
    },
    { status: ok ? 200 : 500 },
  );
}
