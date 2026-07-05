import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "master-thesis-app",
  name: "Master Thesis — Nærbyen MPC",
});

export function isInngestEnabled(): boolean {
  const disabled = process.env.INNGEST_DISABLED?.trim().toLowerCase();
  if (disabled === "1" || disabled === "true" || disabled === "off") {
    return false;
  }
  return true;
}
