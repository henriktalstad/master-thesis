"use client";

import { useEffect, useState } from "react";

export function useRechartsModules(): typeof import("recharts") | null {
  const [modules, setModules] = useState<typeof import("recharts") | null>(
    null,
  );

  useEffect(() => {
    void import("recharts").then(setModules);
  }, []);

  return modules;
}
