import type { InngestEventName } from "./events";
import { inngest, isInngestEnabled } from "./client";

type SendPayload = {
  name: InngestEventName;
  data: Record<string, unknown>;
  id?: string;
};

export async function sendInngestEvent(payload: SendPayload): Promise<void> {
  if (!isInngestEnabled()) return;
  await inngest.send({
    name: payload.name,
    data: payload.data,
    id: payload.id,
  });
}
