import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Async, Badge, Button, Card, CopyButton, EmptyState, Field, Input, Modal, PageHeader, PendingBanner, Select, Table, Td, Toggle } from "../components/ui";
import { api } from "../lib/api";
import { CHANNEL_LABEL } from "../lib/features";
import { fmtDate, fmtMs, fmtNum, titleCase } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";
import { useCan } from "../lib/session";
import type { Channel, ChannelInfo, ProviderConfig } from "../lib/types";
import { API_URL } from "../lib/api";
import { PROVIDER_SPECS } from "../lib/providers";
import { CredentialFields, splitCreds, validateCreds, type CredValues } from "../components/ProviderForm";
import { Senders } from "../components/Senders";

const tone = { healthy: "success", degraded: "warning", down: "danger", unknown: "neutral" } as const;

export function ChannelPage() {
  const { channel } = useParams({ from: "/shell/channels/$channel" });
  const ch = channel as Channel;
  const can = useCan();
  const q = useApi<ChannelInfo>(`/internal/channels/${ch}`);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const inv = { invalidate: [`/internal/channels/${ch}`, "/internal/overview"] };
  const patch = useAction(({ p, ...b }: { p: ProviderConfig } & Partial<ProviderConfig>) => api.patch(`/internal/providers/${p.id}`, b), inv);
  const test = useAction((p: ProviderConfig) => api.post<{ ok: boolean; latency_ms: number; message: string }>(`/internal/providers/${p.id}/test`), { ...inv, onSuccess: (r) => toast[/Warning/.test(r.message) ? "warning" : "success"](r.message) });
  const label = CHANNEL_LABEL[ch] ?? channel;
  return (
    <>
      <PageHeader title={`${label} providers`} description="Credentials are write-only: the dashboard only ever shows the last 4 characters." actions={<Button variant="primary" onClick={() => setOpen(true)} disabled={q.data?.status === "pending" || !can("writeProviders")}>Add provider</Button>} />
      <Async q={q}>
        {(c) => (
          <>
            {c.status === "pending" && <PendingBanner>{label} delivery is not part of the current backend scope (email and WhatsApp come first). No providers can be configured yet.</PendingBanner>}
            {c.status === "available" && (
              <Card title="Configured providers" pad={false}>
                {c.providers.length === 0 ? <EmptyState title="No providers configured" description="Add a provider to start sending on this channel." /> : (
                  <Table head={["Priority", "Provider", "Health", "Sent", "Delivered", "Failed", "p95", "Credentials", "Enabled", ""]}>
                    {c.providers.map((p) => (
                      <tr key={p.id}>
                        <Td><Select disabled={!can("writeProviders")} aria-label={`Priority for ${p.name}`} className="w-16" value={p.priority} onChange={(e) => patch.mutate({ p, priority: +e.target.value })}>{c.providers.map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</Select></Td>
                        <Td><div className="font-medium">{p.name}</div><div className="text-xs text-muted">tested {fmtDate(p.last_tested_at)}</div></Td>
                        <Td><Badge tone={tone[p.health]}>{titleCase(p.health)}</Badge></Td>
                        <Td>{fmtNum(p.stats.sent)}</Td><Td>{fmtNum(p.stats.delivered)}</Td><Td>{fmtNum(p.stats.failed)}</Td><Td>{p.stats.p95_latency_ms ? fmtMs(p.stats.p95_latency_ms) : "–"}</Td>
                        <Td className="text-xs"><div className="font-mono">{p.secret_hint}</div>{Object.entries(p.config ?? {}).filter(([k]) => k !== "webhook_verify_token").map(([k, v]) => <div key={k} className="text-muted-foreground">{PROVIDER_SPECS[p.provider]?.fields.find((f) => f.key === k)?.label ?? k}: <span className="font-mono">{v}</span></div>)}</Td>
                        <Td><Toggle disabled={!can("writeProviders")} label={`Enable ${p.name}`} checked={p.enabled} onChange={(v) => patch.mutate({ p, enabled: v })} /></Td>
                        <Td className="space-x-1 whitespace-nowrap"><Button size="sm" disabled={!can("writeProviders")} loading={test.isPending && test.variables?.id === p.id} onClick={() => test.mutate(p)}>Test</Button><Button size="sm" disabled={!can("writeProviders")} onClick={() => setEditing(p)}>Update keys</Button></Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            )}
            {ch === "email" && c.status === "available" && <div className="mt-4"><Senders providers={c.providers} canEdit={can("writeProviders")} /></div>}
            {ch === "whatsapp" && c.providers.filter((p) => p.provider === "meta_cloud_api").map((p) => <WebhookSetup key={p.id} p={p} />)}
            {c.fallback_to && <p className="mt-3 text-sm text-muted">Fallback: if every {label} provider fails, eligible non-marketing messages fall back to <strong>{CHANNEL_LABEL[c.fallback_to]}</strong>. Provider-level fallback follows the priority order above.</p>}
            <Card title="Supported providers & restrictions" className="mt-4" pad={false}>
              {c.catalog.length === 0 ? <p className="p-4 text-sm text-muted">No providers are planned for this channel in the current scope.</p> : (
                <ul className="divide-y divide-border">{c.catalog.map((p) => <li key={p.key} className="px-4 py-3 text-sm"><span className="font-medium">{p.name}</span><p className="text-muted">{p.notes}</p></li>)}</ul>
              )}
            </Card>
            {editing && <UpdateKeys p={editing} onClose={() => setEditing(null)} invalidate={inv.invalidate} />}
            <AddProvider ch={ch} open={open} setOpen={setOpen} catalog={c.catalog} />
          </>
        )}
      </Async>
    </>
  );
}

function WebhookSetup({ p }: { p: ProviderConfig }) {
  const url = `${API_URL || "https://api.your-notify-domain.example"}/webhooks/whatsapp/${p.id}`;
  const token = p.config?.webhook_verify_token ?? "";
  return (
    <Card title={`Webhook setup: ${p.name}`} className="mt-4">
      <p className="mb-3 text-sm text-muted">In the Meta app: WhatsApp → Configuration → Webhook. Paste these two values, then subscribe to <code>messages</code>. Delivery receipts and replies arrive here.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Callback URL"><div className="flex gap-2"><Input readOnly value={url} className="font-mono text-xs" /><CopyButton text={url} /></div></Field>
        <Field label="Verify token"><div className="flex gap-2"><Input readOnly value={token} className="font-mono text-xs" /><CopyButton text={token} /></div></Field>
      </div>
    </Card>
  );
}

function Checklist({ items }: { items: string[] }) {
  return <ol className="list-decimal space-y-1 rounded-lg bg-secondary/60 py-3 pl-8 pr-3 text-xs text-muted-foreground">{items.map((t) => <li key={t}>{t}</li>)}</ol>;
}

function AddProvider({ ch, open, setOpen, catalog }: { ch: Channel; open: boolean; setOpen: (o: boolean) => void; catalog: ChannelInfo["catalog"] }) {
  const [provider, setProvider] = useState(catalog[0]?.key ?? "");
  const [name, setName] = useState("");
  const [vals, setVals] = useState<CredValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const spec = PROVIDER_SPECS[provider];
  const reset = () => { setVals({}); setErrors({}); setName(""); };
  const add = useAction((body: object) => api.post(`/internal/channels/${ch}/providers`, body), { invalidate: [`/internal/channels/${ch}`, "/internal/audit-logs"], success: "Provider added. Run a connection test next.", onSuccess: () => { setOpen(false); reset(); } });
  const pick = (k: string) => { setProvider(k); setVals(Object.fromEntries((PROVIDER_SPECS[k]?.fields ?? []).filter((f) => f.default).map((f) => [f.key, f.default!]))); setErrors({}); };
  return (
    <Modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }} title="Add provider" description="Secrets are encrypted at rest and never shown again." wide>
      <form className="space-y-3" noValidate onSubmit={(e) => {
        e.preventDefault(); if (!spec) return;
        const er = validateCreds(spec, vals); setErrors(er); if (Object.keys(er).length) return;
        add.mutate({ provider, name, ...splitCreds(spec, vals) });
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Provider"><Select value={provider} onChange={(e) => pick(e.target.value)}>{catalog.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</Select></Field>
          <Field label="Display name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${spec?.name ?? "Provider"} (production)`} /></Field>
        </div>
        {spec ? <>
          <CredentialFields spec={spec} values={vals} onChange={setVals} errors={errors} />
          <Checklist items={spec.setup} />
        </> : <p className="text-sm text-muted">This provider is listed but not configurable yet.</p>}
        <p className="text-xs text-muted-foreground">Demo mode: nothing is sent to the provider. Never paste real production keys into a demo build.</p>
        <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={!spec} loading={add.isPending}>Add provider</Button></div>
      </form>
    </Modal>
  );
}

function UpdateKeys({ p, onClose, invalidate }: { p: ProviderConfig; onClose: () => void; invalidate: string[] }) {
  const spec = PROVIDER_SPECS[p.provider];
  const [vals, setVals] = useState<CredValues>(() => Object.fromEntries((spec?.fields ?? []).filter((f) => !f.secret).map((f) => [f.key, p.config?.[f.key] ?? ""])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((body: object) => api.post(`/internal/providers/${p.id}/credentials`, body), { invalidate: [...invalidate, "/internal/audit-logs"], success: "Credentials updated. Run a connection test.", onSuccess: onClose });
  if (!spec) return null;
  return (
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} title={`Update credentials: ${p.name}`} description={`Current secret ${p.secret_hint}. Stored secrets are never shown. Leave a secret empty to keep it.`}>
      <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); const er = validateCreds(spec, vals, true); setErrors(er); if (Object.keys(er).length) return; save.mutate(splitCreds(spec, vals)); }}>
        <CredentialFields spec={spec} values={vals} onChange={setVals} errors={errors} partial />
        <div className="flex justify-end gap-2"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={save.isPending}>Save credentials</Button></div>
      </form>
    </Modal>
  );
}
