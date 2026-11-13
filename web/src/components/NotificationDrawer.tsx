import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Async, Badge, Skeleton } from "./ui";
import { CHANNEL_LABEL } from "../lib/features";
import { fmtDate, fmtMs, statusTone, titleCase } from "../lib/format";
import { useApi } from "../lib/hooks";
import type { Notification } from "../lib/types";

/** Slide-over with the delivery timeline and attempt history. The full page lives at /notifications/:id. */
export function NotificationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{id}</SheetTitle>
          <SheetDescription>Delivery timeline, attempts and provider responses.</SheetDescription>
        </SheetHeader>
        {id && <Body id={id} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ id }: { id: string }) {
  const q = useApi<Notification>(`/v1/notifications/${id}`);
  return (
    <div className="space-y-5 px-4 pb-6">
      <Async q={q} skeleton={<div className="space-y-3"><Skeleton className="h-6 w-40" /><Skeleton className="h-24" /><Skeleton className="h-32" /></div>}>
        {(n) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(n.status)}>{n.status}</Badge><Badge>{n.env}</Badge>
              <span className="text-xs text-muted-foreground">{titleCase(n.category)} · {n.priority} priority</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {([["Recipient", n.recipient], ["Template", n.template_key], ["Channels", n.channels.map((c) => CHANNEL_LABEL[c]).join(", ")], ["Created", fmtDate(n.created_at)]] as [string, string][]).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-all font-medium">{v}</dd></div>
              ))}
            </dl>
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Timeline</h3>
              <ol className="relative space-y-3 border-l border-border pl-5">
                {n.timeline?.map((e, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.18 }} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
                    <span className="font-medium">{titleCase(e.type)}</span>{e.detail && <span className="ml-2 text-danger">{e.detail}</span>}
                    <span className="ml-2 text-xs text-muted-foreground">{fmtDate(e.at)}</span>
                  </motion.li>
                ))}
              </ol>
            </section>
            {n.deliveries?.map((d) => (
              <section key={d.id} className="rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm"><span className="font-medium">{CHANNEL_LABEL[d.channel]} · {d.provider}</span><Badge tone={statusTone(d.status)}>{d.status}</Badge></div>
                <ul className="divide-y divide-border">
                  {d.attempts.map((a) => (
                    <li key={a.id} className="space-y-1 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between"><span>Attempt {a.attempt_no} · {fmtMs(a.latency_ms)}</span><Badge tone={a.status === "success" ? "success" : "danger"}>{a.status}</Badge></div>
                      {a.error_code && <div className="font-mono text-danger">{a.error_code}: {a.error_message}</div>}
                      <code className="block break-all text-muted-foreground">{JSON.stringify(a.provider_response)}</code>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <Link to="/notifications/$id" params={{ id }} className="inline-block text-sm text-primary hover:underline">Open full page →</Link>
          </>
        )}
      </Async>
    </div>
  );
}
