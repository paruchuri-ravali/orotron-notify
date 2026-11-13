import { useState } from "react";
import { Async, Badge, Button, Card, Field, Input, Modal, PageHeader, PendingBanner, Select, Table, Td, useConfirm } from "../components/ui";
import { api } from "../lib/api";
import { CHANNEL_LABEL, PENDING } from "../lib/features";
import { fmtDate } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";
import type { Channel, Schedule } from "../lib/types";

const zones = ["Asia/Kolkata", "America/New_York", "America/Los_Angeles", "Europe/London", "Australia/Sydney", "UTC"];
const tone = { scheduled: "info", running: "warning", completed: "success", cancelled: "neutral", failed: "danger" } as const;

export function SchedulesPage() {
  const confirm = useConfirm();
  const q = useApi<Schedule[]>("/v1/schedules");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ template_key: "", recipient: "", channel: "email" as Channel, timezone: "Asia/Kolkata", local: "" });
  const inv = { invalidate: ["/v1/schedules"] };
  const create = useAction(() => api.post("/v1/schedules", { template_key: f.template_key, recipient: f.recipient, channel: f.channel, timezone: f.timezone, local_time: f.local }), { ...inv, success: "Notification scheduled", onSuccess: () => setOpen(false) });
  const cancel = useAction((s: Schedule) => api.post(`/v1/schedules/${s.id}/cancel`), { ...inv, success: "Schedule cancelled" });
  return (
    <>
      <PageHeader title="Scheduled notifications" description="One-off sends in MVP scope. Each schedule runs in its own time zone and cannot fire twice for the same occurrence." actions={<Button variant="primary" onClick={() => setOpen(true)}>Schedule notification</Button>} />
      <PendingBanner>{PENDING.recurring}</PendingBanner>
      <Card pad={false}>
        <Async q={q} empty={(d) => d.length === 0}>
          {(rows) => (
            <Table head={["Template", "Recipient", "Channel", "Type", "Time zone", "Next run", "Status", ""]}>
              {rows.map((s) => (
                <tr key={s.id}>
                  <Td className="font-mono text-xs">{s.template_key}</Td><Td className="text-muted">{s.recipient}</Td><Td>{CHANNEL_LABEL[s.channel]}</Td>
                  <Td>{s.kind === "recurring" ? <span title={s.rule}>Recurring</span> : "One-off"}</Td><Td>{s.timezone}</Td><Td>{fmtDate(s.next_run_at)}</Td>
                  <Td><Badge tone={tone[s.status]}>{s.status}</Badge>{s.last_run_status && <span className="ml-1 text-xs text-muted">last: {s.last_run_status}</span>}</Td>
                  <Td>{s.status === "scheduled" && <Button size="sm" onClick={async () => { if (await confirm({ title: "Cancel this scheduled notification?", description: "It will not be sent. This cannot be undone.", confirmLabel: "Cancel notification", cancelLabel: "Keep it", danger: true })) cancel.mutate(s); }}>Cancel</Button>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
      <Modal open={open} onOpenChange={setOpen} title="Schedule a notification">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
          <Field label="Template key"><Input required value={f.template_key} onChange={(e) => setF({ ...f, template_key: e.target.value })} /></Field>
          <Field label="Recipient"><Input required value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel"><Select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as Channel })}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></Select></Field>
            <Field label="Time zone"><Select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{zones.map((z) => <option key={z}>{z}</option>)}</Select></Field>
          </div>
          <Field label="Send at (in the selected time zone)"><Input type="datetime-local" required value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={create.isPending}>Schedule</Button></div>
        </form>
      </Modal>
    </>
  );
}
