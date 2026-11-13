import type { NStatus } from "./types";

const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
export const fmtDate = (iso: string | null | undefined) => (iso ? dtf.format(new Date(iso)) : "–");
export const fmtNum = (n: number) => new Intl.NumberFormat().format(n);
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;
export const fmtMs = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`);

export function relTime(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const abs = Math.abs(s);
  const u = abs < 60 ? [abs, "s"] : abs < 3600 ? [Math.round(abs / 60), "m"] : abs < 86400 ? [Math.round(abs / 3600), "h"] : [Math.round(abs / 86400), "d"];
  return s >= 0 ? `${u[0]}${u[1]} ago` : `in ${u[0]}${u[1]}`;
}

export const statusTone = (s: NStatus): "success" | "danger" | "warning" | "info" | "neutral" =>
  s === "delivered" || s === "read" ? "success"
  : s === "failed" ? "danger"
  : s === "expired" || s === "cancelled" ? "neutral"
  : s === "sent" ? "info" : "warning";

export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
