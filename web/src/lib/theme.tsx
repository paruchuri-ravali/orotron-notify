import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Mode = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type FontKey = "system" | "serif" | "mono";
export interface Prefs { mode: Mode; accent: string; font: FontKey; density: Density }

export const ACCENTS: { id: string; name: string; hex: string }[] = [
  { id: "indigo", name: "Indigo", hex: "#4f46e5" }, { id: "violet", name: "Violet", hex: "#7c3aed" },
  { id: "teal", name: "Teal", hex: "#0d9488" }, { id: "emerald", name: "Emerald", hex: "#059669" },
  { id: "amber", name: "Amber", hex: "#d97706" }, { id: "rose", name: "Rose", hex: "#e11d48" },
  { id: "slate", name: "Slate", hex: "#475569" },
];
export const FONTS: Record<FontKey, { name: string; css: string }> = {
  system: { name: "System sans", css: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
  serif: { name: "Serif", css: "Georgia, 'Times New Roman', serif" },
  mono: { name: "Monospace", css: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
};
export const DEFAULTS: Prefs = { mode: "system", accent: "#4f46e5", font: "system", density: "comfortable" };

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

function load(): Prefs {
  try {
    const raw = localStorage.getItem("theme.prefs");
    if (raw) { const p = JSON.parse(raw); return { ...DEFAULTS, ...p, accent: isHex(p.accent) ? p.accent : DEFAULTS.accent }; }
    const legacy = localStorage.getItem("theme");
    if (legacy === "dark" || legacy === "light") return { ...DEFAULTS, mode: legacy };
  } catch { /* storage unavailable */ }
  return DEFAULTS;
}

function apply(p: Prefs, dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  const base = isHex(p.accent) ? p.accent : DEFAULTS.accent;
  const primary = dark ? mix(base, "#ffffff", 0.35) : base;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--c1", primary);
  root.style.setProperty("--primary-fg", lum(primary) > 0.45 ? "#0d0f14" : "#ffffff");
  root.style.setProperty("--primary-soft", dark ? mix(primary, "#151922", 0.8) : mix(primary, "#ffffff", 0.88));
  root.style.setProperty("--app-font", FONTS[p.font].css);
  root.dataset.density = p.density;
}

const Ctx = createContext<{ theme: "light" | "dark"; toggle: () => void; prefs: Prefs; update: (p: Partial<Prefs>) => void; reset: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const [sysDark, setSysDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", h); return () => mq.removeEventListener("change", h);
  }, []);
  const dark = prefs.mode === "system" ? sysDark : prefs.mode === "dark";
  useEffect(() => {
    apply(prefs, dark);
    try { localStorage.setItem("theme.prefs", JSON.stringify(prefs)); localStorage.setItem("theme", prefs.mode); } catch { /* ignore */ }
  }, [prefs, dark]);
  const value = useMemo(() => ({
    theme: (dark ? "dark" : "light") as "light" | "dark",
    toggle: () => setPrefs((p) => ({ ...p, mode: dark ? "light" : "dark" })),
    prefs, update: (p: Partial<Prefs>) => setPrefs((x) => ({ ...x, ...p })), reset: () => setPrefs(DEFAULTS),
  }), [prefs, dark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("ThemeProvider missing");
  return c;
}
