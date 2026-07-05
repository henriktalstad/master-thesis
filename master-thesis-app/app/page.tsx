import { redirect } from "next/navigation";
import { resolveSdAnleggEntryPath } from "@/lib/sd-anlegg/resolve-entry-redirect";

export default async function RootPage() {
  const path = await resolveSdAnleggEntryPath();
  redirect(path ?? "/sd-anlegg");
}
