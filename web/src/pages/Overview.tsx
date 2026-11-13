import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useState } from "react";
import { Spark, VolumeArea } from "../components/charts";
import { ChannelSelect } from "../components/Filters";
import { Async, Badge, Card, ChannelIcon, PageHeader, Skeleton } from "../components/ui";
import { CHANNEL_LABEL } from "../lib/features";
import { fmtNum, fmtPct, relTime, statusTone, titleCase } from "../lib/format";
import { useApi, useScopeQuery } from "../lib/hooks";
import { useCan } from "../lib/session";
import type { Overview as O } from "../lib/types";

const healthTone = { healthy: "success", degraded: "warning", down: "danger", unknown: "neutral" } as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const ranges = [{ d: 7, label: "7 days" }, { d: 14, label: "14 days" }, { d: 30, label: "30 days" }];

function Dot({ tone }: { tone: "success" | "warning" | "danger" | "neutral" }) {
  const c = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", neutral: "bg-muted" }[tone];
  return <span className="relative flex size-2"><span className={clsx("absolute inline-flex size-full rounded-full opacity-60", c, tone !== "neutral" && "ping-soft")} /><span className={clsx("relative inline-flex size-2 rounded-full", c)} /></span>;
}

export function Overview() {
  const sq = useScopeQuery();
  const can = useCan();
  const [days, setDays] = useState(14);
  const [channel, setChannel] = useState("all");
  const q = useApi<O>("/internal/overview", { ...sq, channel, from: iso(new Date(Date.now() - (days - 1) * 86400000)), to: iso(new Date()) });
  return (
    <>
      <PageHeader title="Overview" description="Delivery health for your selected project and environment."
        actions={<>
          <ChannelSelect value={channel} onChange={setChannel} />
          <div role="group" aria-label="Date range" className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
            {ranges.map((r) => <button key={r.d} aria-pressed={days === r.d} onClick={() => setDays(r.d)} className={clsx("rounded-md px-2.5 py-1 text-xs font-medium", days === r.d ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg")}>{r.label}</button>)}
          </div>
        </>} />
      <Async q={q} skeleton={<div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /><Skeleton className="h-48" /></div>}>
        {(o) => {
          const data = o.series.map((s) => ({ ...s, total: s.delivered + s.failed + s.pending }));
          const kpis = [
            { label: "Total notifications", value: fmtNum(o.totals.total), key: "total", color: "var(--c1)" },
            { label: "Delivered", value: fmtNum(o.totals.delivered), key: "delivered", color: "var(--c2)" },
            { label: "Failed", value: fmtNum(o.totals.failed), key: "failed", color: "var(--c4)" },
            { label: "Pending", value: fmtNum(o.totals.pending), key: "pending", color: "var(--c3)" },
          ];
          const channelTotal = o.by_channel.reduce((a, c) => a + c.count, 0) || 1;
          const pct = o.totals.success_pct;
          return (
            <div className="space-y-4">
              <Card pad={false}>
                <div className="grid grid-cols-2 divide-border lg:grid-cols-4 lg:divide-x">
                  {kpis.map((k, i) => (
                    <div key={k.key} className={clsx("p-4", i > 1 && "border-t border-border lg:border-t-0", i % 2 === 1 && "border-l border-border lg:border-l-0")}>
                      <div className="text-xs font-medium text-muted">{k.label}</div>
                      <div className="mb-1 mt-1 text-[26px] font-semibold leading-none tabular-nums tracking-tight">{k.value}</div>
                      <Spark data={data} dataKey={k.key} color={k.color} />
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Notification volume" className="lg:col-span-2" actions={<span className="text-xs text-muted">{o.totals.sent.toLocaleString()} sent in range</span>}>
                  <VolumeArea label="Notification volume over time" data={data} keys={[{ key: "delivered", name: "Delivered / sent", color: "var(--c2)" }, { key: "pending", name: "Pending", color: "var(--c3)" }, { key: "failed", name: "Failed", color: "var(--c4)" }]} />
                </Card>
                <Card title="Delivery health">
                  <div className="flex items-end justify-between">
                    <div><div className="text-[34px] font-semibold leading-none tabular-nums tracking-tight">{fmtPct(pct)}</div><div className="mt-1 text-xs text-muted">delivered ÷ (delivered + failed)</div></div>
                    <Badge tone={pct >= 95 ? "success" : pct >= 85 ? "warning" : "danger"}>{pct >= 95 ? "Healthy" : pct >= 85 ? "Watch" : "At risk"}</Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Delivery success">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--c2)]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted">By channel</div>
                    {o.by_channel.map((c) => (
                      <div key={c.channel}>
                        <div className="mb-1 flex items-center justify-between text-[13px]"><span className="flex items-center gap-2"><ChannelIcon channel={c.channel} size="sm" />{CHANNEL_LABEL[c.channel]}</span><span className="tabular-nums text-muted">{fmtNum(c.count)}</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary/70" style={{ width: `${(c.count / channelTotal) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {can("viewLogs") && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card title="Provider health" pad={false}>
                    <ul className="divide-y divide-border">
                      {o.provider_health.map((p) => (
                        <li key={p.provider} className="flex items-center gap-3 px-4 py-3">
                          <ChannelIcon channel={p.channel} />
                          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{p.provider}</div><div className="text-xs text-muted">{fmtPct(p.error_rate_pct)} error rate</div></div>
                          <Dot tone={healthTone[p.health]} /><Badge tone={healthTone[p.health]} dot={false}>{titleCase(p.health)}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="System alerts" pad={false}>
                    {o.alerts.length === 0 ? <p className="p-6 text-center text-sm text-muted">All systems normal.</p> : (
                      <ul className="divide-y divide-border">{o.alerts.map((a) => (
                        <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                          <Badge tone={a.level === "critical" ? "danger" : a.level === "warning" ? "warning" : "info"}>{a.level}</Badge>
                          <span className="flex-1 text-[13px]">{a.message}</span><span className="shrink-0 text-xs text-muted">{relTime(a.at)}</span>
                        </li>))}</ul>)}
                  </Card>
                </div>
              )}

              <Card title="Recent activity" actions={<Link to="/notifications" className="text-xs font-medium text-primary hover:underline">View all →</Link>} pad={false}>
                {o.recent.length === 0 ? <p className="p-6 text-center text-sm text-muted">No notifications in this range.</p> : (
                  <ul className="divide-y divide-border">
                    {o.recent.map((n) => (
                      <li key={n.id}>
                        <Link to="/notifications/$id" params={{ id: n.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                          <ChannelIcon channel={n.channels[0]} />
                          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{n.template_key}</div><div className="truncate text-xs text-muted">{n.recipient} · <span className="font-mono">{n.id}</span></div></div>
                          <Badge tone={statusTone(n.status)}>{n.status}</Badge>
                          <span className="hidden w-16 text-right text-xs text-muted sm:block">{relTime(n.created_at)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          );
        }}
      </Async>
    </>
  );
}
