import clsx from "clsx";
import { AlertTriangle, BellRing, Check, Clock, Copy, Inbox, Loader2, Mail, MessageCircle, Smartphone } from "lucide-react";
import type { Channel } from "../lib/types";
import { highlight } from "sugar-high";
import { Children, createContext, useMemo, isValidElement, useCallback, useContext, useRef, useState, type ChangeEvent, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { toast } from "sonner";
import type { ApiError } from "../lib/api";
import { Button as SButton } from "@/components/ui/button";
import { Badge as SBadge } from "@/components/ui/badge";
import { Card as SCard, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input as SInput } from "@/components/ui/input";
import { Textarea as STextarea } from "@/components/ui/textarea";
import { Select as SSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton as SSkeleton } from "@/components/ui/skeleton";
import { Table as STable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs as STabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function Button({ variant = "secondary", size = "md", loading, className, children, disabled, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  const v = { primary: "default", secondary: "outline", ghost: "ghost", danger: "destructive" }[variant] as "default" | "outline" | "ghost" | "destructive";
  return (
    <SButton {...p} variant={v} size={size === "sm" ? "sm" : "default"} disabled={disabled || loading}
      className={cn(variant === "primary" && "text-primary-foreground", variant === "danger" && "text-white", className)}>
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </SButton>
  );
}

const tones = {
  success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info", neutral: "bg-surface-2 text-muted", primary: "bg-primary-soft text-primary",
};
export type Tone = keyof typeof tones;
export function Badge({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <SBadge variant="outline" className={cn("gap-1.5 border-transparent px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ring-current/15", tones[tone], className)}>
      {dot && tone !== "neutral" && <span className="size-1.5 rounded-full bg-current" aria-hidden />}{children}
    </SBadge>
  );
}

const chIcons: Record<Channel, { icon: typeof Mail; cls: string }> = {
  email: { icon: Mail, cls: "bg-info-soft text-info" }, whatsapp: { icon: MessageCircle, cls: "bg-success-soft text-success" },
  sms: { icon: Smartphone, cls: "bg-warning-soft text-warning" }, push: { icon: BellRing, cls: "bg-primary-soft text-primary" }, in_app: { icon: Inbox, cls: "bg-surface-2 text-muted" },
};
export function ChannelIcon({ channel, size = "md" }: { channel: Channel; size?: "sm" | "md" }) {
  const { icon: I, cls } = chIcons[channel];
  return <span className={clsx("grid shrink-0 place-items-center rounded-lg", cls, size === "sm" ? "size-6" : "size-8")} aria-hidden><I className={size === "sm" ? "size-3.5" : "size-4"} /></span>;
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <SCard className={cn("gap-0 py-0 shadow-none", className)}>
      {(title || actions) && (
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-2 border-b px-4 py-2.5 [.border-b]:pb-2.5">
          <CardTitle className="text-[13px] font-semibold">{title}</CardTitle>
          <CardAction className="static flex items-center gap-2 self-auto">{actions}</CardAction>
        </CardHeader>
      )}
      <CardContent className={pad ? "p-4" : "p-0"}>{children}</CardContent>
    </SCard>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={clsx("mt-1 text-2xl font-semibold tabular-nums", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) { return <SInput {...p} className={cn("h-8 rounded-lg text-[13px] shadow-none", className)} />; }
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <STextarea {...p} className={cn("rounded-lg font-mono text-xs shadow-none", className)} />; }
const text = (n: ReactNode): string => (typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(text).join("") : "");

/** shadcn Select with the same API as a native <select> with <option> children. */
export function Select({ className, children, value, onChange, disabled, "aria-label": ariaLabel }: SelectHTMLAttributes<HTMLSelectElement>) {
  const opts = Children.toArray(children).filter(isValidElement).map((c) => {
    const p = c.props as { value?: string | number; children?: ReactNode };
    return { value: String(p.value ?? text(p.children)), label: p.children };
  });
  const v = value === undefined || value === null || value === "" ? undefined : String(value);
  return (
    <SSelect value={v} disabled={disabled} onValueChange={(nv) => onChange?.({ target: { value: nv }, currentTarget: { value: nv } } as unknown as ChangeEvent<HTMLSelectElement>)}>
      <SelectTrigger aria-label={ariaLabel} className={cn("h-8 w-full rounded-lg text-[13px] shadow-none data-[size=default]:h-8", className)}><SelectValue placeholder="Select…" /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </SSelect>
  );
}
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
      {error ? <span role="alert" className="mt-1 block text-xs text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) { return <SSkeleton className={className} aria-hidden />; }
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }, (_, j) => <Skeleton key={j} className="h-5" />)}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Inbox className="size-8 text-muted" aria-hidden />
      <div className="font-medium">{title}</div>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  const e = error as ApiError;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-danger" aria-hidden />
      <div className="font-medium">{e.status === 0 ? "Backend not reachable" : "Something went wrong"}</div>
      <p className="max-w-md text-sm text-muted">{error.message}</p>
      {e.code && <code className="text-xs text-muted">{e.code}{e.requestId ? ` · ${e.requestId}` : ""}</code>}
      {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function PendingBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning">
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div><span className="font-semibold">Pending backend feature. </span>{children}</div>
    </div>
  );
}

/** Handles loading / error / empty uniformly for query results. */
export function Async<T>({ q, children, empty, skeleton }: {
  q: { data: T | undefined; isPending: boolean; error: ApiError | null; refetch: () => unknown };
  children: (d: T) => ReactNode; empty?: (d: T) => boolean; skeleton?: ReactNode;
}) {
  if (q.isPending) return <>{skeleton ?? <TableSkeleton />}</>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data === undefined) return null;
  if (empty?.(q.data)) return <EmptyState title="Nothing here yet" description="No records match the current filters." />;
  return <>{children(q.data)}</>;
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <STable className="min-w-[640px] text-[13px]">
        <TableHeader><TableRow>{head.map((h, i) => <TableHead key={i} className="px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{children}</TableBody>
      </STable>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <TableCell className={cn("px-4 py-2.5 whitespace-normal", className)}>{children}</TableCell>;

export function CursorPager({ page, hasNext, onPrev, onNext, total }: { page: number; hasNext: boolean; onPrev: () => void; onNext: () => void; total?: number }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted">
      <span>Page {page + 1}{total !== undefined ? ` · ${total} results` : ""}</span>
      <div className="flex gap-2">
        <Button size="sm" onClick={onPrev} disabled={page === 0}>Previous</Button>
        <Button size="sm" onClick={onNext} disabled={!hasNext}>Next</Button>
      </div>
    </div>
  );
}

export function Modal({ open, onOpenChange, title, description, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", wide ? "sm:max-w-3xl" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? "" : "sr-only"}>{description ?? title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/* Confirmation dialogs (replace window.confirm). Usage: const confirm = useConfirm(); if (await confirm({...})) ... */
type ConfirmOpts = { title: string; description?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [o, setO] = useState<ConfirmOpts | null>(null);
  const res = useRef<(v: boolean) => void>(undefined);
  const ask = useCallback((opts: ConfirmOpts) => new Promise<boolean>((r) => { res.current = r; setO(opts); }), []);
  const close = (v: boolean) => { res.current?.(v); res.current = undefined; setO(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <AlertDialog open={!!o} onOpenChange={(open) => { if (!open) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{o?.title}</AlertDialogTitle>
            <AlertDialogDescription>{o?.description ?? "Are you sure?"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{o?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction className={o?.danger ? "bg-destructive text-white hover:bg-destructive/90" : ""} onClick={() => close(true)}>{o?.confirmLabel ?? "Confirm"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <STabs value={value} onValueChange={(v) => onChange(v as T)} className="mb-5 max-w-full overflow-x-auto">
      <TabsList>{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
    </STabs>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error("Copy failed"); }
    }}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{done ? "Copied" : label}
    </Button>
  );
}

export function Code({ children, lang }: { children: string; lang?: string }) {
  const html = useMemo(() => highlight(children), [children]);
  return (
    <div className="group relative">
      {lang && <span className="absolute left-3 top-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{lang}</span>}
      <pre className={cn("sh-code overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed", lang && "pt-7")}><code className="font-mono" dangerouslySetInnerHTML={{ __html: html }} /></pre>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><CopyButton text={children} /></div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <Switch checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} />;
}
