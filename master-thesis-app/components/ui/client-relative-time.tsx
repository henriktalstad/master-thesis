"use client";

import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { useIsClientMounted } from "@/hooks/use-is-client-mounted";
import { cn } from "@/lib/utils";

type ClientRelativeTimeProps = {
  date: Date | string | number;
  className?: string;
  addSuffix?: boolean;
  fallbackFormat?: string;
};

export function ClientRelativeTime({
  date,
  className,
  addSuffix = true,
  fallbackFormat = "d. MMM yyyy HH:mm",
}: ClientRelativeTimeProps) {
  const mounted = useIsClientMounted();
  const parsed = date instanceof Date ? date : new Date(date);

  const label = mounted
    ? formatDistanceToNow(parsed, { addSuffix, locale: nb })
    : format(parsed, fallbackFormat, { locale: nb });

  return <span className={cn(className)}>{label}</span>;
}
