import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { resolveSdAnleggEntryPath } from "@/lib/sd-anlegg/resolve-entry-redirect";

export const metadata: Metadata = {
  title: "SD-anlegg",
};

export default async function SdAnleggIndexPage() {
  await connection();

  const path = await resolveSdAnleggEntryPath();
  if (path) {
    redirect(path);
  }

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-6 py-12">
      <h1 className="text-lg font-semibold">Mangler bygg-konfigurasjon</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sett <code className="text-xs">BUILDING_SLUG</code> i{" "}
        <code className="text-xs">.env</code> til slug for case-bygget (f.eks.{" "}
        <code className="text-xs">sorgenfriveien-32ab</code>).
      </p>
    </main>
  );
}
