"use client";

import { useMemo, useState } from "react";
import type {
  LiveForwardPlans,
  MpcForwardPlan,
} from "@/lib/sd-anlegg/control/control-types";
import { getControlPolicy } from "@/lib/sd-anlegg/mpc/controller/policies/registry";
import type { PolicyId } from "@/lib/sd-anlegg/mpc/controller/policies/types";
import { CONTROL_STYRING_FORWARD } from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlMpcForwardPlanPanel } from "@/components/sd-anlegg/control/styring/mpc-forward-plan-panel";
import { SdAnleggControlSectionHeader } from "@/components/sd-anlegg/control/shared/section";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LIVE_FORWARD_POLICY_IDS: PolicyId[] = ["mpc-v1", "demand-scoped", "emulated"];

type Props = {
  mpcForwardPlan?: MpcForwardPlan | null;
  mpcForwardPlans?: LiveForwardPlans | null;
  embedded?: boolean;
};

export function SdAnleggControlForwardPanel({
  mpcForwardPlan = null,
  mpcForwardPlans = null,
  embedded = false,
}: Props) {
  const plans = useMemo(
    () => mpcForwardPlans ?? (mpcForwardPlan ? { "mpc-v1": mpcForwardPlan } : null),
    [mpcForwardPlan, mpcForwardPlans],
  );

  const availablePolicies = useMemo(() => {
    if (!plans) return [];
    return LIVE_FORWARD_POLICY_IDS.filter((id) => plans[id] != null);
  }, [plans]);

  const [activePolicy, setActivePolicy] = useState<PolicyId>("mpc-v1");
  const effectivePolicy = availablePolicies.includes(activePolicy)
    ? activePolicy
    : (availablePolicies[0] ?? "mpc-v1");
  const selectedPlan = plans?.[effectivePolicy] ?? null;

  if (!selectedPlan) {
    return (
      <Card className={SD_ANLEGG_CARD}>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {CONTROL_STYRING_FORWARD.emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {!embedded ? (
        <SdAnleggControlSectionHeader
          title={CONTROL_STYRING_FORWARD.title}
          description={CONTROL_STYRING_FORWARD.description}
        />
      ) : null}

      {availablePolicies.length > 1 ? (
        <Tabs
          value={effectivePolicy}
          onValueChange={(value) => setActivePolicy(value as PolicyId)}
        >
          <TabsList className="h-8 flex-wrap">
            {availablePolicies.map((id) => (
              <TabsTrigger key={id} value={id} className="text-xs">
                {getControlPolicy(id).label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <SdAnleggControlMpcForwardPlanPanel forwardPlan={selectedPlan} />
    </div>
  );
}
