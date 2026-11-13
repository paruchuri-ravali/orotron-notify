import type { Branding } from "./types";

const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s ?? "");
const hex = (s: string, fallback: string) => (isHex(s) ? s : fallback);
export const safeUrl = (s: string) => (/^https:\/\/[^\s"'<>]+$/.test(s ?? "") ? s : "");
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const fonts = { system: "-apple-system,Segoe UI,Roboto,Arial,sans-serif", serif: "Georgia,'Times New Roman',serif", mono: "ui-monospace,Menlo,Consolas,monospace" };
const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (bg: string) => (lum(bg) > 0.45 ? "#111827" : "#ffffff");

export const defaultBranding: Branding = {
  logo_url: "", brand_color: "#4f46e5", accent_color: "#0e9f8e", sender_name: "", font: "system", preset: "classic",
  header_style: "bar", header_bg: "", tagline: "", show_stripe: true,
  width: 600, page_bg: "#f4f5f7", card_bg: "#ffffff", text_color: "#222222", link_color: "", radius: 0, font_size: 15,
  button_style: "solid", button_radius: 8, pre_footer_text: "",
  footer_text: "You are receiving this email because you have an account with us.", postal_address: "", footer_bg: "#ffffff", footer_text_color: "#6b7280",
  social_links: [], show_unsubscribe: true, unsubscribe_text: "Unsubscribe",
};

export const PRESETS: { id: Branding["preset"]; name: string; desc: string; apply: Partial<Branding> }[] = [
  { id: "classic", name: "Classic", desc: "Colored header bar, accent stripe, clean white card.", apply: { header_style: "bar", show_stripe: true, radius: 0, page_bg: "#f4f5f7", card_bg: "#ffffff", footer_bg: "#ffffff", footer_text_color: "#6b7280", button_style: "solid", button_radius: 8, width: 600 } },
  { id: "minimal", name: "Minimal", desc: "Light header, no stripe, outline buttons. Calm and simple.", apply: { header_style: "minimal", show_stripe: false, radius: 0, page_bg: "#ffffff", card_bg: "#ffffff", footer_bg: "#ffffff", footer_text_color: "#6b7280", button_style: "outline", button_radius: 4, width: 560 } },
  { id: "bold", name: "Bold", desc: "Centered brand header, rounded card, dark footer, pill buttons.", apply: { header_style: "centered", show_stripe: true, radius: 16, page_bg: "#eceef3", card_bg: "#ffffff", footer_bg: "#111827", footer_text_color: "#d1d5db", button_style: "solid", button_radius: 999, width: 620 } },
  { id: "modern", name: "Modern", desc: "Soft tinted background, rounded card, friendly buttons.", apply: { header_style: "bar", show_stripe: false, radius: 14, page_bg: "#eef0ff", card_bg: "#ffffff", footer_bg: "#eef0ff", footer_text_color: "#55607a", button_style: "solid", button_radius: 10, width: 600 } },
];
export const applyPreset = (b: Branding, id: Branding["preset"]): Branding => ({ ...b, ...PRESETS.find((p) => p.id === id)!.apply, preset: id });

/**
 * PREVIEW ONLY. Wraps an email body in the project's branded layout so admins can see the effect.
 * The real rendering will be done by the backend with the same settings. Every value is validated/escaped here.
 */
export function brandedEmail(input: Partial<Branding>, bodyHtml: string): string {
  const b = { ...defaultBranding, ...input };
  const c = hex(b.brand_color, "#4f46e5"), a = hex(b.accent_color, "#0e9f8e");
  const headBg = hex(b.header_bg, c), headFg = contrast(headBg);
  const page = hex(b.page_bg, "#f4f5f7"), card = hex(b.card_bg, "#ffffff"), text = hex(b.text_color, "#222222"), link = hex(b.link_color, c);
  const foot = hex(b.footer_bg, "#ffffff"), footFg = hex(b.footer_text_color, "#6b7280");
  const W = clamp(b.width, 420, 760), R = clamp(b.radius, 0, 28), fs = clamp(b.font_size, 12, 19), BR = clamp(b.button_radius, 0, 999);
  const logo = safeUrl(b.logo_url);
  const name = esc(b.sender_name || "Your brand");
  const brandMark = logo ? `<img src="${esc(logo)}" alt="${name}" style="max-height:38px;vertical-align:middle">` : `<span style="font-weight:700;font-size:19px">${name}</span>`;
  const tag = b.tagline ? `<div style="font-size:12px;opacity:.8;margin-top:4px">${esc(b.tagline)}</div>` : "";
  const header =
    b.header_style === "centered" ? `<div style="background:${headBg};color:${headFg};padding:30px 28px;text-align:center">${brandMark}${tag}</div>`
    : b.header_style === "minimal" ? `<div style="background:${card};color:${c};padding:22px 28px 14px;border-bottom:1px solid #e5e7eb">${brandMark}${tag}</div>`
    : `<div style="background:${headBg};color:${headFg};padding:20px 28px">${brandMark}${tag}</div>`;
  const stripe = b.show_stripe ? `<div style="height:3px;background:${a}"></div>` : "";
  const btn = b.button_style === "outline"
    ? `background:transparent!important;color:${c}!important;border:2px solid ${c}!important;padding:9px 20px!important`
    : `background:${c}!important;color:${contrast(c)}!important;border:2px solid ${c}!important`;
  const social = (b.social_links ?? []).filter((s) => safeUrl(s.url) && s.label).slice(0, 4)
    .map((s) => `<a href="${esc(safeUrl(s.url))}" style="color:${footFg};margin:0 8px;text-decoration:underline">${esc(s.label)}</a>`).join("");
  const pre = b.pre_footer_text ? `<div style="padding:16px 28px;border-top:3px solid ${a};background:${page};text-align:center;font-size:13px;color:${text}">${esc(b.pre_footer_text)}</div>` : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
  body{margin:0;background:${page};font-family:${fonts[b.font] ?? fonts.system}}
  .card a:not([style*="inline-block"]){color:${link}}
  .card a[style*="inline-block"]{${btn};border-radius:${BR}px!important;text-decoration:none!important;display:inline-block!important}
  img{max-width:100%}
</style></head><body><div style="padding:${R ? 20 : 0}px 12px"><div class="card" style="max-width:${W}px;margin:0 auto;background:${card};border-radius:${R}px;overflow:hidden">
  ${header}${stripe}
  <div style="padding:28px;color:${text};font-size:${fs}px;line-height:1.6">${bodyHtml}</div>
  ${pre}
  <div style="padding:20px 28px;background:${foot};color:${footFg};font-size:12px;line-height:1.6;text-align:center">
    <div>${esc(b.footer_text)}</div>${b.postal_address ? `<div style="margin-top:6px">${esc(b.postal_address)}</div>` : ""}
    ${social ? `<div style="margin-top:10px">${social}</div>` : ""}
    ${b.show_unsubscribe ? `<div style="margin-top:10px"><a href="#" style="color:${footFg};text-decoration:underline">${esc(b.unsubscribe_text || "Unsubscribe")}</a></div>` : ""}
  </div></div></div></body></html>`;
}
