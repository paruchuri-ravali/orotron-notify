import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Async, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Textarea, useConfirm } from "../components/ui";
import { api } from "../lib/api";
import { CHANNEL_LABEL } from "../lib/features";
import { fmtDate, relTime } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";
import { useCan } from "../lib/session";
import type { Branding, Channel, GalleryItem, Page, Project, Template, TemplateUsage, TemplateVersion } from "../lib/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WhatsAppFields, waIssues, type WaState } from "../components/WhatsAppFields";
import { TemplatePreview, type Rendered } from "../components/TemplatePreview";

export function TemplatesPage() {
  const can = useCan();
  const [status, setStatus] = useState("active");
  const [text, setText] = useState("");
  const q = useApi<Page<Template>>("/v1/templates", { status, q: text, limit: 50 });
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState("project");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const create = useAction(() => api.post("/v1/templates", { key, name, scope }), { invalidate: ["/v1/templates"], success: "Template created as v1 draft", onSuccess: () => { setOpen(false); setKey(""); setName(""); } });
  return (
    <>
      <PageHeader title="Templates" description="Versioned, channel-specific content with {{variables}}. Organization templates are shared; project templates override them by key." actions={can("editTemplates") ? <><Button onClick={() => setGalleryOpen(true)}>Browse gallery</Button><Button variant="primary" onClick={() => setOpen(true)}>New template</Button></> : undefined} />
      <Card pad={false}>
        <div className="flex gap-2 border-b border-border p-3">
          <Input aria-label="Search templates" placeholder="Search by key…" className="w-60" value={text} onChange={(e) => setText(e.target.value)} />
          <Select aria-label="Status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="archived">Archived</option></Select>
        </div>
        <Async q={q} empty={(d) => d.data.length === 0}>
          {(p) => (
            <Table head={["Template", "Key", "Scope", "Channels", "Latest", "Updated", ""]}>
              {p.data.map((t) => (
                <tr key={t.id}>
                  <Td><Link to="/templates/$id" params={{ id: t.id }} className="font-medium text-primary hover:underline">{t.name}</Link></Td>
                  <Td className="font-mono text-xs">{t.key}</Td>
                  <Td><Badge tone={t.scope === "organization" ? "primary" : "neutral"}>{t.scope === "organization" ? "shared default" : "project copy"}</Badge>{t.scope === "organization" && p.data.some((x) => x.key === t.key && x.scope === "project") && <span className="ml-2 text-xs text-muted">{p.data.filter((x) => x.key === t.key && x.scope === "project").length} project copy</span>}</Td>
                  <Td>{t.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}</Td>
                  <Td>v{t.latest_version}</Td><Td className="text-muted">{relTime(t.updated_at)}</Td>
                  <Td className="text-right"><Button size="sm" onClick={() => setPreviewId(t.id)}>Preview</Button></Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
      <PreviewModal id={previewId} onClose={() => setPreviewId(null)} />
      <GalleryModal open={galleryOpen} onOpenChange={setGalleryOpen} />
      <Modal open={open} onOpenChange={setOpen} title="New template">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
          <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Key" hint="Used in API calls. Lowercase letters, numbers, hyphens."><Input required pattern="[a-z0-9-]+" value={key} onChange={(e) => setKey(e.target.value)} /></Field>
          <Field label="Scope"><Select value={scope} onChange={(e) => setScope(e.target.value)}><option value="project">This project</option><option value="organization">Organization (shared)</option></Select></Field>
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={create.isPending}>Create</Button></div>
        </form>
      </Modal>
    </>
  );
}

function GalleryModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate();
  const g = useApi<GalleryItem[]>("/v1/template-gallery", undefined, open);
  const [sel, setSel] = useState<GalleryItem | null>(null);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const pick = (it: GalleryItem) => {
    setSel(it); setKey(it.key); setName(it.name); setRendered(null);
    api.post<Rendered>("/v1/templates/preview", { content: it.content, data: it.sample_data }).then(setRendered).catch(() => setRendered(null));
  };
  useEffect(() => { if (open && g.data?.length && !sel) pick(g.data[0]); }, [open, g.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const use = useAction(() => api.post<Template>("/v1/templates/from-gallery", { gallery_id: sel!.id, key, name }), {
    invalidate: ["/v1/templates"], success: "Added to your project. Customize it now.",
    onSuccess: (t) => { onOpenChange(false); nav({ to: "/templates/$id", params: { id: t.id } }); },
  });
  return (
    <Modal wide open={open} onOpenChange={onOpenChange} title="Template gallery" description="Start from a ready-made template. It is copied into your project, so you can edit it freely.">
      <Async q={g} empty={(d) => d.length === 0}>
        {(items) => (
          <div className="grid gap-4 md:grid-cols-[210px_1fr]">
            <ul className="space-y-1">
              {items.map((it) => (
                <li key={it.id}><button onClick={() => pick(it)} className={`w-full rounded-lg border px-3 py-2 text-left ${sel?.id === it.id ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"}`}>
                  <span className="block text-[13px] font-medium">{it.name}</span><span className="block text-xs text-muted">{it.category} · {it.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}</span>
                </button></li>
              ))}
            </ul>
            <div className="min-w-0 space-y-3">
              {sel && <p className="text-[13px] text-muted">{sel.description}</p>}
              <TemplatePreview rendered={rendered} loading={!rendered} />
              {sel && (
                <form className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); use.mutate(undefined); }}>
                  <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
                  <Field label="Key" hint="Used in API calls."><Input required pattern="[a-z0-9-]+" value={key} onChange={(e) => setKey(e.target.value)} /></Field>
                  <div className="sm:col-span-2"><Button type="submit" variant="primary" loading={use.isPending}>Use this template</Button></div>
                </form>
              )}
            </div>
          </div>
        )}
      </Async>
    </Modal>
  );
}

function SendModal({ open, onOpenChange, t, data }: { open: boolean; onOpenChange: (o: boolean) => void; t: Template; data: string }) {
  const confirm = useConfirm();
  const nav = useNavigate();
  const chans = t.channels.filter((c) => c === "email" || c === "whatsapp");
  const [channel, setChannel] = useState<Channel>(chans[0] ?? "email");
  const [to, setTo] = useState("");
  const [env, setEnv] = useState("dev");
  let variables: unknown = null; try { variables = JSON.parse(data); } catch { /* invalid JSON blocks sending below */ }
  const send = useAction(() => api.post<{ id: string }>("/v1/notifications", { category: "transactional", to: channel === "email" ? { email: to } : { phone: to }, channels: [channel], template: { key: t.key, variables }, environment: env }), {
    invalidate: ["/v1/notifications", "/internal/overview"], success: "Notification queued",
    onSuccess: (r) => { onOpenChange(false); nav({ to: "/notifications/$id", params: { id: r.id } }); },
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Send “${t.name}”`} description="Sends one real notification using the current sample data as variables.">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (env === "prod" && !(await confirm({ title: "Send a real message in Production?", description: "This delivers to the real recipient and may count against your sending limits.", confirmLabel: "Send now", danger: true }))) return; send.mutate(undefined); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel"><Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>{chans.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</Select></Field>
          <Field label="Environment"><Select value={env} onChange={(e) => setEnv(e.target.value)}><option value="dev">Development (sandbox)</option><option value="staging">Staging</option><option value="prod">Production</option></Select></Field>
        </div>
        <Field label={channel === "email" ? "Recipient email" : "Recipient phone (E.164)"}><Input required value={to} onChange={(e) => setTo(e.target.value)} placeholder={channel === "email" ? "you@example.com" : "+14155550100"} type={channel === "email" ? "email" : "tel"} /></Field>
        {env === "prod" && <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Production delivers a real message to this recipient.</p>}
        {variables === null && <p className="text-xs text-danger">Sample data is not valid JSON. Fix it in the editor first.</p>}
        <div className="flex justify-end gap-2"><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={variables === null} loading={send.isPending}>Send now</Button></div>
      </form>
    </Modal>
  );
}

const dupSchema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters").max(80), key: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes").max(60) });
type DupForm = z.infer<typeof dupSchema>;
function DuplicateModal({ open, onOpenChange, t }: { open: boolean; onOpenChange: (o: boolean) => void; t: Template }) {
  const nav = useNavigate();
  const form = useForm<DupForm>({ resolver: zodResolver(dupSchema), defaultValues: { name: `${t.name} (copy)`, key: `${t.key}-copy` } });
  const dup = useAction((v: DupForm) => api.post<Template>(`/v1/templates/${t.id}/duplicate`, v), {
    invalidate: ["/v1/templates"], success: "Template duplicated", onSuccess: (n) => { onOpenChange(false); nav({ to: "/templates/$id", params: { id: n.id } }); },
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Duplicate template" description="Creates an independent copy you can customize.">
      <form className="space-y-3" onSubmit={form.handleSubmit((v) => dup.mutate(v))} noValidate>
        <Field label="Name" error={form.formState.errors.name?.message}><Input aria-invalid={!!form.formState.errors.name} {...form.register("name")} /></Field>
        <Field label="Key" hint="Lowercase letters, numbers and dashes." error={form.formState.errors.key?.message}><Input aria-invalid={!!form.formState.errors.key} {...form.register("key")} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" loading={dup.isPending}>Duplicate</Button></div>
      </form>
    </Modal>
  );
}

function UsageCard({ t, onPreview }: { t: Template; onPreview: (projectId: string) => void }) {
  const can = useCan();
  const nav = useNavigate();
  const q = useApi<TemplateUsage[]>(`/v1/templates/${t.id}/usage`);
  const make = useAction((project_id: string) => api.post<Template>(`/v1/templates/${t.id}/override`, { project_id }), {
    invalidate: ["/v1/templates"], success: "Project copy created. Customize it now.",
    onSuccess: (n) => nav({ to: "/templates/$id", params: { id: n.id } }),
  });
  return (
    <Card title="Used by projects" actions={<span className="hidden text-xs text-muted md:inline">Every project gets this default in its own branding, unless it has its own copy.</span>} pad={false}>
      <Async q={q} empty={(d) => d.length === 0}>
        {(rows) => (
          <Table head={["Project", "Theme", "Which version", ""]}>
            {rows.map((r) => (
              <tr key={r.project_id}>
                <Td className="font-medium">{r.project_name}</Td>
                <Td><span className="flex items-center gap-2"><span className="size-4 rounded-full ring-1 ring-border" style={{ background: r.brand_color }} aria-label="Brand color" /><span className="size-4 rounded-full ring-1 ring-border" style={{ background: r.accent_color }} aria-label="Accent color" /><span className="text-xs text-muted">{r.sender_name || "no sender name"}</span></span></Td>
                <Td><Badge tone={r.source === "override" ? "primary" : "neutral"}>{r.source === "override" ? "Project’s own copy" : "Inherits shared default"}</Badge></Td>
                <Td className="space-x-1 text-right">
                  <Button size="sm" onClick={() => onPreview(r.project_id)}>Preview as project</Button>
                  {r.source === "override"
                    ? <Link to="/templates/$id" params={{ id: r.override_id! }} className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-surface-2">Open copy</Link>
                    : can("editTemplates") && <Button size="sm" loading={make.isPending && make.variables === r.project_id} onClick={() => make.mutate(r.project_id)}>Customize for project</Button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
    </Card>
  );
}

function PreviewModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useApi<Template>(`/v1/templates/${id}`, undefined, !!id);
  const brand = useApi<Branding>(`/internal/projects/${t.data?.project_id}/branding`, undefined, !!t.data?.project_id);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const latest = t.data?.versions?.[t.data.versions.length - 1];
  useEffect(() => { setRendered(null); }, [id]);
  useEffect(() => {
    if (!t.data || !latest) return;
    let live = true;
    api.post<Rendered>(`/v1/templates/${t.data.id}/preview`, { content: latest.content, data: t.data.sample_data }).then((r) => live && setRendered(r)).catch(() => live && setRendered(null));
    return () => { live = false; };
  }, [t.data?.id, latest?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal wide open={!!id} onOpenChange={(o) => !o && onClose()} title={t.data ? `Preview: ${t.data.name}` : "Preview"} description={latest ? `Version ${latest.version} rendered with sample data. Open the template to edit it.` : undefined}>
      {t.error ? <p className="text-sm text-danger">{t.error.message}</p> : <TemplatePreview rendered={rendered} branding={brand.data} loading={t.isPending || !rendered} from={brand.data?.sender_name || undefined} />}
    </Modal>
  );
}

export function TemplateDetail() {
  const { id } = useParams({ from: "/shell/templates/$id" });
  const can = useCan();
  const q = useApi<Template>(`/v1/templates/${id}`);
  const [tab, setTab] = useState<"editor" | "versions">("editor");
  const archive = useAction((status: string) => api.patch(`/v1/templates/${id}`, { status }), { invalidate: ["/v1/templates"], success: "Template updated" });
  return (
    <Async q={q}>
      {(t) => (
        <>
          <PageHeader title={<span className="flex items-center gap-2">{t.name}<Badge>{t.key}</Badge><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></span>}
            actions={<><Link to="/templates" className="text-sm text-muted hover:text-fg">← Back</Link>{can("editTemplates") && <Button loading={archive.isPending} onClick={() => archive.mutate(t.status === "active" ? "archived" : "active")}>{t.status === "active" ? "Archive" : "Restore"}</Button>}</>} />
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "editor", label: "Editor & preview" }, { id: "versions", label: `Versions (${t.versions?.length ?? 0})` }]} />
          {tab === "editor" ? <Editor t={t} /> : <Versions t={t} />}
        </>
      )}
    </Async>
  );
}

function Versions({ t }: { t: Template }) {
  return (
    <Card pad={false}>
      <Table head={["Version", "Status", "Channels", "Variables", "Author", "Created"]}>
        {[...(t.versions ?? [])].reverse().map((v) => (
          <tr key={v.version}><Td>v{v.version}</Td><Td><Badge tone={v.status === "published" ? "success" : "warning"}>{v.status}</Badge></Td>
            <Td>{Object.keys(v.content).map((c) => CHANNEL_LABEL[c as Channel]).join(", ")}</Td><Td className="font-mono text-xs">{v.variables.join(", ")}</Td><Td>{v.author}</Td><Td className="text-muted">{fmtDate(v.created_at)}</Td></tr>
        ))}
      </Table>
    </Card>
  );
}

function Editor({ t }: { t: Template }) {
  const can = useCan();
  const latest = t.versions?.[t.versions.length - 1] as TemplateVersion | undefined;
  const channels = useMemo(() => (Object.keys(latest?.content ?? { email: {} }) as Channel[]), [latest]);
  const [ch, setCh] = useState<Channel>(channels[0] ?? "email");
  const [subject, setSubject] = useState(latest?.content[ch]?.subject ?? "");
  const [body, setBody] = useState(latest?.content[ch]?.body ?? "");
  const [wa, setWa] = useState<WaState>(() => { const c = latest?.content.whatsapp; return { header: c?.header, footer: c?.footer, buttons: c?.buttons, wa_category: c?.wa_category, language: c?.language, approval: c?.approval }; });
  const [data, setData] = useState(JSON.stringify(t.sample_data ?? {}, null, 2));
  const [preview, setPreview] = useState<Record<string, { subject?: string; body: string }> | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const projects = useApi<Project[]>("/internal/projects", undefined, !t.project_id);
  const [asProject, setAsProject] = useState("");
  const brandProject = t.project_id ?? (asProject || projects.data?.[0]?.id);
  const brand = useApi<Branding>(`/internal/projects/${brandProject}/branding`, undefined, !!brandProject);
  useEffect(() => { setSubject(latest?.content[ch]?.subject ?? ""); setBody(latest?.content[ch]?.body ?? ""); }, [ch]); // eslint-disable-line react-hooks/exhaustive-deps
  let parsed: Record<string, string> | null = null; let jsonError = "";
  try { parsed = JSON.parse(data); } catch (e) { jsonError = (e as Error).message; }
  const content = { ...(latest?.content ?? {}), [ch]: { ...(ch === "email" ? { subject } : {}), ...(ch === "whatsapp" ? wa : {}), body } };
  const issues = ch === "whatsapp" ? waIssues(body, wa, Object.keys(t.sample_data ?? {})) : [];
  // When previewing as a project, use that project's brand name for {{app_name}} so the preview matches what its users see.
  const previewData = parsed && parsed.app_name !== undefined && brand.data?.sender_name ? { ...parsed, app_name: brand.data.sender_name } : parsed;
  const render = useAction(() => api.post<Rendered>(`/v1/templates/${t.id}/preview`, { content, data: previewData }), { onSuccess: (r) => setPreview(r) });
  useEffect(() => {
    if (jsonError) return;
    const timer = setTimeout(() => render.mutate(undefined), 350);
    return () => clearTimeout(timer);
  }, [subject, body, ch, data, wa, brand.data?.sender_name]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction(() => api.post(`/v1/templates/${t.id}/versions`, { content: { ...latest?.content, ...content } }), { invalidate: [`/v1/templates`], success: "New version published" });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Content" actions={<Select aria-label="Channel content" className="w-32" value={ch} onChange={(e) => setCh(e.target.value as Channel)}>{(Array.from(new Set([...channels, "email", "whatsapp"])) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</Select>}>
        <div className="space-y-3">
          {ch === "email" && <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>}
          {ch === "whatsapp" && <WhatsAppFields wa={wa} onChange={setWa} issues={issues} canEdit={can("editTemplates")} />}
          <Field label={ch === "email" ? "HTML body" : "Message text"} hint="Use {{variable}} placeholders. WhatsApp templates must be approved by Meta before use outside the 24-hour window."><Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          {Object.keys(t.sample_data ?? {}).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-muted">Insert variable:</span>
              {Object.keys(t.sample_data ?? {}).map((k) => <button type="button" key={k} onClick={() => setBody((b) => b + `{{${k}}}`)} className="rounded-md border border-border px-1.5 py-0.5 font-mono text-xs hover:bg-surface-2">{`{{${k}}}`}</button>)}
            </div>
          )}
          <Field label="Sample data (JSON)" hint={jsonError ? undefined : "Used for preview and test sends"}><Textarea rows={5} value={data} onChange={(e) => setData(e.target.value)} aria-invalid={!!jsonError} />{jsonError && <span className="text-xs text-danger">Invalid JSON: {jsonError}</span>}</Field>
          <div className="flex flex-wrap gap-2">
            {can("editTemplates") && <><Button onClick={() => setSendOpen(true)} disabled={!!jsonError}>Send notification</Button><Button onClick={() => setDupOpen(true)}>Duplicate</Button></>}
            {can("editTemplates") && <Button variant="primary" disabled={issues.length > 0} onClick={() => save.mutate(undefined)} loading={save.isPending}>Publish new version</Button>}
          </div>
        </div>
      </Card>
      <Card title="Live preview" actions={t.project_id ? <span className="text-xs text-muted">With this project’s branding</span> : <Select aria-label="Preview as project" className="w-48" value={brandProject ?? ""} onChange={(e) => setAsProject(e.target.value)}>{projects.data?.map((p) => <option key={p.id} value={p.id}>Preview as {p.name}</option>) ?? <option>Loading…</option>}</Select>}>
        <TemplatePreview rendered={preview} branding={brand.data} loading={render.isPending} from={brand.data?.sender_name || undefined} />
      </Card>
      {!t.project_id && <div className="lg:col-span-2"><UsageCard t={t} onPreview={(id) => { setAsProject(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} /></div>}
      <SendModal open={sendOpen} onOpenChange={setSendOpen} t={t} data={data} />
      <DuplicateModal open={dupOpen} onOpenChange={setDupOpen} t={t} />
    </div>
  );
}
