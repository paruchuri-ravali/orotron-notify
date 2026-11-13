import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useApi } from "../lib/hooks";
import type { SearchHit } from "../lib/types";
import { Skeleton } from "./ui";

export interface PaletteItem { id: string; label: string; group: string; icon?: ComponentType<{ className?: string }>; run: () => void; hint?: string }

export function CommandPalette({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: PaletteItem[] }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [idx, setIdx] = useState(0);
  const nav = useNavigate();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(() => setDq(q), 180); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!open) { setQ(""); setDq(""); setIdx(0); } }, [open]);
  const remote = useApi<SearchHit[]>("/internal/search", { q: dq }, open && dq.length >= 2);
  const all = useMemo<PaletteItem[]>(() => {
    const local = items.filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()));
    const hits = (dq.length >= 2 ? remote.data ?? [] : []).map<PaletteItem>((h) => ({ id: h.type + h.id, label: h.label, group: `Results · ${h.type}s`, run: () => nav({ to: h.to }) }));
    return [...local, ...hits];
  }, [items, q, dq, remote.data, nav]);
  useEffect(() => setIdx(0), [q, remote.data]);
  useEffect(() => { list.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" }); }, [idx]);
  const go = (i: PaletteItem | undefined) => { if (!i) return; onOpenChange(false); i.run(); };
  const groups = [...new Set(all.map((i) => i.group))];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fade-in fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="pop-in fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 text-muted" aria-hidden />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, notifications, templates, projects…" aria-label="Search"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, all.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter") go(all[idx]);
              }}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
            <kbd className="rounded border border-border px-1.5 text-[10px] text-muted">ESC</kbd>
          </div>
          <div ref={list} className="max-h-[50vh] overflow-y-auto p-2">
            {dq.length >= 2 && remote.isPending && <Skeleton className="m-2 h-8" />}
            {all.length === 0 && !remote.isPending && <p className="px-3 py-8 text-center text-sm text-muted">No results for “{q}”.</p>}
            {groups.map((g) => (
              <div key={g} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted">{g}</div>
                {all.map((it, i) => it.group !== g ? null : (
                  <button key={it.id} data-i={i} onMouseMove={() => setIdx(i)} onClick={() => go(it)}
                    className={clsx("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px]", i === idx ? "bg-primary-soft text-primary" : "")}>
                    {it.icon && <it.icon className="size-4 shrink-0" />}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
                    {i === idx && <CornerDownLeft className="size-3.5 opacity-60" aria-hidden />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
