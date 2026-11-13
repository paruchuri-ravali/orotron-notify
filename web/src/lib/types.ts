export type Channel = "email" | "sms" | "whatsapp" | "push" | "in_app";
export type EnvKind = "dev" | "staging" | "prod";
export type Category =
  | "transactional" | "business" | "operational" | "marketing"
  | "scheduled" | "event" | "bulk" | "realtime" | "critical";
export type NStatus =
  | "queued" | "scheduled" | "sending" | "sent" | "delivered"
  | "read" | "failed" | "expired" | "cancelled";
export type Role = "org_admin" | "project_admin" | "developer" | "client" | "viewer";

export interface Page<T> { data: T[]; next_cursor: string | null; total?: number }

export interface Me { id: string; email: string; name: string; role: Role; org_id: string }
export interface Org { id: string; name: string; slug: string }
export interface Project {
  id: string; org_id: string; name: string; slug: string; description: string;
  status: "active" | "archived"; created_at: string;
  limits: { daily_quota: number; rate_per_minute: number };
}
export interface Branding {
  // identity
  logo_url: string; brand_color: string; accent_color: string; sender_name: string; font: "system" | "serif" | "mono";
  preset: "classic" | "minimal" | "bold" | "modern";
  // header
  header_style: "bar" | "centered" | "minimal"; header_bg: string; tagline: string; show_stripe: boolean;
  // body (middle)
  width: number; page_bg: string; card_bg: string; text_color: string; link_color: string; radius: number; font_size: number;
  button_style: "solid" | "outline"; button_radius: number; pre_footer_text: string;
  // footer
  footer_text: string; postal_address: string; footer_bg: string; footer_text_color: string;
  social_links: { label: string; url: string }[]; show_unsubscribe: boolean; unsubscribe_text: string;
}
export interface Environment { id: string; project_id: string; kind: EnvKind }
export interface ApiKey {
  id: string; environment_id: string; name: string; prefix: string;
  status: "active" | "rotating" | "revoked"; created_at: string; last_used_at: string | null;
  secret?: string; // only present once, on create/rotate
}
export interface Member { user_id: string; name: string; email: string; role: Role; project_id: string | null }

export interface Attempt {
  id: string; attempt_no: number; provider: string; status: "success" | "failed";
  error_code: string | null; error_message: string | null; latency_ms: number;
  provider_response: Record<string, unknown>; at: string;
}
export interface Delivery {
  id: string; channel: Channel; provider: string; status: NStatus; attempts: Attempt[];
  provider_message_id: string | null;
}
export interface TimelineEvent { type: string; at: string; detail?: string }
export interface Notification {
  id: string; project_id: string; environment_id: string; env: EnvKind; category: Category;
  priority: "critical" | "high" | "normal" | "low"; status: NStatus; channels: Channel[];
  recipient: string; template_key: string; created_at: string; send_at: string | null;
  idempotency_key: string | null; deliveries?: Delivery[]; timeline?: TimelineEvent[];
  webhook_events?: { id: string; type: string; status_code: number | null; at: string }[];
  retryable?: boolean; cancellable?: boolean;
}

export interface ProviderConfig {
  id: string; channel: Channel; provider: string; name: string; enabled: boolean; priority: number;
  secret_hint: string; health: "healthy" | "degraded" | "down" | "unknown";
  stats: { sent: number; delivered: number; failed: number; p95_latency_ms: number };
  last_tested_at: string | null;
  /** Non-secret settings (IDs, region…). Secrets are never returned. */
  config?: Record<string, string>;
}
export interface Sender {
  id: string; email: string; name: string; provider: string; status: "pending" | "verified" | "failed"; is_default: boolean;
  created_at: string; verified_at: string | null; message?: string;
}
export interface ChannelInfo {
  channel: Channel; status: "available" | "pending"; providers: ProviderConfig[];
  catalog: { key: string; name: string; notes: string }[]; fallback_to: Channel | null;
}

export interface WaButton { type: "quick_reply" | "url" | "phone"; text: string; value?: string }
/** Per-channel content. WhatsApp fields follow Meta's template structure (header, body, footer, buttons, category, language). */
export interface ChannelContent {
  subject?: string; body: string;
  header?: string; footer?: string; buttons?: WaButton[];
  wa_category?: "utility" | "authentication" | "marketing"; language?: string;
  approval?: "draft" | "pending" | "approved" | "rejected";
}
export interface TemplateVersion {
  version: number; status: "draft" | "published"; created_at: string; author: string;
  content: Partial<Record<Channel, ChannelContent>>;
  variables: string[];
}
export interface Template {
  id: string; key: string; name: string; scope: "project" | "organization"; project_id: string | null;
  status: "active" | "archived"; channels: Channel[]; latest_version: number; updated_at: string;
  versions?: TemplateVersion[]; sample_data?: Record<string, string>;
}

export interface TemplateUsage {
  project_id: string; project_name: string; brand_color: string; accent_color: string; sender_name: string;
  source: "inherited" | "override"; override_id: string | null;
}
export interface GalleryItem {
  id: string; key: string; name: string; category: string; description: string; channels: Channel[];
  content: TemplateVersion["content"]; sample_data: Record<string, string>;
}
export interface Workflow {
  id: string; name: string; trigger_event: string; active: boolean; category: Category;
  conditions: string; steps: string[]; version: number; updated_at: string;
}
export interface Schedule {
  id: string; template_key: string; recipient: string; channel: Channel; timezone: string;
  kind: "one_off" | "recurring"; rule: string; next_run_at: string | null;
  status: "scheduled" | "running" | "completed" | "cancelled" | "failed";
  last_run_status: "ok" | "failed" | null;
}
export interface WebhookSub {
  id: string; url: string; events: string[]; status: "active" | "disabled"; secret_hint: string;
}
export interface WebhookDelivery {
  id: string; subscription_id: string; event: string; attempt: number;
  status_code: number | null; ok: boolean; at: string; next_retry_at: string | null;
}
export interface DeadLetter { id: string; notification_id: string; queue: string; reason: string; failed_at: string; attempts: number }
export interface QueueStat { queue: string; depth: number; oldest_age_s: number; in_flight: number; dlq: number }

export interface Overview {
  totals: { total: number; sent: number; delivered: number; failed: number; pending: number; success_pct: number };
  active_projects: number;
  series: { date: string; delivered: number; failed: number; pending: number }[];
  by_channel: { channel: Channel; count: number }[];
  provider_health: { provider: string; channel: Channel; health: ProviderConfig["health"]; error_rate_pct: number }[];
  recent: Notification[];
  alerts: { id: string; level: "info" | "warning" | "critical"; message: string; at: string }[];
}
export interface Analytics {
  series: { date: string; total: number; delivered: number; failed: number }[];
  by_channel: { channel: Channel; count: number; success_pct: number }[];
  by_project: { project: string; count: number }[];
  providers: { provider: string; sent: number; success_pct: number; p50_ms: number; p95_ms: number }[];
  latency: { date: string; p50: number; p95: number }[];
  retries: { attempts: number; count: number }[];
  estimated_cost: null | { currency: string; total: number };
}
export interface AuditChange { field: string; from: string; to: string }
export interface AuditLog {
  id: string; at: string; actor: string; actor_name: string; actor_role: Role; action: string; target: string;
  project_id?: string; project_name?: string; ip: string; changes?: AuditChange[];
}
export interface SecurityEvent { id: string; severity: "low" | "medium" | "high"; message: string; at: string }
export interface SearchHit { type: "notification" | "template" | "project"; id: string; label: string; to: string }
