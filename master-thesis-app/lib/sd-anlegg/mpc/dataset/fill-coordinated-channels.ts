import type { FillMpcStepGapsOptions } from "@/lib/sd-anlegg/mpc/dataset/fill-step-gaps";

export function fillCoordinatedMpcChannelGaps(
  grid: readonly string[],
  channels: ReadonlyMap<string, ReadonlyMap<string, number>>,
  channelKeys: readonly string[],
  options: FillMpcStepGapsOptions = {},
): Map<string, Map<string, number>> {
  const maxForward = options.maxForwardSteps ?? 4;
  const result = new Map<string, Map<string, number>>();
  for (const key of channelKeys) {
    result.set(key, new Map());
  }
  if (channelKeys.length === 0) return result;

  const lastValues = new Map<string, number>();
  let forwardGap = 0;

  for (const step of grid) {
    const rawPresent = channelKeys.every((key) => {
      const value = channels.get(key)?.get(step);
      return value != null && Number.isFinite(value);
    });

    if (rawPresent) {
      for (const key of channelKeys) {
        const value = channels.get(key)!.get(step)!;
        result.get(key)!.set(step, value);
        lastValues.set(key, value);
      }
      forwardGap = 0;
      continue;
    }

    const canForwardFill =
      forwardGap < maxForward &&
      channelKeys.every((key) => lastValues.has(key));

    if (canForwardFill) {
      for (const key of channelKeys) {
        result.get(key)!.set(step, lastValues.get(key)!);
      }
      forwardGap += 1;
    } else {
      forwardGap = maxForward;
    }
  }

  return result;
}
