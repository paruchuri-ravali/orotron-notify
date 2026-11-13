import { useState } from "react";
import { CHANNEL_LABEL } from "../lib/features";
import type { Channel } from "../lib/types";
import { Select } from "./ui";

export function useDateRange(initialDays = 14) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [from, setFrom] = useState(iso(new Date(Date.now() - initialDays * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  return { from, to, setFrom, setTo };
}

const dateCls = "h-9 rounded-md border border-border bg-surface px-2 text-sm";

export function DateRange({ from, to, setFrom, setTo }: ReturnType<typeof useDateRange>) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" aria-label="From date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={dateCls} />
      <span className="text-muted">→</span>
      <input type="date" aria-label="To date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={dateCls} />
    </div>
  );
}

export function ChannelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select aria-label="Channel" className="w-36" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">All channels</option>
      {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
    </Select>
  );
}
