/**
 * DEV-ONLY in-browser mock of the *planned* NosActa/Orotron Notify API.
 * Active only when VITE_USE_MOCK=true. All data here is synthetic DEMO data and the UI
 * shows a permanent banner while it is active. It exists so the frontend can be built and
 * reviewed before the backend exists. It is NOT real platform data.
 */
import type {
  Analytics, ApiKey, AuditChange, Sender, AuditLog, Branding, ChannelContent, Category, Channel, ChannelInfo, DeadLetter, Delivery, EnvKind, Environment, Member,
  Me, NStatus, Notification, Org, Role, TemplateVersion, GalleryItem, Overview, Project, ProviderConfig, QueueStat, Schedule, SearchHit,
  SecurityEvent, Template, WebhookDelivery, WebhookSub, Workflow,
} from "../lib/types";
import { ApiError } from "../lib/api";
import { applyPreset, defaultBranding } from "../lib/branding";
import { isFreeMail, PROVIDER_SPECS } from "../lib/providers";
import { DEFAULT_MATRIX, PERM_DEFS, type Perm } from "../lib/permissions";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(42);
const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const DAY = 86400000;
let uid = 1000;
const id = (p: string) => `${p}_${(++uid).toString(36)}${Math.floor(r() * 1e4).toString(36)}`;

const ROLE_KEY = "mock.role";
const getRole = (): Role | null => { try { return (localStorage.getItem(ROLE_KEY) as Role | null) || null; } catch { return null; } };
const roleUsers: Record<string, Me> = {
  org_admin: { id: "usr_1", email: "admin@demo.local", name: "Demo Admin", role: "org_admin", org_id: "org_1" },
  project_admin: { id: "usr_3", email: "lead@demo.local", name: "Mia Manager", role: "project_admin", org_id: "org_1" },
  developer: { id: "usr_2", email: "dev1@demo.local", name: "Dev One", role: "developer", org_id: "org_1" },
  client: { id: "usr_9", email: "owner@clinic.demo", name: "Demo Clinic Owner", role: "client", org_id: "org_1" },
};
// Project isolation per role (simulates what the backend must enforce). null = all projects.
const scopeByRole: Record<string, string[] | null> = { org_admin: null, project_admin: ["prj_1", "prj_2"], developer: ["prj_1"], client: ["prj_2"] };
const allowed = (): string[] | null => scopeByRole[getRole() ?? "org_admin"] ?? null;
const me: Me = roleUsers.org_admin;
const orgs: Org[] = [{ id: "org_1", name: "Demo Organization", slug: "demo-org" }];

const projects: Project[] = [
  { id: "prj_1", org_id: "org_1", name: "Demo Storefront", slug: "demo-storefront", description: "Sample e-commerce app (demo)", status: "active", created_at: ago(90 * DAY), limits: { daily_quota: 50000, rate_per_minute: 600 } },
  { id: "prj_2", org_id: "org_1", name: "Demo Clinic", slug: "demo-clinic", description: "Sample appointments app (demo)", status: "active", created_at: ago(60 * DAY), limits: { daily_quota: 20000, rate_per_minute: 300 } },
  { id: "prj_3", org_id: "org_1", name: "Demo HR Portal", slug: "demo-hr", description: "Sample HR tool (demo)", status: "active", created_at: ago(30 * DAY), limits: { daily_quota: 10000, rate_per_minute: 120 } },
  { id: "prj_4", org_id: "org_1", name: "Demo Legacy", slug: "demo-legacy", description: "Archived sample", status: "archived", created_at: ago(200 * DAY), limits: { daily_quota: 1000, rate_per_minute: 60 } },
];
const kinds: EnvKind[] = ["dev", "staging", "prod"];
const envs: Environment[] = projects.flatMap((p) => kinds.map((k) => ({ id: `env_${p.id}_${k}`, project_id: p.id, kind: k })));
const keys: ApiKey[] = envs.filter((e) => e.project_id !== "prj_4").map((e) => ({
  id: `key_${e.id}`, environment_id: e.id, name: `${e.kind} server key`, prefix: `nan_${e.kind}_${e.id.slice(-4)}`,
  status: "active", created_at: ago(40 * DAY), last_used_at: ago(Math.floor(r() * 3 * 3600000)),
}));
const members: Member[] = [
  { user_id: "usr_1", name: "Demo Admin", email: "admin@demo.local", role: "org_admin", project_id: null },
  { user_id: "usr_2", name: "Dev One", email: "dev1@demo.local", role: "developer", project_id: "prj_1" },
  { user_id: "usr_3", name: "Project Lead", email: "lead@demo.local", role: "project_admin", project_id: "prj_1" },
  { user_id: "usr_4", name: "Viewer", email: "viewer@demo.local", role: "viewer", project_id: "prj_2" },
];

const brandings: Record<string, Branding> = {};
// Seeded demo themes so each project's branding visibly differs.
setTimeout(() => {
  brandings.prj_2 = { ...applyPreset(defaultBrand("prj_2"), "bold"), tagline: "Fresh, fast, local", brand_color: "#0d9488", accent_color: "#f59e0b" };
  brandings.prj_3 = { ...defaultBrand("prj_3"), brand_color: "#d97706", accent_color: "#334155" };
}, 0);
const defaultBrand = (pid: string): Branding => ({ ...defaultBranding, sender_name: projects.find((p) => p.id === pid)?.name ?? "" });

const templateKeys = ["password-reset", "order-confirmation", "appointment-reminder", "leave-approved", "weekly-summary", "promo-launch"];
const cats: Category[] = ["transactional", "business", "operational", "marketing", "scheduled", "event"];
const errs = [["provider_rate_limited", "Provider returned 429"], ["mailbox_not_found", "Recipient mailbox does not exist"], ["template_not_approved", "WhatsApp template not approved"], ["timeout", "Provider timed out after 10s"], ["outside_session_window", "24h WhatsApp session window closed"]];
const emailProviders = ["resend", "aws_ses"];

function mask(email: boolean, n: number) {
  return email ? `u${n % 97}***@example.com` : `+91 98*** **${String(n % 100).padStart(2, "0")}`;
}

const notifications: Notification[] = Array.from({ length: 700 }, (_, i) => {
  const proj = pick(["prj_1", "prj_1", "prj_2", "prj_3"]);
  const env: EnvKind = r() < 0.75 ? "prod" : pick(["dev", "staging"]);
  const channel: Channel = r() < 0.7 ? "email" : "whatsapp";
  const rr = r();
  const status: NStatus = rr < 0.62 ? "delivered" : rr < 0.7 ? "read" : rr < 0.78 ? "sent" : rr < 0.85 ? "queued" : rr < 0.88 ? "scheduled" : rr < 0.95 ? "failed" : rr < 0.97 ? "expired" : "cancelled";
  const created = ago(Math.floor(r() * 30 * DAY));
  const attemptsN = status === "failed" ? 3 : r() < 0.15 ? 2 : 1;
  const provider = channel === "email" ? pick(emailProviders) : "meta_cloud_api";
  const attempts = Array.from({ length: attemptsN }, (_, k) => {
    const failed = status === "failed" || k < attemptsN - 1;
    const [code, msg] = pick(errs);
    return {
      id: id("att"), attempt_no: k + 1, provider, status: failed ? ("failed" as const) : ("success" as const),
      error_code: failed ? code : null, error_message: failed ? msg : null, latency_ms: 80 + Math.floor(r() * 900),
      provider_response: failed ? { status: 429, error: code } : { status: 200, message_id: `pm_${i}` },
      at: new Date(new Date(created).getTime() + (k + 1) * 4000 * (k + 1)).toISOString(),
    };
  });
  const delivery: Delivery = { id: id("dlv"), channel, provider, status, attempts, provider_message_id: status === "queued" || status === "scheduled" ? null : `pm_${i}` };
  return {
    id: `ntf_${(5000 + i).toString(36)}${i}`, project_id: proj, environment_id: `env_${proj}_${env}`, env,
    category: pick(cats), priority: pick<Notification["priority"]>(["critical", "high", "normal", "normal", "low"]), status, channels: [channel],
    recipient: mask(channel === "email", i), template_key: pick(templateKeys), created_at: created,
    send_at: status === "scheduled" ? new Date(Date.now() + 3600000 * (1 + (i % 20))).toISOString() : null,
    idempotency_key: r() < 0.6 ? `idem-${i}` : null, deliveries: [delivery],
    retryable: status === "failed", cancellable: status === "scheduled" || status === "queued",
  };
}).sort((a, b) => b.created_at.localeCompare(a.created_at));

function withDetail(n: Notification): Notification {
  const d = n.deliveries![0];
  const t = new Date(n.created_at).getTime();
  const timeline = [{ type: "accepted", at: n.created_at }, { type: "queued", at: new Date(t + 400).toISOString() }];
  for (const a of d.attempts) timeline.push({ type: a.status === "success" ? "sent" : "attempt_failed", at: a.at, ...(a.error_code ? { detail: a.error_code } : {}) } as never);
  if (n.status === "delivered" || n.status === "read") timeline.push({ type: "delivered", at: new Date(t + 9000).toISOString() });
  if (n.status === "read") timeline.push({ type: "read", at: new Date(t + 60000).toISOString() });
  if (n.status === "failed") timeline.push({ type: "failed", at: new Date(t + 20000).toISOString() });
  return { ...n, timeline, webhook_events: n.status === "queued" ? [] : [{ id: id("evt"), type: `notification.${n.status}`, status_code: n.status === "failed" ? 500 : 200, at: new Date(t + 10000).toISOString() }] };
}

const mkProv = (channel: Channel, provider: string, name: string, priority: number, health: ProviderConfig["health"], sent: number): ProviderConfig => ({
  id: id("prv"), channel, provider, name, enabled: true, priority, secret_hint: "••••••••a3f9", health,
  stats: { sent, delivered: Math.round(sent * (health === "degraded" ? 0.93 : 0.985)), failed: Math.round(sent * (health === "degraded" ? 0.07 : 0.015)), p95_latency_ms: health === "degraded" ? 2400 : 640 },
  last_tested_at: ago(2 * DAY),
});
const providers: ProviderConfig[] = [
  mkProv("email", "resend", "Resend (primary)", 1, "healthy", 6120),
  mkProv("email", "aws_ses", "AWS SES (fallback)", 2, "degraded", 1380),
  mkProv("whatsapp", "meta_cloud_api", "Meta WhatsApp Cloud API", 1, "healthy", 2210),
];
providers[0].config = {}; providers[1].config = { region: "ap-south-1", access_key_id: "AKIA••••••••••••WXYZ" };
providers[2].config = { phone_number_id: "109012345678901", waba_id: "204512345678901", webhook_verify_token: "vt_demo_9f3a1c" };
const senders: Sender[] = [
  { id: "snd_1", email: "no-reply@demo-storefront.example", name: "Demo Storefront", provider: "resend", status: "verified", is_default: true, created_at: ago(60 * DAY), verified_at: ago(59 * DAY) },
  { id: "snd_2", email: "care@demo-clinic.example", name: "Demo Clinic", provider: "resend", status: "verified", is_default: false, created_at: ago(40 * DAY), verified_at: ago(40 * DAY) },
  { id: "snd_3", email: "billing@demo-storefront.example", name: "Demo Storefront Billing", provider: "resend", status: "pending", is_default: false, created_at: ago(1 * DAY), verified_at: null },
];
/** Validates credential fields against the provider's spec. Secrets are write-only: never echoed back. */
const checkCreds = (provider: string, config: Record<string, string> = {}, secrets: Record<string, string> = {}, partial = false) => {
  const spec = PROVIDER_SPECS[provider]; if (!spec) return;
  for (const f of spec.fields) {
    const v = String((f.secret ? secrets : config)[f.key] ?? "").trim();
    if (!v && partial && f.secret) continue;
    if (!v || !f.test(v)) throw new ApiError(422, "invalid_request", `${f.label}: ${v ? f.error : "required"}`, "req_mock");
  }
};
const catalog: Record<Channel, ChannelInfo["catalog"]> = {
  email: [{ key: "resend", name: "Resend", notes: "Supports idempotency keys. Verify sending domain (DKIM/SPF)." }, { key: "aws_ses", name: "AWS SES", notes: "Sandbox until production access is granted. Bounce/complaint webhooks via SNS." }, { key: "brevo", name: "Brevo", notes: "No idempotency key; duplicate window on crash." }],
  whatsapp: [{ key: "meta_cloud_api", name: "Meta WhatsApp Cloud API", notes: "Approved templates required outside 24h window. Business verification needed." }, { key: "twilio_whatsapp", name: "Twilio WhatsApp", notes: "Fallback BSP; adds per-message markup." }],
  sms: [], push: [], in_app: [],
};

const RESET_EMAIL = `<h2 style="margin:0 0 12px;font-size:20px">Reset your password</h2>
<p>Hi {{name}},</p>
<p>We received a request to reset the password for your {{app_name}} account. Click the button below to choose a new one. This link expires in {{expires_in}}.</p>
<p style="margin:24px 0"><a href="{{link}}" style="display:inline-block;padding:11px 22px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="color:#6b7280;font-size:13px">If the button doesn't work, copy and paste this link into your browser:<br>{{link}}</p>
<p style="color:#6b7280;font-size:13px">Didn't request this? You can safely ignore this email. Your password will not change.</p>`;
const contentFor = (k: string, v: number, i: number): TemplateVersion["content"] =>
  i === 0
    ? { email: { subject: "Reset your {{app_name}} password", body: RESET_EMAIL }, whatsapp: { body: "{{app_name}}: use this link to reset your password (valid for {{expires_in}}): {{link}}\nIf you did not request this, ignore this message." } }
    : { email: { subject: `${k} v${v + 1} for {{name}}`, body: `<p>Hi {{name}},</p><p>Your link: <a href="{{link}}">{{link}}</a></p><p>Order {{order_id}}</p>` }, ...(i % 2 ? { whatsapp: { body: "Hi {{name}}, your order {{order_id}} is confirmed." } } : {}) };

const btn = (href: string, label: string) => `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;padding:11px 22px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;
const gallery: GalleryItem[] = [
  { id: "g_reset", key: "password-reset", name: "Password reset", category: "Security", description: "Reset link with expiry and a safety note.", channels: ["email", "whatsapp"], content: contentFor("password-reset", 0, 0), sample_data: { name: "Alex", app_name: "Your App", link: "https://example.com/reset/abc123", expires_in: "30 minutes" } },
  { id: "g_otp", key: "otp-code", name: "One-time passcode (OTP)", category: "Security", description: "Short verification code that expires quickly.", channels: ["email", "whatsapp"], sample_data: { name: "Alex", app_name: "Your App", code: "482913", expires_in: "10 minutes" },
    content: { email: { subject: "Your {{app_name}} verification code", body: "<h2 style=\"margin:0 0 12px\">Your verification code</h2><p>Hi {{name}}, use this code to continue:</p><p style=\"font-size:32px;letter-spacing:8px;font-weight:700;margin:20px 0\">{{code}}</p><p style=\"color:#6b7280;font-size:13px\">It expires in {{expires_in}}. Never share this code with anyone.</p>" }, whatsapp: { body: "{{code}} is your {{app_name}} verification code. It expires in {{expires_in}}. Do not share it with anyone." } } },
  { id: "g_welcome", key: "welcome", name: "Welcome email", category: "Onboarding", description: "Greets a new user with a call to action.", channels: ["email"], sample_data: { name: "Alex", app_name: "Your App", link: "https://example.com/start" },
    content: { email: { subject: "Welcome to {{app_name}}, {{name}}!", body: `<h2 style="margin:0 0 12px">Welcome aboard \u{1F44B}</h2><p>Hi {{name}}, we are glad you joined {{app_name}}. Here is where to start:</p>${btn("{{link}}", "Get started")}<p style="color:#6b7280;font-size:13px">Questions? Just reply to this email.</p>` } } },
  { id: "g_order", key: "order-confirmation", name: "Order confirmation", category: "Transactional", description: "Confirms an order with its number and total.", channels: ["email", "whatsapp"], sample_data: { name: "Alex", order_id: "A-1042", total: "$48.00", link: "https://example.com/orders/A-1042" },
    content: { email: { subject: "Order {{order_id}} confirmed", body: `<h2 style="margin:0 0 12px">Thanks for your order</h2><p>Hi {{name}}, your order <strong>{{order_id}}</strong> totalling <strong>{{total}}</strong> is confirmed.</p>${btn("{{link}}", "View order")}` }, whatsapp: { body: "Hi {{name}}, your order {{order_id}} ({{total}}) is confirmed. Track it here: {{link}}" } } },
  { id: "g_appt", key: "appointment-reminder", name: "Appointment reminder", category: "Reminders", description: "Reminds a customer of an upcoming appointment.", channels: ["email", "whatsapp"], sample_data: { name: "Alex", date: "Fri 14 Nov", time: "10:30 AM", place: "Main Street Clinic" },
    content: { email: { subject: "Reminder: your appointment on {{date}}", body: "<h2 style=\"margin:0 0 12px\">Appointment reminder</h2><p>Hi {{name}}, this is a reminder of your appointment on <strong>{{date}}</strong> at <strong>{{time}}</strong>, {{place}}.</p>" }, whatsapp: { body: "Hi {{name}}, reminder: your appointment is on {{date}} at {{time}}, {{place}}. Reply 1 to confirm." } } },
];
const varsOf = (content: unknown) => [...new Set([...JSON.stringify(content).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((x) => x[1]))];
const renderContent = (content: Record<string, ChannelContent>, data: Record<string, string> = {}) => {
  const render = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => data[k] ?? `⟨missing: ${k}⟩`);
  return Object.fromEntries(Object.entries(content).map(([ch, v]) => [ch, { ...v, subject: v.subject ? render(v.subject) : undefined, body: render(v.body), header: v.header ? render(v.header) : undefined, footer: v.footer ? render(v.footer) : undefined }]));
};

const templates: Template[] = templateKeys.map((k, i) => ({
  id: `tpl_${i + 1}`, key: k, name: k.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()), scope: i === 5 || i === 0 ? "organization" : "project",
  project_id: i === 5 || i === 0 ? null : i % 3 === 2 ? "prj_2" : "prj_1", status: "active", channels: i % 2 || i === 0 ? ["email", "whatsapp"] : ["email"], latest_version: 2 + (i % 3), updated_at: ago(i * DAY),
  sample_data: (i === 0 ? { name: "Alex", app_name: "Demo Storefront", link: "https://example.com/reset/abc123", expires_in: "30 minutes" } : { name: "Alex", link: "https://example.com/reset/abc", order_id: "A-1042" }) as Record<string, string>,
  versions: Array.from({ length: 2 + (i % 3) }, (_, v) => ({
    version: v + 1, status: v === 1 + (i % 3) ? "published" : "published", created_at: ago((5 - v) * DAY), author: "Dev One",
    content: contentFor(k, v, i),
    variables: i === 0 ? ["name", "app_name", "link", "expires_in"] : ["name", "link", "order_id"],
  })) as Template["versions"],
}));

{
  // One project (Demo Clinic) keeps its own edited copy of the shared password-reset template.
  const base = templates[0]; const last = base.versions![base.versions!.length - 1];
  templates.push({ ...base, id: "tpl_ovr1", name: "Password reset (Demo Clinic)", scope: "project", project_id: "prj_2", latest_version: 1, versions: [{ ...last, version: 1, content: { email: { subject: "Reset your Demo Clinic password", body: RESET_EMAIL.replace("Reset your password", "Reset your patient portal password") }, ...(last.content.whatsapp ? { whatsapp: last.content.whatsapp } : {}) } }] });
}
const workflows: Workflow[] = [
  { id: "wf_1", name: "Order placed → confirmation", trigger_event: "order.created", active: true, category: "transactional", conditions: "order.total > 0", steps: ["whatsapp (template order-confirmation)", "fallback email after 2m"], version: 3, updated_at: ago(3 * DAY) },
  { id: "wf_2", name: "Appointment reminder", trigger_event: "appointment.upcoming", active: true, category: "business", conditions: "hours_until <= 24", steps: ["whatsapp reminder", "email reminder"], version: 1, updated_at: ago(10 * DAY) },
  { id: "wf_3", name: "Failed payment escalation", trigger_event: "payment.failed", active: false, category: "critical", conditions: "attempt >= 2", steps: ["email", "whatsapp after 10m"], version: 2, updated_at: ago(20 * DAY) },
];
let schedules: Schedule[] = [
  { id: "sch_1", template_key: "weekly-summary", recipient: "team-list", channel: "email", timezone: "Asia/Kolkata", kind: "recurring", rule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9", next_run_at: new Date(Date.now() + 2 * DAY).toISOString(), status: "scheduled", last_run_status: "ok" },
  { id: "sch_2", template_key: "promo-launch", recipient: "segment:vip", channel: "whatsapp", timezone: "Australia/Sydney", kind: "one_off", rule: "once", next_run_at: new Date(Date.now() + 5 * 3600000).toISOString(), status: "scheduled", last_run_status: null },
  { id: "sch_3", template_key: "appointment-reminder", recipient: "u12***@example.com", channel: "email", timezone: "Europe/London", kind: "one_off", rule: "once", next_run_at: null, status: "completed", last_run_status: "ok" },
];
const webhooks: WebhookSub[] = [
  { id: "whk_1", url: "https://example.com/hooks/notify", events: ["notification.delivered", "notification.failed"], status: "active", secret_hint: "whsec_•••• 7d2c" },
  { id: "whk_2", url: "https://staging.example.com/hooks", events: ["notification.*"], status: "disabled", secret_hint: "whsec_•••• 91ab" },
];
const webhookDeliveries: WebhookDelivery[] = Array.from({ length: 40 }, (_, i) => {
  const ok = r() > 0.15;
  return { id: `whd_${i}`, subscription_id: pick(["whk_1", "whk_2"]), event: pick(["notification.delivered", "notification.failed", "notification.sent"]), attempt: ok ? 1 : 1 + Math.floor(r() * 4), status_code: ok ? 200 : pick([500, 502, 408, null as unknown as number]), ok, at: ago(i * 3600000 * 2), next_retry_at: ok ? null : new Date(Date.now() + 600000).toISOString() };
});
const deadLetters: DeadLetter[] = Array.from({ length: 6 }, (_, i) => ({ id: `dlq_${i}`, notification_id: notifications.filter((n) => n.status === "failed")[i]?.id ?? "ntf_unknown", queue: i % 2 ? "standard" : "critical", reason: pick(errs)[0], failed_at: ago((i + 1) * 5 * 3600000), attempts: 5 }));
const queues: QueueStat[] = [
  { queue: "critical", depth: 0, oldest_age_s: 0, in_flight: 1, dlq: 1 }, { queue: "standard", depth: 14, oldest_age_s: 6, in_flight: 5, dlq: 3 },
  { queue: "bulk", depth: 230, oldest_age_s: 95, in_flight: 20, dlq: 0 }, { queue: "retry", depth: 9, oldest_age_s: 41, in_flight: 2, dlq: 2 },
];
const WHO: Record<string, { name: string; role: Role }> = { "admin@demo.local": { name: "Demo Admin", role: "org_admin" }, "lead@demo.local": { name: "Mia Manager", role: "project_admin" }, "dev1@demo.local": { name: "Dev One", role: "developer" }, "owner@clinic.demo": { name: "Demo Clinic Owner", role: "client" } };
const audit: AuditLog[] = Array.from({ length: 30 }, (_, i) => {
  const email = pick(Object.keys(WHO)); const action = pick(["api_key.created", "api_key.rotated", "template.published", "member.added", "project.updated", "branding.updated"]);
  const pid = pick(["prj_1", "prj_2"]);
  return { id: `aud_${i}`, actor: email, actor_name: WHO[email].name, actor_role: WHO[email].role, action, target: action.startsWith("api_key") ? pick(["Prod key (prod)", "Dev key (dev)"]) : action.startsWith("template") ? pick(["password-reset v3", "order-confirmation v2"]) : action === "member.added" ? pick(["new.dev@demo.local", "ops@demo.local"]) : pid === "prj_1" ? "Demo Storefront" : "Demo Clinic", project_id: pid, project_name: pid === "prj_1" ? "Demo Storefront" : "Demo Clinic", ip: `203.0.113.${10 + (i % 50)}`, at: ago((i + 1) * 2.5 * 3600000),
    changes: action === "branding.updated" ? [{ field: "brand_color", from: "#4f46e5", to: "#0d9488" }, { field: "tagline", from: "", to: "Fresh, fast, local" }] : action === "member.added" ? [{ field: "role", from: "", to: "developer" }] : undefined };
});
const fmtv = (v: unknown) => { const t = v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v); return t.length > 90 ? t.slice(0, 87) + "…" : t; };
const diff = (a: Record<string, unknown>, b: Record<string, unknown>): AuditChange[] => Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => ({ field: k, from: fmtv(a[k]), to: fmtv(b[k]) }));
const curUser = () => roleUsers[getRole() ?? "org_admin"] ?? me;
/** Append-only: entries are only ever added, never edited or removed. */
const logAudit = (action: string, target: string, o: { project_id?: string; changes?: AuditChange[] } = {}) => {
  const u = curUser();
  audit.unshift({ id: id("aud"), at: new Date().toISOString(), actor: u.email, actor_name: u.name, actor_role: u.role, action, target, project_id: o.project_id, project_name: projects.find((x) => x.id === o.project_id)?.name, ip: "203.0.113.7", changes: o.changes?.length ? o.changes : undefined });
};
let permMatrix: Record<Perm, Role[]> = JSON.parse(JSON.stringify(DEFAULT_MATRIX));
const roleCan = (p: Perm) => { const r = getRole() ?? "org_admin"; return r === "org_admin" || (permMatrix[p] ?? []).includes(r); };
const forbid = (msg = "Your role is not allowed to do this") => new ApiError(403, "forbidden", msg, "req_mock");
const security: SecurityEvent[] = [
  { id: "sec_1", severity: "high", message: "API key used from new IP range (prj_1 prod)", at: ago(3600000) },
  { id: "sec_2", severity: "medium", message: "5 failed dashboard logins for lead@demo.local", at: ago(8 * 3600000) },
  { id: "sec_3", severity: "low", message: "Rate limit hit: prj_3 (120/min)", at: ago(26 * 3600000) },
];

// ---------- helpers ----------
function filt(q: Record<string, unknown>) {
  const al = allowed();
  const from = q.from ? new Date(String(q.from)).getTime() : 0;
  const to = q.to ? new Date(String(q.to)).getTime() + DAY : Infinity;
  return notifications.filter((n) => {
    const t = new Date(n.created_at).getTime();
    return (!al || al.includes(n.project_id)) && (!q.project || n.project_id === q.project) && (!q.env || n.env === q.env) && (!q.channel || n.channels.includes(q.channel as Channel))
      && (!q.status || n.status === q.status) && (!q.category || n.category === q.category) && t >= from && t <= to
      && (!q.q || n.id.includes(String(q.q)) || n.recipient.includes(String(q.q)));
  });
}
function paginate<T>(arr: T[], q: Record<string, unknown>) {
  const limit = Number(q.limit ?? 20); const start = Number(q.cursor ?? 0);
  const next = start + limit < arr.length ? String(start + limit) : null;
  return { data: arr.slice(start, start + limit), next_cursor: next, total: arr.length };
}
const dayKey = (iso: string) => iso.slice(0, 10);
const daysOf = (q: Record<string, unknown>) => (q.from ? Math.min(60, Math.max(1, Math.round((new Date(String(q.to ?? new Date().toISOString())).getTime() - new Date(String(q.from)).getTime()) / DAY) + 1)) : 14);
function seriesDays(list: Notification[], days = 14) {
  const m = new Map<string, { date: string; delivered: number; failed: number; pending: number; total: number }>();
  for (let i = days - 1; i >= 0; i--) { const d = dayKey(ago(i * DAY)); m.set(d, { date: d, delivered: 0, failed: 0, pending: 0, total: 0 }); }
  for (const n of list) {
    const row = m.get(dayKey(n.created_at)); if (!row) continue;
    row.total++;
    if (n.status === "delivered" || n.status === "read" || n.status === "sent") row.delivered++;
    else if (n.status === "failed" || n.status === "expired") row.failed++; else row.pending++;
  }
  return [...m.values()];
}
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const nf = (m: string) => new ApiError(404, "not_found", `${m} not found`, "req_mock");

export async function handle(method: string, path: string, q: Record<string, unknown>, body: unknown): Promise<unknown> {
  await delay(120 + Math.random() * 180);
  const b = (body ?? {}) as Record<string, any>;
  let m: RegExpMatchArray | null;

  if (path === "/internal/auth/demo-login") { try { localStorage.setItem(ROLE_KEY, String(b.role)); } catch { /* ignore */ } return { ok: true }; }
  if (path === "/internal/auth/logout") { try { localStorage.removeItem(ROLE_KEY); } catch { /* ignore */ } return { ok: true }; }
  if (path === "/internal/me") { const r = getRole(); if (!r) throw new ApiError(401, "unauthorized", "Not signed in", "req_mock"); return roleUsers[r] ?? me; }
  if (path === "/internal/auth/otp/request" || path === "/internal/auth/otp/verify") return { ok: true };
  if (path === "/internal/orgs") return orgs;

  if (path === "/internal/projects" && method === "GET") return projects.filter((p) => !allowed() || allowed()!.includes(p.id));
  if (path === "/internal/projects" && method === "POST") {
    const p: Project = { id: id("prj"), org_id: "org_1", name: b.name, slug: String(b.name).toLowerCase().replace(/\W+/g, "-"), description: b.description ?? "", status: "active", created_at: new Date().toISOString(), limits: { daily_quota: 10000, rate_per_minute: 120 } };
    logAudit("project.created", p.name, { project_id: p.id }); projects.push(p); for (const k of kinds) envs.push({ id: `env_${p.id}_${k}`, project_id: p.id, kind: k });
    return p;
  }
  if ((m = path.match(/^\/internal\/projects\/([^/]+)$/))) {
    const p = projects.find((x) => x.id === m![1]); if (!p) throw nf("Project");
    if (method === "PATCH") { const before = JSON.parse(JSON.stringify(p)); Object.assign(p, b, b.limits ? { limits: { ...p.limits, ...b.limits } } : {}); const ch = diff(before, JSON.parse(JSON.stringify(p))); logAudit(b.status && b.status !== before.status ? (b.status === "archived" ? "project.archived" : "project.restored") : "project.updated", p.name, { project_id: p.id, changes: ch }); return p; }
    return { ...p, environments: envs.filter((e) => e.project_id === p.id), members: members.filter((x) => x.project_id === p.id || x.project_id === null) };
  }
  if ((m = path.match(/^\/internal\/projects\/([^/]+)\/keys$/))) {
    const ev = envs.filter((e) => e.project_id === m![1]).map((e) => e.id);
    if (method === "POST") { const k: ApiKey = { id: id("key"), environment_id: b.environment_id, name: b.name, prefix: `nan_${b.environment_id.split("_").pop()}_${Math.random().toString(36).slice(2, 8)}`, status: "active", created_at: new Date().toISOString(), last_used_at: null }; keys.push(k); logAudit("api_key.created", `${k.name} (${k.environment_id.split("_").pop()})`, { project_id: m![1] }); return { ...k, secret: `${k.prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}` }; }
    return keys.filter((k) => ev.includes(k.environment_id));
  }
  if ((m = path.match(/^\/internal\/keys\/([^/]+)\/(rotate|revoke)$/))) {
    const k = keys.find((x) => x.id === m![1]); if (!k) throw nf("Key");
    const kp = envs.find((e) => e.id === k.environment_id)?.project_id;
    if (m[2] === "revoke") { k.status = "revoked"; logAudit("api_key.revoked", k.name, { project_id: kp, changes: [{ field: "status", from: "active", to: "revoked" }] }); return k; }
    k.status = "rotating"; logAudit("api_key.rotated", k.name, { project_id: kp });
    return { ...k, secret: `${k.prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}` };
  }
  if ((m = path.match(/^\/internal\/projects\/([^/]+)\/branding$/))) {
    if (!projects.some((p) => p.id === m![1])) throw nf("Project");
    const scope = allowed(); if (scope && !scope.includes(m[1])) throw new ApiError(403, "forbidden", "You do not have access to this project", "req_mock");
    if (method === "PUT") {
      for (const [k, v] of Object.entries(b)) if ((k.endsWith("_color") || k.endsWith("_bg")) && v && !/^#[0-9a-fA-F]{6}$/.test(String(v))) throw new ApiError(422, "invalid_request", `${k} must be a hex color like #4f46e5`, "req_mock");
      if (Array.isArray(b.social_links) && b.social_links.some((s: { url: string }) => !/^https:\/\//.test(s.url))) throw new ApiError(422, "invalid_request", "social link URLs must be https", "req_mock");
      if (b.logo_url && !/^https:\/\//.test(b.logo_url)) throw new ApiError(422, "invalid_request", "logo_url must be an https URL", "req_mock");
      const before = brandings[m[1]] ?? defaultBrand(m[1]);
      brandings[m[1]] = { ...defaultBrand(m[1]), ...b };
      logAudit("branding.updated", projects.find((x) => x.id === m![1])?.name ?? m[1], { project_id: m[1], changes: diff(before as unknown as Record<string, unknown>, brandings[m[1]] as unknown as Record<string, unknown>) });
    }
    return brandings[m[1]] ?? defaultBrand(m[1]);
  }
  if ((m = path.match(/^\/internal\/projects\/([^/]+)\/members$/)) && method === "POST") { if (!String(b.name ?? "").trim()) throw new ApiError(422, "invalid_request", "Name is required", "req_mock"); const mem: Member = { user_id: id("usr"), name: String(b.name).trim(), email: b.email, role: b.role, project_id: m[1] }; members.push(mem); logAudit("member.added", `${String(b.name).trim()} <${b.email}>`, { project_id: m[1], changes: [{ field: "role", from: "", to: b.role }] }); return mem; }

  if (path === "/internal/overview") {
    const list = filt(q);
    const cnt = (f: (n: Notification) => boolean) => list.filter(f).length;
    const delivered = cnt((n) => n.status === "delivered" || n.status === "read");
    const failed = cnt((n) => n.status === "failed" || n.status === "expired");
    const pending = cnt((n) => ["queued", "scheduled", "sending"].includes(n.status));
    const sent = list.length - pending - cnt((n) => n.status === "cancelled");
    const settled = delivered + failed;
    const o: Overview = {
      totals: { total: list.length, sent, delivered, failed, pending, success_pct: settled ? (delivered / settled) * 100 : 0 },
      active_projects: projects.filter((p) => p.status === "active" && (!allowed() || allowed()!.includes(p.id))).length,
      series: seriesDays(list, daysOf(q)), by_channel: ((["email", "whatsapp"]) as Channel[]).map((c) => ({ channel: c, count: list.filter((n) => n.channels.includes(c)).length })),
      provider_health: providers.map((p) => ({ provider: p.name, channel: p.channel, health: p.health, error_rate_pct: p.health === "degraded" ? 7 : 1.5 })),
      recent: list.slice(0, 8),
      alerts: [
        { id: "al_1", level: "warning", message: "AWS SES error rate above 5% in the last hour", at: ago(20 * 60000) },
        { id: "al_2", level: "info", message: `${deadLetters.length} messages in dead-letter queues`, at: ago(2 * 3600000) },
      ],
    };
    return o;
  }

  if (path === "/v1/notifications" && method === "GET") return paginate(filt(q), q);
  if (path === "/v1/notifications" && method === "POST") {
    const ch = (b.channels?.[0] ?? "email") as Channel; const tpl = templates.find((t) => t.key === b.template?.key);
    const proj = tpl?.project_id ?? allowed()?.[0] ?? "prj_1"; const env = (b.environment ?? "dev") as EnvKind;
    const raw = String(ch === "email" ? b.to?.email ?? "" : b.to?.phone ?? "");
    const n: Notification = {
      id: `ntf_${Date.now().toString(36)}`, project_id: proj, environment_id: `env_${proj}_${env}`, env, category: "transactional", priority: "normal", status: "queued", channels: [ch],
      recipient: ch === "email" ? raw.replace(/^(.).*@/, "$1***@") : `+** *** **${raw.slice(-2)}`, template_key: b.template?.key ?? "unknown", created_at: new Date().toISOString(), send_at: null, idempotency_key: null,
      deliveries: [{ id: id("dlv"), channel: ch, provider: ch === "email" ? "resend" : "meta_cloud_api", status: "queued", attempts: [], provider_message_id: null }], retryable: false, cancellable: true,
    };
    notifications.unshift(n); return { id: n.id, status: n.status };
  }
  if ((m = path.match(/^\/v1\/notifications\/([^/]+)$/))) { const n = notifications.find((x) => x.id === m![1]); if (!n || (allowed() && !allowed()!.includes(n.project_id))) throw nf("Notification"); return withDetail(n); }
  if ((m = path.match(/^\/v1\/notifications\/([^/]+)\/(retry|cancel)$/))) {
    const n = notifications.find((x) => x.id === m![1]); if (!n) throw nf("Notification");
    if (m[2] === "retry") { if (!n.retryable) throw new ApiError(409, "not_retryable", "Only failed notifications can be retried"); n.status = "queued"; n.retryable = false; n.cancellable = true; n.deliveries![0].status = "queued"; } else { if (!n.cancellable) throw new ApiError(409, "not_cancellable", "Notification can no longer be cancelled"); n.status = "cancelled"; n.cancellable = false; }
    return withDetail(n);
  }

  if ((m = path.match(/^\/internal\/channels\/([^/]+)$/))) {
    const ch = m[1] as Channel; const list = providers.filter((p) => p.channel === ch);
    return { channel: ch, status: ch === "email" || ch === "whatsapp" ? "available" : "pending", providers: list.sort((a, b) => a.priority - b.priority), catalog: catalog[ch], fallback_to: ch === "whatsapp" ? "email" : null } satisfies ChannelInfo;
  }
  if ((m = path.match(/^\/internal\/channels\/([^/]+)\/providers$/)) && method === "POST") {
    if (!roleCan("writeProviders")) throw forbid("Your role cannot change provider credentials");
    checkCreds(b.provider, b.config, b.secrets);
    const spec = PROVIDER_SPECS[b.provider]; const sec = spec?.fields.find((f) => f.secret); const last = String((b.secrets ?? {})[sec?.key ?? ""] ?? b.secret ?? "").slice(-4);
    const p = mkProv(m[1] as Channel, b.provider, b.name || spec?.name || b.provider, providers.filter((x) => x.channel === m![1]).length + 1, "unknown", 0);
    p.stats = { sent: 0, delivered: 0, failed: 0, p95_latency_ms: 0 }; p.last_tested_at = null; p.secret_hint = "••••••••" + last;
    p.config = { ...(b.config ?? {}), ...(b.provider === "meta_cloud_api" ? { webhook_verify_token: "vt_" + Math.random().toString(36).slice(2, 12) } : {}) };
    providers.push(p); logAudit("provider.added", `${p.name} (${p.channel})`, { changes: [{ field: "credentials", from: "", to: "stored encrypted (not shown)" }] }); return p;
  }
  if ((m = path.match(/^\/internal\/providers\/([^/]+)\/credentials$/)) && method === "POST") {
    if (!roleCan("writeProviders")) throw forbid("Your role cannot change provider credentials");
    const p = providers.find((x) => x.id === m![1]); if (!p) throw nf("Provider");
    checkCreds(p.provider, b.config, b.secrets, true);
    const sec = PROVIDER_SPECS[p.provider]?.fields.find((f) => f.secret); const nv = String((b.secrets ?? {})[sec?.key ?? ""] ?? "");
    if (nv) p.secret_hint = "••••••••" + nv.slice(-4);
    p.config = { ...(p.config ?? {}), ...(b.config ?? {}) }; p.health = "unknown"; p.last_tested_at = null;
    logAudit("provider.credentials_updated", p.name, { changes: [{ field: "credentials", from: p.secret_hint, to: nv ? "replaced (not shown)" : "settings updated" }] }); return p;
  }
  if (path === "/internal/senders" && method === "POST") {
    if (!roleCan("writeProviders")) throw forbid("Your role cannot manage sender emails");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email))) throw new ApiError(422, "invalid_request", "Enter a valid sender email", "req_mock");
    if (!String(b.name ?? "").trim()) throw new ApiError(422, "invalid_request", "Sender name is required", "req_mock");
    if (senders.some((x) => x.email.toLowerCase() === String(b.email).toLowerCase())) throw new ApiError(409, "conflict", "That sender already exists", "req_mock");
    const sd: Sender = { id: id("snd"), email: b.email, name: b.name.trim(), provider: b.provider, status: "pending", is_default: senders.length === 0, created_at: new Date().toISOString(), verified_at: null };
    senders.push(sd); logAudit("sender.added", `${sd.name} <${sd.email}>`); return sd;
  }
  if (path === "/internal/senders") return senders;
  if ((m = path.match(/^\/internal\/senders\/([^/]+)(\/verify)?$/))) {
    if (!roleCan("writeProviders")) throw forbid("Your role cannot manage sender emails");
    const sd = senders.find((x) => x.id === m![1]); if (!sd) throw nf("Sender");
    if (m[2]) {
      await delay(700);
      if (isFreeMail(sd.email)) { sd.status = "failed"; sd.message = `${sd.email.split("@")[1]} is a free mail domain. Providers cannot authenticate it (DMARC), so mail would be rejected or land in spam. Use an address on a domain you own.`; }
      else { sd.status = "verified"; sd.verified_at = new Date().toISOString(); sd.message = undefined; logAudit("sender.verified", sd.email); }
      return sd;
    }
    if (method === "PATCH") {
      if (b.is_default) { if (sd.status !== "verified") throw new ApiError(422, "invalid_request", "Only a verified sender can be the default", "req_mock"); senders.forEach((x) => { x.is_default = x === sd; }); logAudit("sender.default_changed", sd.email); }
      if (b.name) sd.name = b.name; return sd;
    }
    if (method === "DELETE") { senders.splice(senders.indexOf(sd), 1); if (sd.is_default && senders[0]) senders[0].is_default = senders[0].status === "verified"; logAudit("sender.removed", sd.email); return null; }
  }
  if ((m = path.match(/^\/internal\/providers\/([^/]+)(\/test)?$/))) {
    const p = providers.find((x) => x.id === m![1]); if (!p) throw nf("Provider");
    if (m[2]) { await delay(500); p.last_tested_at = new Date().toISOString(); p.health = p.health === "unknown" ? "healthy" : p.health; const warn = p.channel === "email" && !senders.some((x) => x.status === "verified") ? " Warning: no verified sender yet, so sends will be rejected." : ""; return { ok: true, latency_ms: 212, message: "Connection test succeeded (mock)." + warn }; }
    if (method === "PATCH") { Object.assign(p, b); return p; }
    if (method === "DELETE") { providers.splice(providers.indexOf(p), 1); return null; }
  }

  if (path === "/v1/templates" && method === "GET") { const l = templates.filter((t) => (!q.status || t.status === q.status) && (!q.q || t.key.includes(String(q.q))) && (!allowed() || !t.project_id || allowed()!.includes(t.project_id))); return paginate(l.map(({ versions: _v, ...t }) => t), q); }
  if ((m = path.match(/^\/v1\/templates\/([^/]+)\/usage$/))) {
    const t = templates.find((x) => x.id === m![1]); if (!t) throw nf("Template");
    return projects.filter((p) => p.status === "active" && (!allowed() || allowed()!.includes(p.id))).map((p) => {
      const ov = templates.find((x) => x.key === t.key && x.project_id === p.id && x.id !== t.id); const br = brandings[p.id] ?? defaultBrand(p.id);
      return { project_id: p.id, project_name: p.name, brand_color: br.brand_color, accent_color: br.accent_color, sender_name: br.sender_name, source: ov ? "override" : "inherited", override_id: ov?.id ?? null };
    });
  }
  if ((m = path.match(/^\/v1\/templates\/([^/]+)\/override$/)) && method === "POST") {
    const src = templates.find((x) => x.id === m![1]); if (!src) throw nf("Template");
    const proj = projects.find((p) => p.id === b.project_id); if (!proj) throw nf("Project");
    if (templates.some((x) => x.key === src.key && x.project_id === proj.id)) throw new ApiError(409, "conflict", `${proj.name} already has its own copy`, "req_mock");
    const last = src.versions![src.versions!.length - 1];
    const t: Template = { ...src, id: id("tpl"), name: `${src.name} (${proj.name})`, scope: "project", project_id: proj.id, latest_version: 1, updated_at: new Date().toISOString(), versions: [{ ...last, version: 1, created_at: new Date().toISOString() }] };
    logAudit("template.customized", t.name, { project_id: proj.id }); templates.unshift(t); return t;
  }
  if (path === "/v1/template-gallery") return gallery;
  if (path === "/v1/templates/preview" && method === "POST") return renderContent(b.content, b.data);
  if (path === "/v1/templates/from-gallery" && method === "POST") {
    const it = gallery.find((g) => g.id === b.gallery_id); if (!it) throw nf("Gallery template");
    if (templates.some((x) => x.key === b.key)) throw new ApiError(409, "conflict", `A template with key "${b.key}" already exists`, "req_mock");
    const t: Template = { id: id("tpl"), key: b.key, name: b.name, scope: "project", project_id: allowed()?.[0] ?? "prj_1", status: "active", channels: Object.keys(it.content) as Channel[], latest_version: 1, updated_at: new Date().toISOString(), sample_data: it.sample_data, versions: [{ version: 1, status: "published", created_at: new Date().toISOString(), author: (roleUsers[getRole() ?? "org_admin"] ?? me).name, content: it.content, variables: varsOf(it.content) }] };
    logAudit("template.created", `${t.name} (from gallery)`, { project_id: t.project_id ?? undefined }); templates.unshift(t); return t;
  }
  if ((m = path.match(/^\/v1\/templates\/([^/]+)\/duplicate$/)) && method === "POST") {
    const src = templates.find((x) => x.id === m![1]); if (!src) throw nf("Template");
    if (templates.some((x) => x.key === b.key)) throw new ApiError(409, "conflict", `A template with key "${b.key}" already exists`, "req_mock");
    const last = src.versions![src.versions!.length - 1];
    const t: Template = { ...src, id: id("tpl"), key: b.key, name: b.name, latest_version: 1, updated_at: new Date().toISOString(), versions: [{ ...last, version: 1, created_at: new Date().toISOString() }] };
    logAudit("template.duplicated", `${src.name} → ${t.name}`, { project_id: t.project_id ?? undefined }); templates.unshift(t); return t;
  }
  if (path === "/v1/templates" && method === "POST") { const t: Template = { id: id("tpl"), key: b.key, name: b.name, scope: b.scope ?? "project", project_id: "prj_1", status: "active", channels: ["email"], latest_version: 1, updated_at: new Date().toISOString(), sample_data: { name: "Alex" }, versions: [{ version: 1, status: "draft", created_at: new Date().toISOString(), author: me.name, content: { email: { subject: b.name, body: "<p>Hello {{name}}</p>" } }, variables: ["name"] }] }; templates.unshift(t); return t; }
  if ((m = path.match(/^\/v1\/templates\/([^/]+)$/))) {
    const t = templates.find((x) => x.id === m![1]); if (!t) throw nf("Template");
    if (method === "PATCH") { Object.assign(t, b); return t; }
    return t;
  }
  if ((m = path.match(/^\/v1\/templates\/([^/]+)\/versions$/)) && method === "POST") {
    const t = templates.find((x) => x.id === m![1]); if (!t) throw nf("Template");
    const vars = [...new Set([...JSON.stringify(b.content).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((x) => x[1]))];
    t.latest_version++; t.versions!.push({ version: t.latest_version, status: "published", created_at: new Date().toISOString(), author: me.name, content: b.content, variables: vars }); t.updated_at = new Date().toISOString(); t.channels = Object.keys(b.content) as Channel[]; logAudit("template.published", `${t.key} v${t.latest_version}`, { project_id: t.project_id ?? undefined }); return t;
  }
  if ((m = path.match(/^\/v1\/templates\/([^/]+)\/(preview|test)$/)) && method === "POST") {
    const render = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => b.data?.[k] ?? `⟨missing: ${k}⟩`);
    if (m[2] === "test") return { notification_id: id("ntf"), status: "queued" };
    void render; return renderContent(b.content, b.data);
  }

  if (path === "/internal/workflows") return workflows;
  if ((m = path.match(/^\/internal\/workflows\/([^/]+)$/)) && method === "PATCH") { const w = workflows.find((x) => x.id === m![1]); if (!w) throw nf("Workflow"); Object.assign(w, b); return w; }

  if (path === "/v1/schedules" && method === "GET") return schedules;
  if (path === "/v1/schedules" && method === "POST") { const s: Schedule = { id: id("sch"), template_key: b.template_key, recipient: b.recipient, channel: b.channel, timezone: b.timezone, kind: "one_off", rule: "once", next_run_at: new Date(b.local_time).toISOString(), status: "scheduled", last_run_status: null }; schedules.unshift(s); return s; }
  if ((m = path.match(/^\/v1\/schedules\/([^/]+)\/cancel$/))) { const s = schedules.find((x) => x.id === m![1]); if (!s) throw nf("Schedule"); if (s.status !== "scheduled") throw new ApiError(409, "not_cancellable", "Schedule can no longer be cancelled"); s.status = "cancelled"; s.next_run_at = null; return s; }

  if (path === "/v1/openapi.json") return { openapi: "3.1.0", info: { title: "Orotron Notify API (mock)", version: "0.0.0-demo" }, paths: { "/v1/notifications": {}, "/v1/templates": {}, "/v1/schedules": {}, "/v1/webhooks": {} } };
  if (path === "/v1/webhooks") return webhooks;
  if (path === "/internal/logs/queues") return queues;
  if (path === "/internal/logs/dead-letters") return deadLetters;
  if (path === "/internal/logs/webhook-deliveries") return paginate(webhookDeliveries, q);
  if (path === "/internal/logs/latency") return seriesDays(filt(q), daysOf(q)).map((d, i) => ({ date: d.date, p50: 420 + ((i * 37) % 120), p95: 1300 + ((i * 91) % 700) }));

  if (path === "/internal/analytics") {
    const list = filt(q); const settled = (l: Notification[]) => l.filter((n) => ["delivered", "read", "failed", "expired"].includes(n.status));
    const pct = (l: Notification[]) => { const s = settled(l); return s.length ? (s.filter((n) => n.status === "delivered" || n.status === "read").length / s.length) * 100 : 0; };
    const a: Analytics = {
      series: seriesDays(list, daysOf(q)).map((d) => ({ date: d.date, total: d.total, delivered: d.delivered, failed: d.failed })),
      by_channel: (["email", "whatsapp"] as Channel[]).map((c) => { const l = list.filter((n) => n.channels.includes(c)); return { channel: c, count: l.length, success_pct: pct(l) }; }),
      by_project: projects.filter((p) => p.status === "active" && (!allowed() || allowed()!.includes(p.id))).map((p) => ({ project: p.name, count: list.filter((n) => n.project_id === p.id).length })),
      providers: providers.map((p) => ({ provider: p.name, sent: p.stats.sent, success_pct: (p.stats.delivered / p.stats.sent) * 100, p50_ms: Math.round(p.stats.p95_latency_ms / 3), p95_ms: p.stats.p95_latency_ms })),
      latency: seriesDays(list, daysOf(q)).map((d, i) => ({ date: d.date, p50: 420 + ((i * 37) % 120), p95: 1300 + ((i * 91) % 700) })),
      retries: [1, 2, 3, 4, 5].map((n) => ({ attempts: n, count: list.filter((x) => x.deliveries![0].attempts.length === n).length })),
      estimated_cost: null,
    };
    return a;
  }

  if (path === "/internal/permissions") {
    if (method === "PUT") {
      if (!roleCan("manageRoles")) throw forbid("Only the main admin can change permissions");
      const next = b.matrix as Record<Perm, Role[]>; const changes: AuditChange[] = [];
      for (const d of PERM_DEFS) {
        if (d.locked) continue;
        const want = Array.from(new Set<Role>(["org_admin", ...(next[d.key] ?? [])]));
        if (JSON.stringify([...want].sort()) !== JSON.stringify([...permMatrix[d.key]].sort())) { const nm = (r: Role) => ({ org_admin: "Main admin", project_admin: "Manager", developer: "Developer", client: "Client", viewer: "Viewer" }[r]); changes.push({ field: d.label, from: permMatrix[d.key].map(nm).join(", "), to: want.map(nm).join(", ") }); permMatrix[d.key] = want; }
      }
      if (changes.length) logAudit("permissions.updated", `${changes.length} permission${changes.length > 1 ? "s" : ""}`, { changes });
    }
    if (path === "/internal/permissions" && method === "POST") { permMatrix = JSON.parse(JSON.stringify(DEFAULT_MATRIX)); logAudit("permissions.reset", "defaults restored"); }
    return { matrix: permMatrix };
  }
  if (path === "/internal/permissions/reset" && method === "POST") { if (!roleCan("manageRoles")) throw forbid("Only the main admin can change permissions"); permMatrix = JSON.parse(JSON.stringify(DEFAULT_MATRIX)); logAudit("permissions.reset", "defaults restored"); return { matrix: permMatrix }; }
  /** Roles the signed-in user may hand out: the main admin any; others only roles below their own. */
  const grantable = (): Role[] => (getRole() === "org_admin" ? ["project_admin", "developer", "client"] : ["developer", "client"]);
  if (path === "/internal/users" && method === "POST") {
    if (!roleCan("manageUsers")) throw forbid("Your role cannot invite users");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email))) throw new ApiError(422, "invalid_request", "Enter a valid email address", "req_mock");
    if (!grantable().includes(b.role)) throw forbid("You can only assign roles below your own");
    const scope = allowed(); if (scope && !scope.includes(b.project_id)) throw forbid("You can only add users to your own projects");
    if (members.some((x) => x.email === b.email && x.project_id === (b.project_id ?? null))) throw new ApiError(409, "conflict", "That user already has access to this project", "req_mock");
    if (!String(b.name ?? "").trim()) throw new ApiError(422, "invalid_request", "Name is required", "req_mock");
    const mem: Member = { user_id: id("usr"), name: String(b.name).trim(), email: b.email, role: b.role, project_id: b.project_id ?? null };
    members.push(mem); logAudit("user.invited", `${b.name.trim()} <${b.email}>`, { project_id: b.project_id, changes: [{ field: "role", from: "", to: b.role }] }); return mem;
  }
  if (path === "/internal/users") { const sc = allowed(); return sc ? members.filter((x) => x.project_id && sc.includes(x.project_id)) : members; }
  if ((m = path.match(/^\/internal\/users\/([^/]+)$/)) && method === "PATCH") {
    if (!roleCan("manageUsers")) throw forbid("Your role cannot change user roles");
    const u = members.find((x) => x.user_id === m![1]); if (!u) throw nf("User");
    if (!grantable().includes(b.role)) throw forbid("You can only assign roles below your own");
    const sc = allowed(); if (sc && (!u.project_id || !sc.includes(u.project_id) || u.role === "project_admin" || u.role === "org_admin")) throw forbid("You can only change developers and clients in your own projects");
    const before = u.role; u.role = b.role; logAudit("user.role_changed", u.email, { project_id: u.project_id ?? undefined, changes: [{ field: "role", from: before, to: b.role }] }); return u;
  }
  if (path === "/internal/audit-logs") {
    if (!roleCan("viewAudit")) throw forbid("Your role cannot view the audit log");
    const scope = allowed(); const s = String(q.q ?? "").toLowerCase(); const cat = String(q.category ?? ""); const from = q.from ? Date.parse(String(q.from)) : 0; const to = q.to ? Date.parse(String(q.to)) + 86400000 : Infinity;
    const rows = audit.filter((a) => (!scope || (a.project_id && scope.includes(a.project_id))) && (!cat || a.action.startsWith(cat + ".")) && (!q.actor || a.actor === q.actor) && (!q.project || a.project_id === q.project)
      && Date.parse(a.at) >= from && Date.parse(a.at) < to && (!s || [a.actor, a.actor_name, a.action, a.target, a.project_name ?? ""].some((x) => x.toLowerCase().includes(s))));
    return paginate(rows, q);
  }
  if (path === "/internal/security-events") return security;
  if (path === "/internal/search") {
    const s = String(q.q ?? "").toLowerCase(); if (s.length < 2) return [];
    const hits: SearchHit[] = [
      ...notifications.filter((n) => n.id.includes(s) && (!allowed() || allowed()!.includes(n.project_id))).slice(0, 4).map((n) => ({ type: "notification" as const, id: n.id, label: `${n.id} · ${n.status}`, to: `/notifications/${n.id}` })),
      ...templates.filter((t) => t.key.includes(s) || t.name.toLowerCase().includes(s)).map((t) => ({ type: "template" as const, id: t.id, label: t.name, to: `/templates/${t.id}` })),
      ...projects.filter((p) => p.name.toLowerCase().includes(s)).map((p) => ({ type: "project" as const, id: p.id, label: p.name, to: `/projects/${p.id}` })),
    ];
    return hits;
  }
  throw new ApiError(404, "not_found", `No mock route for ${method} ${path}`, "req_mock");
}

export type { Environment };
