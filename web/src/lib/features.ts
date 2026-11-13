import type { Channel } from "./types";

/**
 * Honest status of backend capability. The UI renders a "Pending" notice wherever a
 * capability is not part of the current backend scope (see assessment §21 MVP scope).
 */
export const CHANNEL_STATUS: Record<Channel, "available" | "pending"> = {
  email: "available",
  whatsapp: "available",
  sms: "pending",
  push: "pending",
  in_app: "pending",
};

export const PENDING = {
  workflows: "The workflow engine is not in the MVP backend. Workflows can be listed once the API exists; creating and running them is pending.",
  recurring: "Recurring schedules are pending. One-off scheduled sends are in MVP scope.",
  cost: "Estimated provider cost is pending: it needs per-provider pricing tables in the backend.",
  smartRouting: "Smart routing and automatic cross-channel fallback are pending (advanced phase).",
  bulk: "Bulk campaign tooling is pending (advanced phase).",
} as const;

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email", sms: "SMS", whatsapp: "WhatsApp", push: "Push", in_app: "In-app",
};
