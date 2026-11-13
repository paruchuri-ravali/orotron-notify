import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, Select } from "./ui";
import type { ChannelContent, WaButton } from "../lib/types";

export type WaState = Pick<ChannelContent, "header" | "footer" | "buttons" | "wa_category" | "language" | "approval">;
export const LANGS: Record<string, string> = { en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil", en_GB: "English (UK)", en_AU: "English (AU)", es: "Spanish" };
const approvalTone = { draft: "neutral", pending: "warning", approved: "success", rejected: "danger" } as const;

/** Meta template limits (simplified): header 60, body 1024, footer 60, button text 25, max 10 buttons. */
export function waIssues(body: string, wa: WaState, known: string[]): string[] {
  const out: string[] = [];
  if (body.length > 1024) out.push(`Body is ${body.length}/1024 characters.`);
  if ((wa.header ?? "").length > 60) out.push("Header is over 60 characters.");
  if ((wa.footer ?? "").length > 60) out.push("Footer is over 60 characters.");
  if ((wa.buttons ?? []).length > 10) out.push("At most 10 buttons.");
  (wa.buttons ?? []).forEach((b, i) => {
    if (!b.text.trim()) out.push(`Button ${i + 1} needs text.`);
    if (b.text.length > 25) out.push(`Button ${i + 1} text is over 25 characters.`);
    if (b.type === "url" && !/^https:\/\//.test(b.value ?? "")) out.push(`Button ${i + 1} needs an https URL.`);
    if (b.type === "phone" && !/^\+\d{7,15}$/.test(b.value ?? "")) out.push(`Button ${i + 1} needs a phone like +14155550100.`);
  });
  const used = Array.from(new Set([...body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1])));
  used.filter((v) => !known.includes(v)).forEach((v) => out.push(`Variable {{${v}}} has no sample value.`));
  return out;
}

export function WhatsAppFields({ wa, onChange, issues, canEdit }: { wa: WaState; onChange: (w: WaState) => void; issues: string[]; canEdit: boolean }) {
  const set = <K extends keyof WaState>(k: K, v: WaState[K]) => onChange({ ...wa, [k]: v });
  const buttons = wa.buttons ?? [];
  const setBtn = (i: number, p: Partial<WaButton>) => set("buttons", buttons.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const approval = wa.approval ?? "draft";
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">WhatsApp template (Meta format)</span>
        <span className="flex items-center gap-2"><Badge tone={approvalTone[approval]}>{approval}</Badge>
          {canEdit && approval === "draft" && <Button size="sm" disabled={issues.length > 0} onClick={() => set("approval", "pending")}>Submit for approval</Button>}
          {canEdit && approval === "pending" && <Button size="sm" onClick={() => set("approval", "approved")}>Simulate approval</Button>}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Approval is simulated in this demo. In production the template is submitted to Meta and cannot be used until approved.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category"><Select value={wa.wa_category ?? "utility"} onChange={(e) => set("wa_category", e.target.value as WaState["wa_category"])}><option value="utility">Utility</option><option value="authentication">Authentication</option><option value="marketing">Marketing</option></Select></Field>
        <Field label="Language"><Select value={wa.language ?? "en"} onChange={(e) => set("language", e.target.value)}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      </div>
      <Field label="Header (optional)" hint={`${(wa.header ?? "").length}/60`}><Input value={wa.header ?? ""} onChange={(e) => set("header", e.target.value)} /></Field>
      <Field label="Footer (optional)" hint={`${(wa.footer ?? "").length}/60`}><Input value={wa.footer ?? ""} onChange={(e) => set("footer", e.target.value)} /></Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-medium">Buttons<Button size="sm" type="button" disabled={buttons.length >= 10} onClick={() => set("buttons", [...buttons, { type: "quick_reply", text: "" }])}><Plus className="size-3.5" />Add</Button></div>
        {buttons.map((b, i) => (
          <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-2">
            <Select aria-label="Button type" value={b.type} onChange={(e) => setBtn(i, { type: e.target.value as WaButton["type"] })}><option value="quick_reply">Quick reply</option><option value="url">URL</option><option value="phone">Phone</option></Select>
            <div className="grid gap-2 sm:grid-cols-2"><Input aria-label="Button text" placeholder="Button text" value={b.text} onChange={(e) => setBtn(i, { text: e.target.value })} />
              {b.type !== "quick_reply" && <Input aria-label="Button value" placeholder={b.type === "url" ? "https://…" : "+14155550100"} value={b.value ?? ""} onChange={(e) => setBtn(i, { value: e.target.value })} />}</div>
            <Button type="button" size="sm" aria-label="Remove button" onClick={() => set("buttons", buttons.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button>
          </div>
        ))}
      </div>
      {issues.length > 0 && <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs text-warning">{issues.map((m) => <li key={m}>{m}</li>)}</ul>}
    </div>
  );
}
