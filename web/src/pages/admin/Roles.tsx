import { Check, Lock, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge, Button, Card, Table, Td, useConfirm } from "../../components/ui";
import { api } from "../../lib/api";
import { useAction, useApi } from "../../lib/hooks";
import { DEFAULT_MATRIX, PAGES, PERM_DEFS, ROLE_ORDER, type Perm, type PermGroup } from "../../lib/permissions";
import { ROLE_LABEL, useCan } from "../../lib/session";
import type { Role } from "../../lib/types";

type Matrix = Record<Perm, Role[]>;
const groups: PermGroup[] = ["Organization", "Projects", "Messaging", "Data & security"];
const SENSITIVE: Perm[] = ["writeProviders", "revealRecipients", "createProject", "manageKeys", "viewAudit"];
const ROLE_BLURB: Record<Role, string> = {
  org_admin: "Runs the whole organization. Always has every permission.", project_admin: "Runs assigned projects: members, keys, providers.",
  developer: "Builds and tests: templates, dev keys, logs.", client: "Customer of a project: sees their own notifications and can brand their emails.", viewer: "Read-only.",
};
const eq = (a: Role[], b: Role[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function Roles() {
  const can = useCan();
  const editable = can("manageRoles");
  const q = useApi<{ matrix: Matrix }>("/internal/permissions");
  if (q.isPending) return <Card title="Permissions"><p className="text-sm text-muted">Loading…</p></Card>;
  const saved = q.data?.matrix ?? DEFAULT_MATRIX;
  return <Editor key={JSON.stringify(saved)} saved={saved} editable={editable} />;
}

function Editor({ saved, editable }: { saved: Matrix; editable: boolean }) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Matrix>(saved);
  const changed = useMemo(() => PERM_DEFS.filter((d) => !d.locked && !eq(draft[d.key], saved[d.key])), [draft, saved]);
  const save = useAction(() => api.put("/internal/permissions", { matrix: draft }), { invalidate: ["/internal/permissions", "/internal/audit-logs"], success: "Permissions saved and recorded in the audit log" });
  const reset = useAction(() => api.post("/internal/permissions/reset"), { invalidate: ["/internal/permissions", "/internal/audit-logs"], success: "Defaults restored" });
  const toggle = (p: Perm, r: Role, on: boolean) => setDraft((d) => ({ ...d, [p]: on ? Array.from(new Set([...d[p], r])) : d[p].filter((x) => x !== r) }));
  const onSave = async () => {
    const risky = changed.filter((d) => SENSITIVE.includes(d.key) && draft[d.key].length > saved[d.key].length);
    const ok = await confirm({ title: `Save ${changed.length} permission change${changed.length > 1 ? "s" : ""}?`, confirmLabel: "Save changes", danger: risky.length > 0,
      description: <>This takes effect for everyone immediately and is recorded in the audit log.{risky.length > 0 && <> You are granting sensitive access: <strong>{risky.map((d) => d.label).join("; ")}</strong>.</>}</> });
    if (ok) save.mutate(undefined);
  };
  const onReset = async () => { if (await confirm({ title: "Restore default permissions?", description: "All customized permissions are replaced by the defaults. This is recorded in the audit log.", confirmLabel: "Restore defaults", danger: true })) reset.mutate(undefined); };
  const view = editable ? draft : saved;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><span className="font-semibold">{ROLE_LABEL[r]}</span><Badge tone="primary" dot={false}>{PERM_DEFS.filter((d) => view[d.key].includes(r) || r === "org_admin").length} / {PERM_DEFS.length}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_BLURB[r]}</p>
          </div>
        ))}
      </div>

      <Card title="What each role can do" pad={false}
        actions={editable ? <><Button size="sm" onClick={onReset} loading={reset.isPending}>Restore defaults</Button><Button size="sm" variant="primary" disabled={changed.length === 0} loading={save.isPending} onClick={onSave}>Save{changed.length ? ` (${changed.length})` : ""}</Button><Button size="sm" disabled={changed.length === 0} onClick={() => setDraft(saved)}>Discard</Button></> : <Badge tone="neutral" dot={false}><Lock className="mr-1 size-3" />View only</Badge>}>
        <Table head={["Permission", ...ROLE_ORDER.map((r) => ROLE_LABEL[r])]}>
          {groups.flatMap((g) => [
            <tr key={g} className="bg-secondary/50"><td colSpan={ROLE_ORDER.length + 1} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</td></tr>,
            ...PERM_DEFS.filter((d) => d.group === g).map((d) => {
              const dirty = !d.locked && !eq(draft[d.key], saved[d.key]);
              return (
                <tr key={d.key} className={dirty ? "bg-primary-soft/40" : undefined}>
                  <Td><div className="font-medium">{d.label}{dirty && <span className="ml-2 text-xs font-normal text-primary">changed</span>}</div><div className="text-xs text-muted-foreground">{d.desc}</div></Td>
                  {ROLE_ORDER.map((r) => (
                    <Td key={r}>
                      {r === "org_admin" || d.locked ? (view[d.key].includes(r) ? <span title="Always on" className="inline-flex items-center gap-1 text-success"><Lock className="size-3.5" /><Check className="size-4" /></span> : <Minus className="size-4 text-muted-foreground" />)
                        : editable ? <Switch checked={draft[d.key].includes(r)} onCheckedChange={(v) => toggle(d.key, r, v)} aria-label={`${ROLE_LABEL[r]}: ${d.label}`} />
                        : view[d.key].includes(r) ? <Check className="size-4 text-success" aria-label="Allowed" /> : <Minus className="size-4 text-muted-foreground" aria-label="Not allowed" />}
                    </Td>
                  ))}
                </tr>
              );
            }),
          ])}
        </Table>
      </Card>

      <Card title="Who sees which pages" pad={false}>
        <Table head={["Page", "Needs", ...ROLE_ORDER.map((r) => ROLE_LABEL[r])]}>
          {PAGES.map((pg) => (
            <tr key={pg.label}>
              <Td className="font-medium">{pg.label}</Td>
              <Td className="text-xs text-muted-foreground">{pg.perm ? PERM_DEFS.find((d) => d.key === pg.perm)?.label : "Any signed-in user"}</Td>
              {ROLE_ORDER.map((r) => <Td key={r}>{!pg.perm || r === "org_admin" || view[pg.perm].includes(r) ? <Check className="size-4 text-success" aria-label="Visible" /> : <Minus className="size-4 text-muted-foreground" aria-label="Hidden" />}</Td>)}
            </tr>
          ))}
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">Project access is separate: a Manager, Developer or Client only sees the projects they are assigned to. These switches hide or show screens and buttons, but the backend must enforce every permission itself.</p>
    </div>
  );
}
