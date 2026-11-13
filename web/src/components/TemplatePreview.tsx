import clsx from "clsx";
import { CheckCheck, Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { brandedEmail } from "../lib/branding";
import type { Branding, ChannelContent } from "../lib/types";
import { EmptyState, Skeleton } from "./ui";

export type Rendered = Record<string, ChannelContent>;

function Pills<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: typeof Monitor }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={clsx("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", value === o.id ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg")}>
          {o.icon && <o.icon className="size-3.5" aria-hidden />}{o.label}
        </button>
      ))}
    </div>
  );
}

const waFormat = (t: string) => t.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i}>{p.slice(1, -1)}</strong> : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : p));

/** Preview of rendered template content. Layout mirrors what the backend will send; email is shown in a sandboxed frame. */
export function TemplatePreview({ rendered, branding, loading, from = "Your Brand", to = "alex@example.com" }: { rendered: Rendered | null; branding?: Branding | null; loading?: boolean; from?: string; to?: string }) {
  const channels = Object.keys(rendered ?? {});
  const [ch, setCh] = useState(channels[0] ?? "email");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  useEffect(() => { if (channels.length && !channels.includes(ch)) setCh(channels[0]); }, [channels.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rendered) return loading ? <Skeleton className="h-80" /> : <EmptyState title="No preview yet" description="The preview appears here as soon as the template renders." />;
  const v = rendered[ch] ?? rendered[channels[0]];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pills label="Channel" value={ch} onChange={setCh} options={channels.map((c) => ({ id: c, label: c === "whatsapp" ? "WhatsApp" : c.charAt(0).toUpperCase() + c.slice(1) }))} />
        {ch === "email" && <Pills label="Device" value={device} onChange={setDevice} options={[{ id: "desktop", label: "Desktop", icon: Monitor }, { id: "mobile", label: "Mobile", icon: Smartphone }]} />}
      </div>
      {ch === "email" ? (
        <div className={clsx("mx-auto overflow-hidden rounded-xl border border-border bg-surface transition-all", device === "mobile" ? "max-w-[375px]" : "w-full")}>
          <dl className="space-y-1 border-b border-border bg-surface-2/50 px-4 py-3 text-xs">
            <div className="flex gap-2"><dt className="w-12 text-muted">From</dt><dd className="truncate font-medium">{from}</dd></div>
            <div className="flex gap-2"><dt className="w-12 text-muted">To</dt><dd className="truncate">{to}</dd></div>
            <div className="flex gap-2"><dt className="w-12 text-muted">Subject</dt><dd className="truncate font-semibold">{v.subject ?? "(no subject)"}</dd></div>
          </dl>
          <iframe title="Email preview" sandbox="" srcDoc={branding ? brandedEmail(branding, v.body) : `<body style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#222;padding:24px">${v.body}</body>`} className="h-[460px] w-full bg-white" />
        </div>
      ) : (
        <div className="mx-auto max-w-[360px] rounded-2xl p-4" style={{ background: "color-mix(in srgb, var(--success) 10%, var(--surface-2))" }}>
          <div className="ml-auto w-fit max-w-[88%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13.5px] text-[#111b21] shadow-sm">
            {v.header && <p className="mb-1 break-words font-semibold">{v.header}</p>}
            <p className="whitespace-pre-wrap break-words">{waFormat(v.body)}</p>
            {v.footer && <p className="mt-1 break-words text-[12px] text-[#667781]">{v.footer}</p>}
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">12:04<CheckCheck className="size-3.5 text-[#53bdeb]" aria-hidden /></p>
          </div>
          {!!v.buttons?.length && (
            <div className="ml-auto mt-1 w-fit min-w-[55%] max-w-[88%] space-y-1">
              {v.buttons.map((b, i) => <div key={i} className="rounded-lg bg-[#d9fdd3] px-3 py-2 text-center text-[13px] font-medium text-[#027eb5] shadow-sm">{b.type === "url" ? "↗ " : b.type === "phone" ? "☎ " : "↩ "}{b.text || "Button"}</div>)}
            </div>
          )}
          <p className="mt-3 text-center text-[11px] text-muted">Outside the 24-hour reply window this must be a Meta-approved template.</p>
        </div>
      )}
    </div>
  );
}
