import { useState } from "react";
import { Lines } from "../components/charts";
import { Async, Badge, Button, Card, CursorPager, PageHeader, Table, Tabs, Td } from "../components/ui";
import { fmtDate, fmtNum } from "../lib/format";
import { useApi, useScopeQuery } from "../lib/hooks";
import type { DeadLetter, Page, QueueStat, WebhookDelivery, WebhookSub } from "../lib/types";
import { Link } from "@tanstack/react-router";

export function LogsPage() {
  const [tab, setTab] = useState<"queues" | "dlq" | "webhooks" | "latency">("queues");
  return (
    <>
      <PageHeader title="Logs & monitoring" description="Queue processing, dead-letter records, webhook delivery history and processing latency." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "queues", label: "Queues" }, { id: "dlq", label: "Dead letters" }, { id: "webhooks", label: "Webhook deliveries" }, { id: "latency", label: "Latency" }]} />
      {tab === "queues" && <Queues />}{tab === "dlq" && <Dead />}{tab === "webhooks" && <Webhooks />}{tab === "latency" && <Latency />}
    </>
  );
}

function Queues() {
  const q = useApi<QueueStat[]>("/internal/logs/queues");
  return (
    <Card title="Queue status" actions={<Button size="sm" onClick={() => q.refetch()}>Refresh</Button>} pad={false}>
      <Async q={q} empty={(d) => d.length === 0}>
        {(rows) => (
          <Table head={["Queue", "Waiting", "In flight", "Oldest message", "Dead letters"]}>
            {rows.map((r) => (
              <tr key={r.queue}><Td className="font-medium">{r.queue}</Td><Td>{fmtNum(r.depth)}</Td><Td>{r.in_flight}</Td>
                <Td><Badge tone={r.oldest_age_s > 60 ? "warning" : "success"}>{r.oldest_age_s}s</Badge></Td><Td><Badge tone={r.dlq ? "danger" : "neutral"}>{r.dlq}</Badge></Td></tr>
            ))}
          </Table>
        )}
      </Async>
    </Card>
  );
}

function Dead() {
  const q = useApi<DeadLetter[]>("/internal/logs/dead-letters");
  return (
    <Card title="Dead-letter records" pad={false}>
      <Async q={q} empty={(d) => d.length === 0}>
        {(rows) => (
          <Table head={["Notification", "Queue", "Reason", "Attempts", "Failed at"]}>
            {rows.map((r) => (
              <tr key={r.id}><Td><Link to="/notifications/$id" params={{ id: r.notification_id }} className="font-mono text-xs text-primary hover:underline">{r.notification_id}</Link></Td><Td>{r.queue}</Td><Td className="font-mono text-xs">{r.reason}</Td><Td>{r.attempts}</Td><Td className="text-muted">{fmtDate(r.failed_at)}</Td></tr>
            ))}
          </Table>
        )}
      </Async>
    </Card>
  );
}

function Webhooks() {
  const subs = useApi<WebhookSub[]>("/v1/webhooks");
  const [cursors, setCursors] = useState([""]);
  const page = cursors.length - 1;
  const q = useApi<Page<WebhookDelivery>>("/internal/logs/webhook-deliveries", { cursor: cursors[page], limit: 10 });
  return (
    <div className="space-y-4">
      <Card title="Subscriptions" pad={false}>
        <Async q={subs} empty={(d) => d.length === 0}>
          {(rows) => <Table head={["Endpoint", "Events", "Signing secret", "Status"]}>{rows.map((s) => <tr key={s.id}><Td className="font-mono text-xs">{s.url}</Td><Td className="text-xs">{s.events.join(", ")}</Td><Td className="font-mono text-xs">{s.secret_hint}</Td><Td><Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge></Td></tr>)}</Table>}
        </Async>
      </Card>
      <Card title="Delivery history" pad={false}>
        <Async q={q} empty={(d) => d.data.length === 0}>
          {(p) => (<>
            <Table head={["Event", "Subscription", "Attempt", "Result", "Next retry", "When"]}>
              {p.data.map((d) => <tr key={d.id}><Td className="font-mono text-xs">{d.event}</Td><Td>{d.subscription_id}</Td><Td>{d.attempt}</Td><Td><Badge tone={d.ok ? "success" : "danger"}>{d.status_code ?? "no response"}</Badge></Td><Td className="text-muted">{fmtDate(d.next_retry_at)}</Td><Td className="text-muted">{fmtDate(d.at)}</Td></tr>)}
            </Table>
            <CursorPager page={page} total={p.total} hasNext={!!p.next_cursor} onPrev={() => setCursors((c) => c.slice(0, -1))} onNext={() => setCursors((c) => [...c, p.next_cursor!])} />
          </>)}
        </Async>
      </Card>
    </div>
  );
}

function Latency() {
  const sq = useScopeQuery();
  const q = useApi<{ date: string; p50: number; p95: number }[]>("/internal/logs/latency", sq);
  return <Card title="Processing latency (accept → provider handoff)"><Async q={q}>{(d) => <Lines label="Processing latency" data={d} lines={[{ key: "p50", name: "p50", color: "var(--c2)" }, { key: "p95", name: "p95", color: "var(--c4)" }]} />}</Async></Card>;
}
