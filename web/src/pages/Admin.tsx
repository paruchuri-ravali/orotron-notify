import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Async, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td } from "../components/ui";
import { api } from "../lib/api";
import { useAction } from "../lib/hooks";
import { fmtDate, fmtNum, titleCase } from "../lib/format";
import { useApi } from "../lib/hooks";
import { ROLE_LABEL, useCan } from "../lib/session";
import { Roles } from "./admin/Roles";
import { Audit } from "./admin/AuditLog";
import type { Me, Member, Project, Role, SecurityEvent } from "../lib/types";

export function AdminPage() {
  const can = useCan();
  const [tab, setTab] = useState<"users" | "roles" | "audit" | "security" | "limits">("users");
  return (
    <>
      <PageHeader title="Security & administration" description="Users, roles, audit trail, security events and limits." />
      <Tabs value={tab} onChange={setTab} tabs={([{ id: "users", label: "Users" }, { id: "roles", label: "Roles & permissions" }, { id: "audit", label: "Audit log" }, { id: "security", label: "Security events" }, { id: "limits", label: "Limits" }] as { id: typeof tab; label: string }[]).filter((t) => t.id !== "audit" || can("viewAudit"))} />
      {tab === "users" && <Users />}{tab === "roles" && <Roles />}{tab === "audit" && <Audit />}{tab === "security" && <Security />}{tab === "limits" && <Limits />}
    </>
  );
}

const inviteSchema = z.object({ name: z.string().trim().min(2, "Enter the person's full name").max(80), email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"), role: z.enum(["project_admin", "developer", "client"]), project_id: z.string() });
type InviteForm = z.infer<typeof inviteSchema>;

function Users() {
  const can = useCan();
  const me = useApi<Me>("/internal/me");
  const isAdmin = me.data?.role === "org_admin";
  const grantable: Role[] = isAdmin ? ["project_admin", "developer", "client"] : ["developer", "client"];
  const q = useApi<Member[]>("/internal/users");
  const projects = useApi<Project[]>("/internal/projects");
  const [open, setOpen] = useState(false);
  const inv = { invalidate: ["/internal/users", "/internal/audit-logs"] };
  const change = useAction(({ id, role }: { id: string; role: Role }) => api.patch(`/internal/users/${id}`, { role }), { ...inv, success: "Role updated and recorded in the audit log" });
  const invite = useAction((v: InviteForm) => api.post("/internal/users", { ...v, project_id: v.project_id === "org" ? null : v.project_id }), { ...inv, success: "User added and recorded in the audit log", onSuccess: () => { setOpen(false); form.reset(); } });
  const form = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), defaultValues: { name: "", email: "", role: "developer", project_id: "" } });
  const active = (projects.data ?? []).filter((p) => p.status === "active");
  const role = form.watch("role"); const pid = form.watch("project_id") || (isAdmin ? "org" : active[0]?.id ?? "");
  const canChange = (m: Member) => can("manageUsers") && m.role !== "org_admin" && (isAdmin || (m.role !== "project_admin" && !!m.project_id));
  return (
    <Card title="Organization users" pad={false} actions={can("manageUsers") ? <Button size="sm" variant="primary" onClick={() => setOpen(true)}>Invite user</Button> : undefined}>
      <Async q={q} empty={(d) => d.length === 0}>
        {(rows) => (
          <Table head={["Name", "Email", "Role", "Scope"]}>
            {rows.map((m) => (
              <tr key={m.user_id}>
                <Td className="font-medium">{m.name}</Td><Td className="text-muted">{m.email}</Td>
                <Td>{canChange(m) ? <Select aria-label={`Role for ${m.name}`} className="w-40" value={m.role} onChange={(e) => change.mutate({ id: m.user_id, role: e.target.value as Role })}>{grantable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select> : <Badge tone="primary">{ROLE_LABEL[m.role] ?? titleCase(m.role)}</Badge>}</Td>
                <Td className="text-muted">{m.project_id ? (projects.data?.find((p) => p.id === m.project_id)?.name ?? "Project") : "Organization"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
      <Modal open={open} onOpenChange={setOpen} title="Invite user" description={isAdmin ? "Give someone access to a project, or to the whole organization." : "You can add Developers and Clients to your own projects."}>
        <form className="space-y-3" noValidate onSubmit={form.handleSubmit((v) => invite.mutate({ ...v, project_id: v.project_id || pid }))}>
          <Field label="Full name" error={form.formState.errors.name?.message}><Input autoComplete="off" aria-invalid={!!form.formState.errors.name} {...form.register("name")} /></Field>
          <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} /></Field>
          <Field label="Role" hint={isAdmin ? undefined : "Managers and admins can only be added by the main admin."}><Select value={role} onChange={(e) => form.setValue("role", e.target.value as InviteForm["role"])}>{grantable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
          <Field label="Project"><Select value={pid} onChange={(e) => form.setValue("project_id", e.target.value)}>{isAdmin && <option value="org">Entire organization</option>}{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={invite.isPending}>Add user</Button></div>
        </form>
      </Modal>
    </Card>
  );
}

function Security() {
  const q = useApi<SecurityEvent[]>("/internal/security-events");
  return <Card title="Security events" pad={false}><Async q={q} empty={(d) => d.length === 0}>{(rows) => <ul className="divide-y divide-border">{rows.map((e) => <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><Badge tone={e.severity === "high" ? "danger" : e.severity === "medium" ? "warning" : "neutral"} className="mr-2">{e.severity}</Badge>{e.message}</span><span className="shrink-0 text-xs text-muted">{fmtDate(e.at)}</span></li>)}</ul>}</Async></Card>;
}

function Limits() {
  const q = useApi<Project[]>("/internal/projects");
  return <Card title="Project quotas & rate limits" pad={false}><Async q={q}>{(rows) => <Table head={["Project", "Daily quota", "Rate limit", "Status"]}>{rows.map((p) => <tr key={p.id}><Td className="font-medium">{p.name}</Td><Td>{fmtNum(p.limits.daily_quota)}/day</Td><Td>{p.limits.rate_per_minute}/min</Td><Td><Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge></Td></tr>)}</Table>}</Async><p className="border-t border-border px-4 py-2.5 text-xs text-muted">Edit limits on each project’s Settings tab.</p></Card>;
}
