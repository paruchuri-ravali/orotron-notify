import clsx from "clsx";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { ACCENTS, FONTS, isHex, useTheme, type Density, type FontKey, type Mode } from "../lib/theme";
import { Button, Modal } from "./ui";

const modes: { id: Mode; label: string; icon: typeof Sun }[] = [{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }, { id: "system", label: "System", icon: Monitor }];

function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: typeof Sun }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={clsx("flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm", value === o.id ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-surface-2")}>
          {o.icon && <o.icon className="size-4" aria-hidden />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function AppearanceModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { prefs, update, reset } = useTheme();
  const section = "mb-4";
  const h = "mb-2 block text-xs font-semibold uppercase tracking-wide text-muted";
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Appearance" description="Changes apply instantly and are saved in this browser only.">
      <div className={section}><span className={h}>Mode</span><Seg label="Color mode" value={prefs.mode} onChange={(mode) => update({ mode })} options={modes} /></div>
      <div className={section}>
        <span className={h}>Accent color</span>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((a) => (
            <button key={a.id} aria-label={a.name} title={a.name} onClick={() => update({ accent: a.hex })} style={{ background: a.hex }}
              className="grid size-8 place-items-center rounded-full border-2 border-surface ring-1 ring-border">
              {prefs.accent.toLowerCase() === a.hex && <Check className="size-4 text-white" aria-hidden />}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-2 text-xs text-muted">Custom
            <input type="color" aria-label="Custom accent color" value={isHex(prefs.accent) ? prefs.accent : "#4f46e5"} onChange={(e) => update({ accent: e.target.value })} className="h-8 w-10 rounded border border-border bg-surface" />
          </label>
        </div>
      </div>
      <div className={section}>
        <span className={h}>Font</span>
        <Seg<FontKey> label="Font" value={prefs.font} onChange={(font) => update({ font })} options={(Object.keys(FONTS) as FontKey[]).map((k) => ({ id: k, label: FONTS[k].name }))} />
      </div>
      <div className={section}>
        <span className={h}>Density</span>
        <Seg<Density> label="Density" value={prefs.density} onChange={(density) => update({ density })} options={[{ id: "comfortable", label: "Comfortable" }, { id: "compact", label: "Compact" }]} />
      </div>
      <div className="flex justify-between"><Button onClick={reset}>Reset to defaults</Button><Button variant="primary" onClick={() => onOpenChange(false)}>Done</Button></div>
    </Modal>
  );
}
