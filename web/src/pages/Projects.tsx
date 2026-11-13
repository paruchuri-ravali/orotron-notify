import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Async, Badge, Button, Card, Code, EmptyState, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, useConfirm } from "../components/ui";
import { api } from "../lib/api";
import { fmtDate, fmtNum, relTime, titleCase } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";
import { useCan } from "../lib/session";
import type { ApiKey, Analytics, Environment, Member, Project, Role } from "../lib/types";
import { Bars } from "../components/charts";
import { applyPreset, brandedEmail, defaultBranding, PRESETS } from "../lib/branding";
import { Toggle } from "../components/ui";
import type { Branding } from "../lib/types";
import { Skeleton } from "../components/ui";

export function ProjectsPage() {
  const can = useCan();
  const q = useApi<Project[]>("/internal/projects");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useAction(() => api.post("/internal/projects", { name, description }), {
    invalidate: ["/internal/projects"], success: "Project created with dev, staging and prod environments",
    onSuccess: () => { setOpen(false); setName(""); setDescription(""); },
  });
  return (
    <>
      <PageHeader title="Projects" description="Each project is an isolated tenant: its own environments, API keys, templates, providers and logs."
        actions={can("createProject") ? <Button variant="primary" onClick={() => setOpen(true)}>New project</Button> : undefined} />
      <Card pad={false}>
        <Async q={q} empty={(d) => d.length === 0}>
          {(rows) => (
            <Table head={["Name", "Status", "Daily quota", "Rate limit", "Created", ""]}>
              {rows.map((p) => (
                <tr key={p.id}>
                  <Td><Link to="/projects/$id" params={{ id: p.id }} className="font-medium text-primary hover:underline">{p.name}</Link><div className="text-xs text-muted">{p.description}</div></Td>
                  <Td><Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge></Td>
                  <Td>{fmtNum(p.limits.daily_quota)}/day</Td><Td>{p.limits.rate_per_minute}/min</Td>
                  <Td className="text-muted">{fmtDate(p.created_at)}</Td>
                  <Td><Link to="/projects/$id" params={{ id: p.id }} className="text-xs text-primary hover:underline">Manage</Link></Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
      <Modal open={open} onOpenChange={setOpen} title="Create project" description="Creates development, staging and production environments.">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
          <Field label="Project name"><Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={create.isPending}>Create project</Button></div>
        </form>
      </Modal>
    </>
  );
}

type Detail = Project & { environments: Environment[]; members: Member[] };

export function ProjectDetail() {
  const { id } = useParams({ from: "/shell/projects/$id" });
  const q = useApi<Detail>(`/internal/projects/${id}`);
  const [tab, setTab] = useState<"keys" | "settings" | "branding" | "members" | "analytics">("keys");
  const can = useCan();
  return (
    <Async q={q}>
      {(p) => (
        <>
          <PageHeader title={<span className="flex items-center gap-2">{p.name}<Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge></span>} description={p.description}
            actions={can("createProject") ? <ArchiveButton p={p} /> : undefined} />
          <div className="mb-4 flex flex-wrap gap-2">{p.environments.map((e) => <Badge key={e.id} tone="primary">{titleCase(e.kind)} · {e.id}</Badge>)}</div>
          <Tabs value={tab} onChange={setTab} tabs={([{ id: "keys", label: "API keys" }, { id: "settings", label: "Settings & limits" }, { id: "branding", label: "Branding" }, { id: "members", label: "Members" }, { id: "analytics", label: "Analytics" }] as { id: typeof tab; label: string }[]).filter((t) => t.id === "keys" || t.id === "analytics" || (t.id === "branding" ? can("editBranding") : can("manageProject")))} />
          {tab === "keys" && <Keys p={p} />}
          {tab === "settings" && <Settings p={p} />}
          {tab === "branding" && <BrandingTab p={p} />}
          {tab === "members" && <Members p={p} />}
          {tab === "analytics" && <ProjectAnalytics id={p.id} />}
        </>
      )}
    </Async>
  );
}

function ArchiveButton({ p }: { p: Project }) {
  const confirm = useConfirm();
  const m = useAction(() => api.patch(`/internal/projects/${p.id}`, { status: p.status === "active" ? "archived" : "active" }), { invalidate: ["/internal/projects"], success: p.status === "active" ? "Project archived" : "Project restored" });
  return <Button onClick={async () => { if (p.status !== "active" || await confirm({ title: `Archive ${p.name}?`, description: "API keys stop working until the project is restored.", confirmLabel: "Archive", danger: true })) m.mutate(undefined); }} loading={m.isPending}>{p.status === "active" ? "Archive" : "Restore"}</Button>;
}

function Keys({ p }: { p: Detail }) {
  const confirm = useConfirm();
  const can = useCan();
  const q = useApi<ApiKey[]>(`/internal/projects/${p.id}/keys`);
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<{ name: string; secret: string } | null>(null);
  const [name, setName] = useState("");
  const [envId, setEnvId] = useState(p.environments[0]?.id ?? "");
  const inv = { invalidate: [`/internal/projects/${p.id}/keys`] };
  const create = useAction(() => api.post<ApiKey>(`/internal/projects/${p.id}/keys`, { name, environment_id: envId }), { ...inv, onSuccess: (k) => { setOpen(false); setName(""); setSecret({ name: k.name, secret: k.secret! }); } });
  const rotate = useAction((k: ApiKey) => api.post<ApiKey>(`/internal/keys/${k.id}/rotate`), { ...inv, onSuccess: (k) => setSecret({ name: k.name, secret: k.secret! }) });
  const revoke = useAction((k: ApiKey) => api.post(`/internal/keys/${k.id}/revoke`), { ...inv, success: "Key revoked" });
  const envKind = (id: string) => p.environments.find((e) => e.id === id)?.kind;
  return (
    <Card title="API credentials" actions={<Button variant="primary" size="sm" onClick={() => setOpen(true)}>Create key</Button>} pad={false}>
      <Async q={q} empty={(d) => d.length === 0}>
        {(rows) => (
          <Table head={["Name", "Environment", "Prefix", "Status", "Last used", ""]}>
            {rows.map((k) => (
              <tr key={k.id}>
                <Td className="font-medium">{k.name}</Td><Td>{titleCase(envKind(k.environment_id) ?? "")}</Td><Td className="font-mono text-xs">{k.prefix}…</Td>
                <Td><Badge tone={k.status === "active" ? "success" : k.status === "rotating" ? "warning" : "neutral"}>{k.status}</Badge></Td>
                <Td className="text-muted">{k.last_used_at ? relTime(k.last_used_at) : "never"}</Td>
                <Td className="space-x-1 text-right">
                  {k.status !== "revoked" && (can("manageProject") || envKind(k.environment_id) !== "prod") && <>
                    <Button size="sm" onClick={async () => { if (await confirm({ title: "Rotate this key?", description: "A new secret is issued. The old key stays valid for the overlap period.", confirmLabel: "Rotate" })) rotate.mutate(k); }}>Rotate</Button>
                    <Button size="sm" variant="danger" onClick={async () => { if (await confirm({ title: "Revoke this key now?", description: "Applications using it will start failing immediately. This cannot be undone.", confirmLabel: "Revoke key", danger: true })) revoke.mutate(k); }}>Revoke</Button>
                  </>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
      <Modal open={open} onOpenChange={setOpen} title="Create API key">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
          <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. backend server" /></Field>
          <Field label="Environment" hint="A key works in exactly one environment."><Select value={envId} onChange={(e) => setEnvId(e.target.value)}>{p.environments.filter((e) => can("manageProject") || e.kind !== "prod").map((e) => <option key={e.id} value={e.id}>{titleCase(e.kind)}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={create.isPending}>Create</Button></div>
        </form>
      </Modal>
      <Modal open={!!secret} onOpenChange={(o) => !o && setSecret(null)} title="Copy your new key now" description="This is the only time the full secret is shown. Store it in your secret manager.">
        {secret && <><p className="mb-2 text-sm font-medium">{secret.name}</p><Code>{secret.secret}</Code><div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => setSecret(null)}>I have saved it</Button></div></>}
      </Modal>
    </Card>
  );
}

function Settings({ p }: { p: Detail }) {
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description);
  const [quota, setQuota] = useState(p.limits.daily_quota);
  const [rate, setRate] = useState(p.limits.rate_per_minute);
  const save = useAction(() => api.patch(`/internal/projects/${p.id}`, { name, description, limits: { daily_quota: quota, rate_per_minute: rate } }), { invalidate: ["/internal/projects"], success: "Project settings saved" });
  return (
    <Card title="Project settings">
      <form className="grid max-w-xl gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daily quota" hint="Notifications per day"><Input type="number" min={0} value={quota} onChange={(e) => setQuota(+e.target.value)} /></Field>
          <Field label="Rate limit" hint="Requests per minute"><Input type="number" min={1} value={rate} onChange={(e) => setRate(+e.target.value)} /></Field>
        </div>
        <div><Button type="submit" variant="primary" loading={save.isPending}>Save changes</Button></div>
      </form>
    </Card>
  );
}

export function BrandingTab({ p }: { p: { id: string } }) {
  const q = useApi<Branding>(`/internal/projects/${p.id}/branding`);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.error) return <Card><Async q={q}>{() => null}</Async></Card>;
  return <BrandingForm key={JSON.stringify(q.data)} p={p} initial={q.data ?? defaultBranding} />;
}

function BrandingForm({ p, initial }: { p: { id: string }; initial: Branding }) {
  const [b, setB] = useState<Branding>(initial);
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => setB((x) => ({ ...x, [k]: v }));
  const save = useAction(() => api.put(`/internal/projects/${p.id}/branding`, b), { invalidate: [`/internal/projects/${p.id}/branding`], success: "Branding saved. New emails use it immediately." });
  const [sec, setSec] = useState<"design" | "header" | "body" | "footer">("design");
  const sample = `<h2 style="margin:0 0 12px">Your order is confirmed</h2><p>Hi Alex, thanks for your order <strong>A-1042</strong>.</p><p><a href="#" style="display:inline-block;padding:10px 18px;text-decoration:none">View order</a></p><p>Questions? Just reply to this email.</p>`;
  const hexOk = (s: string, f: string) => (/^#[0-9a-fA-F]{6}$/.test(s) ? s : f);
  const color = (label: string, k: "header_bg" | "page_bg" | "card_bg" | "text_color" | "link_color" | "footer_bg" | "footer_text_color", fb: string) => (
    <Field label={label}><div className="flex gap-2"><input type="color" aria-label={`${label} picker`} value={hexOk(b[k], fb)} onChange={(e) => set(k, e.target.value)} className="h-9 w-10 rounded border border-border bg-surface" /><Input value={b[k]} placeholder={fb} onChange={(e) => set(k, e.target.value)} /></div></Field>
  );
  const links = b.social_links;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Email theme">
        <Tabs value={sec} onChange={setSec} tabs={[{ id: "design", label: "Design" }, { id: "header", label: "Header" }, { id: "body", label: "Body" }, { id: "footer", label: "Footer" }]} />
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          {sec === "design" && <>
            <div className="grid grid-cols-2 gap-2">{PRESETS.map((pr) => (
              <button type="button" key={pr.id} onClick={() => setB((x) => applyPreset(x, pr.id))} className={`rounded-lg border p-3 text-left text-sm transition ${b.preset === pr.id ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"}`}><div className="font-medium">{pr.name}</div><div className="text-xs text-muted">{pr.desc}</div></button>
            ))}</div>
            <Field label="Sender / brand name"><Input value={b.sender_name} onChange={(e) => set("sender_name", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand color"><div className="flex gap-2"><input type="color" aria-label="Brand color picker" value={hexOk(b.brand_color, "#4f46e5")} onChange={(e) => set("brand_color", e.target.value)} className="h-9 w-10 rounded border border-border bg-surface" /><Input value={b.brand_color} onChange={(e) => set("brand_color", e.target.value)} /></div></Field>
              <Field label="Accent color"><div className="flex gap-2"><input type="color" aria-label="Accent color picker" value={hexOk(b.accent_color, "#0e9f8e")} onChange={(e) => set("accent_color", e.target.value)} className="h-9 w-10 rounded border border-border bg-surface" /><Input value={b.accent_color} onChange={(e) => set("accent_color", e.target.value)} /></div></Field>
            </div>
            <Field label="Font"><Select value={b.font} onChange={(e) => set("font", e.target.value as Branding["font"])}><option value="system">System sans-serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></Select></Field>
          </>}
          {sec === "header" && <>
            <Field label="Header layout"><Select value={b.header_style} onChange={(e) => set("header_style", e.target.value as Branding["header_style"])}><option value="bar">Color bar, left aligned</option><option value="centered">Centered brand</option><option value="minimal">Minimal, light</option></Select></Field>
            <Field label="Logo URL" hint="https only. Replaces the brand name text."><Input type="url" placeholder="https://…/logo.png" value={b.logo_url} onChange={(e) => set("logo_url", e.target.value)} /></Field>
            <Field label="Tagline" hint="Small line under the logo. Leave empty to hide."><Input value={b.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
            {color("Header background (empty = brand color)", "header_bg", b.brand_color)}
            <label className="flex items-center justify-between text-sm">Accent stripe under header<Toggle checked={b.show_stripe} onChange={(v) => set("show_stripe", v)} label="Accent stripe" /></label>
          </>}
          {sec === "body" && <>
            <div className="grid grid-cols-2 gap-3">
              {color("Page background", "page_bg", "#f4f5f7")}
              {color("Content background", "card_bg", "#ffffff")}
              {color("Text color", "text_color", "#222222")}
              {color("Link color (empty = brand)", "link_color", b.brand_color)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Width (px)"><Input type="number" min={420} max={760} value={b.width} onChange={(e) => set("width", Number(e.target.value))} /></Field>
              <Field label="Corner radius"><Input type="number" min={0} max={28} value={b.radius} onChange={(e) => set("radius", Number(e.target.value))} /></Field>
              <Field label="Text size"><Input type="number" min={12} max={19} value={b.font_size} onChange={(e) => set("font_size", Number(e.target.value))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Button style"><Select value={b.button_style} onChange={(e) => set("button_style", e.target.value as Branding["button_style"])}><option value="solid">Solid</option><option value="outline">Outline</option></Select></Field>
              <Field label="Button roundness"><Input type="number" min={0} max={999} value={b.button_radius} onChange={(e) => set("button_radius", Number(e.target.value))} /></Field>
            </div>
            <Field label="Closing note above footer" hint="Optional, e.g. “Need help? support@yourbrand.com”."><Input value={b.pre_footer_text} onChange={(e) => set("pre_footer_text", e.target.value)} /></Field>
            <p className="text-xs text-muted">The message text itself comes from each template, so it stays different per template.</p>
          </>}
          {sec === "footer" && <>
            <Field label="Footer text"><Input value={b.footer_text} onChange={(e) => set("footer_text", e.target.value)} /></Field>
            <Field label="Postal address" hint="Required in marketing emails under CAN-SPAM and similar laws."><Input value={b.postal_address} onChange={(e) => set("postal_address", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">{color("Footer background", "footer_bg", "#ffffff")}{color("Footer text color", "footer_text_color", "#6b7280")}</div>
            <div className="grid gap-2">
              <div className="text-sm font-medium">Links (max 4, https only)</div>
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-32" placeholder="Label" value={l.label} onChange={(e) => set("social_links", links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <Input placeholder="https://…" value={l.url} onChange={(e) => set("social_links", links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  <Button type="button" size="sm" onClick={() => set("social_links", links.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              {links.length < 4 && <div><Button type="button" size="sm" onClick={() => set("social_links", [...links, { label: "", url: "" }])}>Add link</Button></div>}
            </div>
            <label className="flex items-center justify-between text-sm">Show unsubscribe link<Toggle checked={b.show_unsubscribe} onChange={(v) => set("show_unsubscribe", v)} label="Show unsubscribe" /></label>
            {b.show_unsubscribe && <Field label="Unsubscribe text"><Input value={b.unsubscribe_text} onChange={(e) => set("unsubscribe_text", e.target.value)} /></Field>}
          </>}
          <div className="flex gap-2"><Button type="submit" variant="primary" loading={save.isPending}>Save branding</Button><Button type="button" onClick={() => setB(initial)}>Reset</Button></div>
        </form>
      </Card>
      <Card title="Live email preview"><iframe title="Branded email preview" sandbox="" srcDoc={brandedEmail(b, sample)} className="h-[640px] w-full rounded-md border border-border bg-white" /></Card>
    </div>
  );
}

const roles: Role[] = ["project_admin", "developer", "viewer"];
const memberSchema = z.object({ name: z.string().trim().min(2, "Enter the person's full name").max(80), email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"), role: z.enum(["project_admin", "developer", "viewer"]) });
type MemberForm = z.infer<typeof memberSchema>;
function Members({ p }: { p: Detail }) {
  const [open, setOpen] = useState(false);
  const form = useForm<MemberForm>({ resolver: zodResolver(memberSchema), defaultValues: { name: "", email: "", role: "developer" } });
  const role = form.watch("role");
  const add = useAction((v: MemberForm) => api.post(`/internal/projects/${p.id}/members`, v), { invalidate: [`/internal/projects/${p.id}`], success: "Member added", onSuccess: () => { setOpen(false); form.reset(); } });
  return (
    <Card title="Members" actions={<Button size="sm" variant="primary" onClick={() => setOpen(true)}>Add member</Button>} pad={false}>
      {p.members.length === 0 ? <EmptyState title="No members" /> : (
        <Table head={["Name", "Email", "Role", "Scope"]}>{p.members.map((m) => (
          <tr key={m.user_id}><Td className="font-medium">{m.name}</Td><Td className="text-muted">{m.email}</Td><Td><Badge tone="primary">{titleCase(m.role)}</Badge></Td><Td className="text-muted">{m.project_id ? "Project" : "Organization"}</Td></tr>
        ))}</Table>)}
      <Modal open={open} onOpenChange={setOpen} title="Add project member">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => add.mutate(v))} noValidate>
          <Field label="Full name" error={form.formState.errors.name?.message}><Input autoComplete="off" aria-invalid={!!form.formState.errors.name} {...form.register("name")} /></Field>
          <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} /></Field>
          <Field label="Role"><Select value={role} onChange={(e) => form.setValue("role", e.target.value as MemberForm["role"])}>{roles.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={add.isPending}>Add</Button></div>
        </form>
      </Modal>
    </Card>
  );
}

function ProjectAnalytics({ id }: { id: string }) {
  const q = useApi<Analytics>("/internal/analytics", { project: id });
  return (
    <Card title="Volume (last 14 days)">
      <Async q={q}>{(a) => <Bars label="Project volume" data={a.series.map((s) => ({ date: s.date.slice(5), total: s.total }))} x="date" y="total" name="Notifications" />}</Async>
    </Card>
  );
}
