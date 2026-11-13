import type { Role } from "./types";

/**
 * Permission catalogue + defaults. UI hints only: the backend must enforce every permission
 * server-side (RBAC + project isolation), regardless of what this matrix says.
 */
export type Perm =
  | "createProject" | "manageProject" | "manageKeys" | "writeProviders" | "editTemplates" | "operate" | "viewDev" | "viewAdmin"
  | "viewLogs" | "viewWorkflows" | "viewChannels" | "viewSchedules" | "revealRecipients" | "editBranding" | "viewAudit" | "manageRoles" | "manageUsers";

export type PermGroup = "Organization" | "Projects" | "Messaging" | "Data & security";
export const PERM_DEFS: { key: Perm; label: string; desc: string; group: PermGroup; locked?: boolean }[] = [
  { key: "manageRoles", label: "Manage users, roles and permissions", desc: "Change who has which role and edit this matrix.", group: "Organization", locked: true },
  { key: "manageUsers", label: "Invite users and assign roles (below their own)", desc: "Managers can only add Developers and Clients, and only to their own projects.", group: "Organization" },
  { key: "createProject", label: "Create / archive projects", desc: "Add new client projects or archive existing ones.", group: "Organization" },
  { key: "viewAdmin", label: "Open Security & admin", desc: "See users, limits and security events.", group: "Organization" },
  { key: "manageProject", label: "Manage project settings, members and quotas", desc: "Edit limits, invite members, change project settings.", group: "Projects" },
  { key: "manageKeys", label: "Create / rotate API keys", desc: "Production keys additionally need Manage project settings.", group: "Projects" },
  { key: "writeProviders", label: "Write provider credentials", desc: "Store or replace email and WhatsApp provider secrets.", group: "Projects" },
  { key: "editBranding", label: "Customize email branding", desc: "Header, body, footer and design of project emails.", group: "Projects" },
  { key: "viewDev", label: "Open Projects and Developer portal", desc: "API keys, docs, webhooks and integration guides.", group: "Projects" },
  { key: "editTemplates", label: "Edit templates", desc: "Publish template versions, duplicate, customize per project.", group: "Messaging" },
  { key: "operate", label: "Send, retry and cancel notifications", desc: "Includes sending test messages.", group: "Messaging" },
  { key: "viewWorkflows", label: "View workflows", desc: "Event-triggered multi-step sends.", group: "Messaging" },
  { key: "viewSchedules", label: "View schedules", desc: "One-off and recurring sends.", group: "Messaging" },
  { key: "viewChannels", label: "View channel and provider status", desc: "Channel health, providers, failover.", group: "Messaging" },
  { key: "viewLogs", label: "View logs and monitoring", desc: "Delivery attempts, dead letters, webhook logs.", group: "Data & security" },
  { key: "revealRecipients", label: "Reveal unmasked recipients (audited)", desc: "Otherwise emails and phones are masked.", group: "Data & security" },
  { key: "viewAudit", label: "View audit log", desc: "Who changed what and when, within accessible projects.", group: "Data & security" },
];

export const ROLE_ORDER: Role[] = ["org_admin", "project_admin", "developer", "client"];
const ALL: Role[] = ["org_admin", "project_admin", "developer", "client"];
const ADMIN: Role[] = ["org_admin"];
const MGR: Role[] = ["org_admin", "project_admin"];
const STAFF: Role[] = ["org_admin", "project_admin", "developer"];
export const DEFAULT_MATRIX: Record<Perm, Role[]> = {
  manageRoles: ADMIN, manageUsers: MGR, createProject: ADMIN, viewAdmin: MGR, manageProject: MGR, manageKeys: STAFF, writeProviders: MGR, editBranding: ALL,
  viewDev: STAFF, editTemplates: STAFF, operate: STAFF, viewWorkflows: STAFF, viewSchedules: STAFF, viewChannels: STAFF, viewLogs: STAFF,
  revealRecipients: MGR, viewAudit: MGR,
};

/** Pages in the sidebar and the permission each needs (none = everyone signed in). Used for the "who sees what" view. */
export const PAGES: { label: string; perm?: Perm }[] = [
  { label: "Overview" }, { label: "Notifications" }, { label: "Templates" }, { label: "Analytics" },
  { label: "Email branding", perm: "editBranding" }, { label: "Workflows", perm: "viewWorkflows" }, { label: "Schedules", perm: "viewSchedules" },
  { label: "Channels", perm: "viewChannels" }, { label: "Projects", perm: "viewDev" }, { label: "Developers", perm: "viewDev" },
  { label: "Logs & monitoring", perm: "viewLogs" }, { label: "Security & admin", perm: "viewAdmin" },
];
