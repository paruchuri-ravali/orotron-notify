import { Bars, Donut, Lines, VolumeArea } from "../components/charts";
import { DateRange, useDateRange } from "../components/Filters";
import { Async, Badge, Card, PageHeader, PendingBanner, Table, Td } from "../components/ui";
import { CHANNEL_LABEL, PENDING } from "../lib/features";
import { fmtMs, fmtNum, fmtPct } from "../lib/format";
import { useApi, useScopeQuery } from "../lib/hooks";
import type { Analytics } from "../lib/types";

export function AnalyticsPage() {
  const sq = useScopeQuery();
  const dr = useDateRange(14);
  const q = useApi<Analytics>("/internal/analytics", { ...sq, from: dr.from, to: dr.to });
  return (
    <>
      <PageHeader title="Analytics & usage" description="Volume, success rates, latency and retries for the selected scope." actions={<DateRange {...dr} />} />
      <Async q={q}>
        {(a) => (
          <div className="space-y-4">
            {a.estimated_cost === null && <PendingBanner>{PENDING.cost}</PendingBanner>}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Volume & outcomes" className="lg:col-span-2"><VolumeArea label="Volume and outcomes" data={a.series} keys={[{ key: "delivered", name: "Delivered", color: "var(--c2)" }, { key: "failed", name: "Failed", color: "var(--c4)" }]} /></Card>
              <Card title="Channel usage"><Donut label="Channel usage" data={a.by_channel.map((c) => ({ name: CHANNEL_LABEL[c.channel], value: c.count }))} /></Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Project usage"><Bars label="Usage by project" data={a.by_project} x="project" y="count" name="Notifications" /></Card>
              <Card title="Delivery latency"><Lines label="Delivery latency" data={a.latency} lines={[{ key: "p50", name: "p50", color: "var(--c2)" }, { key: "p95", name: "p95", color: "var(--c4)" }]} /></Card>
              <Card title="Retry statistics (attempts per delivery)"><Bars label="Attempts per delivery" data={a.retries.map((r) => ({ attempts: `${r.attempts} attempt${r.attempts > 1 ? "s" : ""}`, count: r.count }))} x="attempts" y="count" name="Deliveries" color="var(--c3)" /></Card>
              <Card title="Success rate by channel" pad={false}>
                <Table head={["Channel", "Notifications", "Success"]}>{a.by_channel.map((c) => <tr key={c.channel}><Td>{CHANNEL_LABEL[c.channel]}</Td><Td>{fmtNum(c.count)}</Td><Td><Badge tone={c.success_pct > 95 ? "success" : "warning"}>{fmtPct(c.success_pct)}</Badge></Td></tr>)}</Table>
              </Card>
            </div>
            <Card title="Provider performance" pad={false}>
              <Table head={["Provider", "Sent", "Success", "p50", "p95", "Estimated cost"]}>
                {a.providers.map((p) => <tr key={p.provider}><Td className="font-medium">{p.provider}</Td><Td>{fmtNum(p.sent)}</Td><Td>{fmtPct(p.success_pct)}</Td><Td>{fmtMs(p.p50_ms)}</Td><Td>{fmtMs(p.p95_ms)}</Td><Td><Badge tone="warning">Pending</Badge></Td></tr>)}
              </Table>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
