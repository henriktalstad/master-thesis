import "server-only";

/** Shadow default — ingen fysisk publish uten eksplisitt arming. */
export function isWritebackArmed(): boolean {
  return process.env.MPC_WRITEBACK_ARMED?.trim() === "1";
}

/** Ekstra gate: faktisk MQTT publish (ikke bare dry-run log). */
export function isMqttPublishEnabled(): boolean {
  return (
    process.env.MPC_MQTT_WRITEBACK?.trim() === "1" &&
    process.env.MPC_MQTT_PUBLISH?.trim() === "1" &&
    isWritebackArmed()
  );
}

export function mqttTopicPrefix(): string {
  return process.env.MPC_MQTT_TOPIC_PREFIX?.trim() || "sd/360102/control";
}

export type SupervisoryCommandStatus =
  | "predicted"
  | "approved"
  | "published"
  | "rejected";

export function canPublishStatus(status: string): status is "approved" {
  return status === "approved";
}
