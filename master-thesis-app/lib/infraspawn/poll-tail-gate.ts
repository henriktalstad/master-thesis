import type { QueryClient } from "@tanstack/react-query";
import { SD_ANLEGG_LIVE_POLL_TAIL_INTERVAL_MS } from "@/lib/infraspawn/live-display-policy";

export const infraspawnPollTailGateQueryKey = [
  "infraspawn",
  "poll-tail-gate",
] as const;

type PollTailGateState = Readonly<Record<string, number>>;

function readPollTailGate(
  queryClient: QueryClient,
): PollTailGateState {
  return (
    queryClient.getQueryData<PollTailGateState>(infraspawnPollTailGateQueryKey) ??
    {}
  );
}

export function canIncludeInfluxTailForPoll(
  queryClient: QueryClient,
  scopeKey: string,
  now = Date.now(),
): boolean {
  const last = readPollTailGate(queryClient)[scopeKey] ?? 0;
  return now - last >= SD_ANLEGG_LIVE_POLL_TAIL_INTERVAL_MS;
}

export function markInfluxTailPolled(
  queryClient: QueryClient,
  scopeKey: string,
  now = Date.now(),
): void {
  const gate = readPollTailGate(queryClient);
  queryClient.setQueryData(infraspawnPollTailGateQueryKey, {
    ...gate,
    [scopeKey]: now,
  });
}
