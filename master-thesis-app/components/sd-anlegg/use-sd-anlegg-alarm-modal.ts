"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSearchParams } from "@/contexts/search-params-context";
import {
  formatAlarmModalParam,
  parseAlarmModalParam,
} from "@/lib/infraspawn/alarm-overview";

const ALARM_PARAM = "alarm";

export function useSdAnleggAlarmModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useAppSearchParams();
  const searchParamsString = searchParams.toString();
  const alarmParam = searchParams.get(ALARM_PARAM);
  const parsed = parseAlarmModalParam(alarmParam);

  const openAlarmAction = useCallback(
    (sourceId: string, objectId: string) => {
      const params = new URLSearchParams(searchParamsString);
      params.set(ALARM_PARAM, formatAlarmModalParam(sourceId, objectId));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  const closeAlarmAction = useCallback(() => {
    const params = new URLSearchParams(searchParamsString);
    params.delete(ALARM_PARAM);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParamsString]);

  return {
    alarmKey: parsed ? formatAlarmModalParam(parsed.sourceId, parsed.objectId) : null,
    isOpen: parsed != null,
    openAlarmAction,
    closeAlarmAction,
  };
}
