import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChannelSelect, DateRange, useDateRange } from "../components/Filters";
import { NotificationDrawer } from "../components/NotificationDrawer";
import { Async, Badge, Button, Card, CursorPager, Input, PageHeader, Select, Table, Td } from "../components/ui";
import { api } from "../lib/api";
import { CHANNEL_LABEL } from "../lib/features";
import { fmtDate, fmtMs, relTime, statusTone, titleCase } from "../lib/format";
import { useAction, useApi, useScopeQuery } from "../lib/hooks";
import { useCan } from "../lib/session";
import type { Notification, Page } from "../lib/types";

const statuses = ["queued", "scheduled", "sending", "sent", "delivered", "read", "failed", "expired", "cancelled"];

export function NotificationsPage() {
  const sq = useScopeQuery();
  const dr = useDateRange(14);
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [text, setText] = useState("");
  const [dtext, setDtext] = useState("");
  const [cursors, setCursors] = useState<string[]>([""]);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setDtext(text), 300); return () => clearTimeout(t); }, [text]);
  const filterKey = JSON.stringify([sq, channel, status, dtext, dr.from, dr.to]);
  useEffect(() => setCursors([""]), [filterKey]);
  const page = cursors.length - 1;
  const q = useApi<Page<Notification>>("/v1/notifications", { ...sq, channel, status, q: dtext, from: dr.from, to: dr.to, cursor: cursors[page], limit: 15 });
  return (
    <>
      <PageHeader title="Notification explorer" description="Search every notification. Recipients are masked unless you have permission to reveal them." />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input aria-label="Search by notification ID or recipient" placeholder="Search ID or recipient…" className="w-60" value={text} onChange={(e) => setText(e.target.value)} />
          <ChannelSelect value={channel} onChange={setChannel} />
          <Select aria-label="Status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <DateRange {...dr} />
        </div>
        <Async q={q} empty={(d) => d.data.length === 0}>
          {(p) => (
            <>
              <Table head={["ID", "Status", "Channel", "Category", "Template", "Recipient", "Env", "Created"]}>
                {p.data.map((n) => (
                  <tr key={n.id} tabIndex={0} aria-label={`Open ${n.id}`} className="cursor-pointer hover:bg-surface-2" onClick={() => setOpenId(n.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(n.id); }}>
                    <Td><Link to="/notifications/$id" params={{ id: n.id }} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-primary hover:underline">{n.id}</Link></Td>
                    <Td><Badge tone={statusTone(n.status)}>{n.status}</Badge></Td>
                    <Td>{n.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}</Td>
                    <Td>{titleCase(n.category)}</Td>
                    <Td className="font-mono text-xs">{n.template_key}</Td>
                    <Td className="text-muted">{n.recipient}</Td>
                    <Td><Badge>{n.env}</Badge></Td>
                    <Td className="text-muted" >{relTime(n.created_at)}</Td>
                  </tr>
                ))}
              </Table>
              <CursorPager page={page} total={p.total} hasNext={!!p.next_cursor} onPrev={() => setCursors((c) => c.slice(0, -1))} onNext={() => setCursors((c) => [...c, p.next_cursor!])} />
            </>
          )}
        </Async>
      </Card>
      <NotificationDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

export function NotificationDetail() {
  const { id } = useParams({ from: "/shell/notifications/$id" });
  const can = useCan();
  const q = useApi<Notification>(`/v1/notifications/${id}`);
  const inv = { invalidate: ["/v1/notifications"] };
  const retry = useAction(() => api.post(`/v1/notifications/${id}/retry`), { ...inv, success: "Retry queued" });
  const cancel = useAction(() => api.post(`/v1/notifications/${id}/cancel`), { ...inv, success: "Notification cancelled" });
  return (
    <Async q={q}>
      {(n) => (
        <>
          <PageHeader title={<span className="flex flex-wrap items-center gap-2 font-mono text-lg">{n.id}<Badge tone={statusTone(n.status)}>{n.status}</Badge></span>}
            description={`${titleCase(n.category)} · ${n.priority} priority · template ${n.template_key} · ${n.env}`}
            actions={<>
              <Link to="/notifications" className="text-sm text-muted hover:text-fg">← Back</Link>
              {n.retryable && can("operate") && <Button variant="primary" loading={retry.isPending} onClick={() => retry.mutate(undefined)}>Retry delivery</Button>}
              {n.cancellable && can("operate") && <Button loading={cancel.isPending} onClick={() => cancel.mutate(undefined)}>Cancel</Button>}
            </>} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Summary">
              <dl className="space-y-2 text-sm">
                {([["Recipient", n.recipient], ["Created", fmtDate(n.created_at)], ["Scheduled for", fmtDate(n.send_at)], ["Idempotency key", n.idempotency_key ?? "–"], ["Channels", n.channels.map((c) => CHANNEL_LABEL[c]).join(", ")]] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium break-all">{v}</dd></div>
                ))}
              </dl>
            </Card>
            <Card title="Lifecycle" className="lg:col-span-2">
              <ol className="relative space-y-3 border-l border-border pl-5">
                {n.timeline?.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
                    <span className="font-medium">{titleCase(e.type)}</span>{e.detail && <span className="ml-2 text-danger">{e.detail}</span>}
                    <span className="ml-2 text-xs text-muted">{fmtDate(e.at)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          {n.deliveries?.map((d) => (
            <Card key={d.id} title={`Delivery · ${CHANNEL_LABEL[d.channel]} via ${d.provider}`} className="mt-4" actions={<Badge tone={statusTone(d.status)}>{d.status}</Badge>} pad={false}>
              <Table head={["#", "Result", "Error", "Latency", "Provider response", "When"]}>
                {d.attempts.map((a) => (
                  <tr key={a.id}>
                    <Td>{a.attempt_no}</Td>
                    <Td><Badge tone={a.status === "success" ? "success" : "danger"}>{a.status}</Badge></Td>
                    <Td>{a.error_code ? <><div className="font-mono text-xs">{a.error_code}</div><div className="text-xs text-muted">{a.error_message}</div></> : "–"}</Td>
                    <Td>{fmtMs(a.latency_ms)}</Td>
                    <Td><code className="text-xs text-muted">{JSON.stringify(a.provider_response)}</code></Td>
                    <Td className="text-muted">{fmtDate(a.at)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          ))}
          <Card title="Webhook events" className="mt-4" pad={false}>
            {n.webhook_events?.length ? (
              <Table head={["Event", "Endpoint status", "When"]}>{n.webhook_events.map((w) => (
                <tr key={w.id}><Td className="font-mono text-xs">{w.type}</Td><Td><Badge tone={w.status_code === 200 ? "success" : "danger"}>{w.status_code ?? "no response"}</Badge></Td><Td className="text-muted">{fmtDate(w.at)}</Td></tr>))}</Table>
            ) : <p className="p-4 text-sm text-muted">No webhook events dispatched yet.</p>}
          </Card>
        </>
      )}
    </Async>
  );
}
