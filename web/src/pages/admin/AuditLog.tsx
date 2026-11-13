import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DateRange, useDateRange } from "../../components/Filters";
import { Async, Badge, Button, Card, CursorPager, Input, Select, Table, Td, type Tone } from "../../components/ui";
import { fmtDate, relTime, titleCase } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { ROLE_LABEL } from "../../lib/session";
import type { AuditLog, Member, Page, Project } from "../../lib/types";

const cats: [string, string][] = [["all", "All activity"], ["branding", "Branding"], ["template", "Templates"], ["api_key", "API keys"], ["member", "Members"], ["user", "User roles"], ["permissions", "Permissions"], ["project", "Projects"]];
const tone = (a: string): Tone => (/revoked|archived|reset/.test(a) ? "danger" : /permissions|role_changed/.test(a) ? "warning" : /created|added/.test(a) ? "success" : "primary");
const label = (a: string) => titleCase(a.replace(/[._]/g, " "));

export function Audit() {
  const dr = useDateRange(30);
  const [cat, setCat] = useState("all");
  const [actor, setActor] = useState("all");
  const [project, setProject] = useState("all");
  const [text, setText] = useState(""); const [dtext, setDtext] = useState("");
  const [cursors, setCursors] = useState([""]);
  const [open, setOpen] = useState<AuditLog | null>(null);
  useEffect(() => { const t = setTimeout(() => setDtext(text), 300); return () => clearTimeout(t); }, [text]);
  const fk = JSON.stringify([cat, actor, project, dtext, dr.from, dr.to]);
  useEffect(() => setCursors([""]), [fk]);
  const page = cursors.length - 1;
  const users = useApi<Member[]>("/internal/users");
  const projects = useApi<Project[]>("/internal/projects");
  const q = useApi<Page<AuditLog>>("/internal/audit-logs", { category: cat, actor, project, q: dtext, from: dr.from, to: dr.to, cursor: cursors[page], limit: 15 });
  const actors = Array.from(new Map((users.data ?? []).map((u) => [u.email, u.name])).entries());
  const exportCsv = (rows: AuditLog[]) => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = ["when,actor,role,action,target,project,ip,changes", ...rows.map((a) => [a.at, a.actor, a.actor_role, a.action, a.target, a.project_name ?? "", a.ip, (a.changes ?? []).map((c) => `${c.field}: ${c.from} -> ${c.to}`).join("; ")].map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const el = document.createElement("a"); el.href = url; el.download = "audit-log.csv"; el.click(); URL.revokeObjectURL(url);
  };
  return (
    <Card title="Audit log" pad={false} actions={<Badge dot={false}>Append-only</Badge>}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Input aria-label="Search audit log" placeholder="Search actor, target, action…" className="w-56" value={text} onChange={(e) => setText(e.target.value)} />
        <Select aria-label="Activity" className="w-40" value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select aria-label="Who" className="w-44" value={actor} onChange={(e) => setActor(e.target.value)}><option value="all">Anyone</option>{actors.map(([e, n]) => <option key={e} value={e}>{n}</option>)}</Select>
        <Select aria-label="Project" className="w-44" value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All projects</option>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <DateRange {...dr} />
        <Button size="sm" className="ml-auto" disabled={!q.data?.data.length} onClick={() => q.data && exportCsv(q.data.data)}><Download className="size-3.5" />Export page</Button>
      </div>
      <Async q={q} empty={(d) => d.data.length === 0}>
        {(p) => (<>
          <Table head={["When", "Who", "What changed", "Target", "Project", "Details"]}>
            {p.data.map((a) => (
              <tr key={a.id} tabIndex={0} className="cursor-pointer hover:bg-secondary/60" onClick={() => setOpen(a)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(a); }} aria-label={`${label(a.action)} by ${a.actor_name}`}>
                <Td><div>{fmtDate(a.at)}</div><div className="text-xs text-muted-foreground">{relTime(a.at)}</div></Td>
                <Td><div className="font-medium">{a.actor_name}</div><div className="text-xs text-muted-foreground">{ROLE_LABEL[a.actor_role]} · {a.actor}</div></Td>
                <Td><Badge tone={tone(a.action)}>{label(a.action)}</Badge></Td>
                <Td className="max-w-[16rem] truncate">{a.target}</Td>
                <Td className="text-muted-foreground">{a.project_name ?? "Organization"}</Td>
                <Td className="text-xs text-muted-foreground">{a.changes?.length ? `${a.changes.length} field${a.changes.length > 1 ? "s" : ""}` : "–"}</Td>
              </tr>
            ))}
          </Table>
          <CursorPager page={page} total={p.total} hasNext={!!p.next_cursor} onPrev={() => setCursors((c) => c.slice(0, -1))} onNext={() => setCursors((c) => [...c, p.next_cursor!])} />
        </>)}
      </Async>
      <Sheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && <>
            <SheetHeader><SheetTitle>{label(open.action)}</SheetTitle><SheetDescription>{open.target}</SheetDescription></SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {([["Who", `${open.actor_name} (${ROLE_LABEL[open.actor_role]})`], ["Email", open.actor], ["When", fmtDate(open.at)], ["From IP", open.ip], ["Project", open.project_name ?? "Organization"], ["Entry ID", open.id]] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-all font-medium">{v}</dd></div>)}
              </dl>
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Changes</h3>
                {open.changes?.length ? (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {open.changes.map((c) => (
                      <li key={c.field} className="space-y-1 px-3 py-2 text-sm">
                        <div className="font-mono text-xs text-muted-foreground">{c.field}</div>
                        <div className="flex flex-wrap items-center gap-2"><code className="rounded bg-danger-soft px-1.5 py-0.5 text-xs text-danger line-through">{c.from || "empty"}</code>→<code className="rounded bg-success-soft px-1.5 py-0.5 text-xs text-success">{c.to || "empty"}</code></div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">No field-level changes recorded for this action.</p>}
              </section>
              <p className="text-xs text-muted-foreground">Audit entries cannot be edited or deleted. Secrets are never stored in the log.</p>
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
