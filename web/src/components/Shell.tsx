import * as DM from "@radix-ui/react-dropdown-menu";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import {
  BarChart3, Bell, BookOpen, Check, CalendarClock, ChevronsUpDown, FileText, FolderKanban, GitBranch, LayoutDashboard, LogOut, Menu, Moon, Palette,
  Plus, Radio, ScrollText, Search, ShieldCheck, Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { PanelLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { USE_MOCK } from "../lib/api";
import { CHANNEL_LABEL, CHANNEL_STATUS } from "../lib/features";
import { useApi } from "../lib/hooks";
import { useScope } from "../lib/scope";
import { ROLE_LABEL, useCan, type Perm } from "../lib/session";
import { api } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../lib/theme";
import type { Channel, EnvKind, Me, Org, Project } from "../lib/types";
import { AppearanceModal } from "./Appearance";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { ChannelIcon, ErrorState, Skeleton } from "./ui";

type NavItem = { to: string; label: string; icon: typeof Bell; perm?: Perm };
const groups: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: "/", label: "Overview", icon: LayoutDashboard }] },
  { title: "Messaging", items: [
    { to: "/notifications", label: "Notifications", icon: Bell }, { to: "/templates", label: "Templates", icon: FileText },
    { to: "/workflows", label: "Workflows", icon: GitBranch, perm: "viewWorkflows" }, { to: "/schedules", label: "Schedules", icon: CalendarClock, perm: "viewSchedules" },
  ] },
  { title: "Platform", items: [
    { to: "/projects", label: "Projects", icon: FolderKanban, perm: "viewDev" }, { to: "/logs", label: "Logs & monitoring", icon: ScrollText, perm: "viewLogs" },
    { to: "/branding", label: "Email branding", icon: Palette, perm: "editBranding" }, { to: "/analytics", label: "Analytics", icon: BarChart3 }, { to: "/developers", label: "Developers", icon: BookOpen, perm: "viewDev" },
    { to: "/admin", label: "Security & admin", icon: ShieldCheck, perm: "viewAdmin" },
  ] },
];
const allNav = groups.flatMap((g) => g.items);

const menu = "pop-in z-[70] min-w-60 rounded-xl border border-border bg-surface p-1 shadow-xl";
const menuItem = "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-surface-2";
const menuLabel = "px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted";

function Tile({ name, className }: { name: string; className?: string }) {
  return <span className={clsx("grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-xs font-semibold text-primary-fg", className)}>{(name || "?").slice(0, 1).toUpperCase()}</span>;
}

function NavLink({ to, params, label, collapsed, active, icon, extra }: { to: string; params?: Record<string, string>; label: string; collapsed: boolean; active: boolean; icon: React.ReactNode; extra?: React.ReactNode }) {
  const link = (
    <Link to={to} params={params as never} aria-label={label} className={clsx("relative flex items-center gap-2.5 rounded-lg py-1.5 text-[13px] font-medium", collapsed ? "justify-center px-0" : "px-2.5", active ? "text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg")}>
      {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-surface-2 ring-1 ring-border" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
      <span className="relative z-10 shrink-0">{icon}</span>
      {!collapsed && <span className="relative z-10 truncate">{label}</span>}
      {!collapsed && extra && <span className="relative z-10 ml-auto">{extra}</span>}
    </Link>
  );
  return collapsed ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip> : link;
}

function WorkspaceSwitcher({ orgs, projects }: { orgs: Org[]; projects: Project[] }) {
  const s = useScope();
  const org = orgs.find((o) => o.id === s.orgId) ?? orgs[0];
  const proj = projects.find((p) => p.id === s.projectId);
  return (
    <DM.Root>
      <DM.Trigger className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-left hover:bg-surface-2" aria-label="Switch organization or project">
        <Tile name={proj?.name ?? org?.name ?? "?"} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold">{proj?.name ?? "All projects"}</span>
          <span className="block truncate text-[11.5px] text-muted">{org?.name ?? "Loading…"}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="start" sideOffset={6} className={menu}>
          <DM.Label className={menuLabel}>Organization</DM.Label>
          <DM.RadioGroup value={s.orgId} onValueChange={s.setOrgId}>
            {orgs.map((o) => <DM.RadioItem key={o.id} value={o.id} className={menuItem}><Tile name={o.name} className="size-5 text-[10px]" />{o.name}<DM.ItemIndicator className="ml-auto"><Check className="size-4 text-primary" /></DM.ItemIndicator></DM.RadioItem>)}
          </DM.RadioGroup>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Label className={menuLabel}>Project</DM.Label>
          <DM.RadioGroup value={s.projectId} onValueChange={s.setProjectId}>
            <DM.RadioItem value="all" className={menuItem}>All projects<DM.ItemIndicator className="ml-auto"><Check className="size-4 text-primary" /></DM.ItemIndicator></DM.RadioItem>
            {projects.filter((p) => p.status === "active").map((p) => <DM.RadioItem key={p.id} value={p.id} className={menuItem}><Tile name={p.name} className="size-5 text-[10px]" />{p.name}<DM.ItemIndicator className="ml-auto"><Check className="size-4 text-primary" /></DM.ItemIndicator></DM.RadioItem>)}
          </DM.RadioGroup>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function UserMenu({ me, onAppearance }: { me?: Me; onAppearance: () => void }) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => { try { await api.post("/internal/auth/logout"); } finally { qc.clear(); navigate({ to: "/login" }); } };
  return (
    <DM.Root>
      <DM.Trigger className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-surface-2" aria-label="Account menu">
        {me ? <Tile name={me.name} className="rounded-full" /> : <Skeleton className="size-7 rounded-full" />}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium">{me?.name ?? "…"}</span>
          <span className="block truncate text-[11.5px] text-muted">{me ? ROLE_LABEL[me.role] : ""} · {me?.email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="start" side="top" sideOffset={6} className={menu}>
          <DM.Item className={menuItem} onSelect={onAppearance}><Palette className="size-4" />Appearance</DM.Item>
          <DM.Item className={menuItem} onSelect={toggle}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}Switch to {theme === "dark" ? "light" : "dark"} mode</DM.Item>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item className={menuItem} onSelect={signOut}><LogOut className="size-4" />Sign out</DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

const envs: { id: EnvKind | "all"; label: string }[] = [{ id: "all", label: "All" }, { id: "dev", label: "Dev" }, { id: "staging", label: "Staging" }, { id: "prod", label: "Prod" }];

export function Shell() {
  const me = useApi<Me>("/internal/me");
  const orgs = useApi<Org[]>("/internal/orgs");
  const projects = useApi<Project[]>("/internal/projects");
  const scope = useScope();
  const can = useCan();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("sidebar.collapsed") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("sidebar.collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ } }, [collapsed]);

  useEffect(() => { if (me.error?.status === 401) navigate({ to: "/login" }); }, [me.error, navigate]);
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [path]);
  useEffect(() => {
    if (orgs.data?.length && !orgs.data.some((o) => o.id === scope.orgId)) scope.setOrgId(orgs.data[0].id);
  }, [orgs.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const visible = (n: NavItem) => !n.perm || can(n.perm);
  const noAccess = !me.isPending && ((): boolean => {
    const top = path.split("/").filter(Boolean)[0];
    if (!top) return false;
    if (top === "channels") return !can("viewChannels");
    const n = allNav.find((x) => x.to === `/${top}`);
    return !!n && !visible(n);
  })();
  const items = useMemo<PaletteItem[]>(() => [
    ...allNav.filter(visible).map((n) => ({ id: n.to, label: n.label, group: "Go to", icon: n.icon, run: () => navigate({ to: n.to }) })),
    ...(can("viewChannels") ? (Object.keys(CHANNEL_LABEL) as Channel[]) : []).map((c) => ({ id: `ch-${c}`, label: `${CHANNEL_LABEL[c]} channel`, group: "Go to", run: () => navigate({ to: "/channels/$channel", params: { channel: c } }) })),
    ...(can("createProject") ? [{ id: "a-proj", label: "Create project", group: "Actions", icon: Plus, run: () => navigate({ to: "/projects" }) }] : []),
    { id: "a-appearance", label: "Appearance settings", group: "Actions", icon: Palette, run: () => setAppearance(true) },
    { id: "a-theme", label: "Toggle light / dark mode", group: "Actions", icon: theme === "dark" ? Sun : Moon, run: toggle },
  ], [navigate, theme, toggle, me.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me.error && me.error.status !== 401) {
    return <div className="mx-auto max-w-lg pt-24"><ErrorState error={me.error} onRetry={() => me.refetch()} /></div>;
  }

  const seg = path.split("/").filter(Boolean);
  const crumbs = seg.length === 0 ? ["Overview"] : seg.map((s, i) => (i === 0 ? allNav.find((n) => n.to === `/${s}`)?.label ?? s.charAt(0).toUpperCase() + s.slice(1) : s));

  const makeSidebar = (collapsed: boolean) => (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={clsx("flex items-center gap-2 pb-3 pt-4", collapsed ? "justify-center px-2" : "px-4")}>
        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-fg"><Radio className="size-4" /></div>
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight">Orotron Notify</span>}
      </div>
      {!collapsed && <div className="px-3 pb-2"><WorkspaceSwitcher orgs={orgs.data ?? []} projects={projects.data ?? []} /></div>}
      <nav aria-label="Main" className={clsx("flex-1 overflow-y-auto pb-3", collapsed ? "px-2" : "px-3")}>
        {groups.filter((g) => g.items.some(visible)).map((g, gi) => (
          <div key={gi} className="mt-3">
            {g.title && !collapsed && <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">{g.title}</div>}
            {g.items.filter(visible).map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              return (
                <NavLink key={n.to} to={n.to} label={n.label} collapsed={collapsed} active={active} icon={<n.icon className={clsx("size-4", active && "text-primary")} aria-hidden />} />
              );
            })}
          </div>
        ))}
        {can("viewChannels") && <div className="mt-3">
          {!collapsed && <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">Channels</div>}
          {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => {
            const active = path === `/channels/${c}`;
            return (
              <NavLink key={c} to="/channels/$channel" params={{ channel: c }} label={CHANNEL_LABEL[c]} collapsed={collapsed} active={active} icon={<ChannelIcon channel={c} size="sm" />}
                extra={CHANNEL_STATUS[c] === "pending" ? <span className="rounded-full bg-warning-soft px-1.5 text-[10px] font-medium text-warning">Soon</span> : <span className="block size-1.5 rounded-full bg-success" aria-label="Available" />} />
            );
          })}
        </div>}
      </nav>
      <div className="border-t border-border p-3">{collapsed ? <Tile name={me.data?.name ?? "?"} className="mx-auto rounded-full" /> : <UserMenu me={me.data} onAppearance={() => setAppearance(true)} />}</div>
    </div>
  );
  const sidebar = makeSidebar(false);

  return (
    <div className="flex min-h-full">
      <motion.aside initial={false} animate={{ width: collapsed ? 64 : 248 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-border bg-surface lg:block">{makeSidebar(collapsed)}</motion.aside>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)}>
          <div className="fade-in absolute inset-0 bg-black/50" />
          <aside className="relative h-full w-[264px] bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="app-glow flex min-w-0 flex-1 flex-col">
        {USE_MOCK && <div role="status" className="bg-warning-soft px-4 py-1 text-center text-[11.5px] font-medium text-warning">DEMO DATA: served by an in-browser mock of the planned API. Not real platform data. No backend exists yet.</div>}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/75 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-lg p-2 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></button>
          <button className="hidden rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg lg:block" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}><PanelLeft className="size-4" /></button>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
            {crumbs.map((c, i) => <span key={i} className={clsx("truncate", i === crumbs.length - 1 ? "font-medium" : "text-muted")}>{i > 0 && <span className="mr-1.5 text-muted">/</span>}{c}</span>)}
          </nav>
          <button onClick={() => setPalette(true)} className="mx-auto flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] text-muted hover:bg-surface-2">
            <Search className="size-3.5" aria-hidden /><span className="flex-1 text-left">Search or jump to…</span><kbd className="hidden rounded border border-border px-1.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div role="group" aria-label="Environment" className="hidden shrink-0 items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 md:flex">
            {envs.map((e) => (
              <button key={e.id} aria-pressed={scope.env === e.id} onClick={() => scope.setEnv(e.id)}
                className={clsx("rounded-md px-2.5 py-1 text-xs font-medium", scope.env === e.id ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg")}>{e.label}</button>
            ))}
          </div>
          <button onClick={toggle} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
        </header>
        <main className="w-full min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6"><motion.div key={path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}>{noAccess ? <ErrorState error={Object.assign(new Error("Your role does not have access to this page."), { status: 403, code: "forbidden" })} /> : <Outlet />}</motion.div></main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} items={items} />
      <AppearanceModal open={appearance} onOpenChange={setAppearance} />
    </div>
  );
}
