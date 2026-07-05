import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { SD_ANLEGG_LIVE_POLL_TAIL_INTERVAL_MS } from "@/lib/infraspawn/live-display-policy";
import {
  canIncludeInfluxTailForPoll,
  infraspawnPollTailGateQueryKey,
  markInfluxTailPolled,
} from "@/lib/infraspawn/poll-tail-gate";

describe("poll-tail-gate", () => {
  test("canInclude tillater første tail og throttler etter mark", () => {
    const queryClient = new QueryClient();
    const now = 1_000_000;
    const scopeKey = "building:overview";

    expect(canIncludeInfluxTailForPoll(queryClient, scopeKey, now)).toBe(true);
    markInfluxTailPolled(queryClient, scopeKey, now);

    expect(canIncludeInfluxTailForPoll(queryClient, scopeKey, now + 1_000)).toBe(
      false,
    );
    expect(
      canIncludeInfluxTailForPoll(
        queryClient,
        scopeKey,
        now + SD_ANLEGG_LIVE_POLL_TAIL_INTERVAL_MS,
      ),
    ).toBe(true);
  });

  test("markInfluxTailPolled oppdaterer gate uten å lese tillatelse", () => {
    const queryClient = new QueryClient();
    const now = 2_000_000;

    markInfluxTailPolled(queryClient, "a", now);
    markInfluxTailPolled(queryClient, "b", now);

    expect(canIncludeInfluxTailForPoll(queryClient, "a", now + 1_000)).toBe(
      false,
    );
    expect(canIncludeInfluxTailForPoll(queryClient, "b", now + 1_000)).toBe(
      false,
    );
    expect(canIncludeInfluxTailForPoll(queryClient, "c", now)).toBe(true);

    expect(queryClient.getQueryData(infraspawnPollTailGateQueryKey)).toEqual({
      a: now,
      b: now,
    });
  });
});
