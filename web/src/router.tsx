import { lazy, Suspense, type ComponentType } from "react";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/Login";
import { ErrorState, Skeleton } from "./components/ui";


// Route-level code splitting: each page loads on demand (and is preloaded on link hover, see defaultPreload).
function L(load: () => Promise<Record<string, unknown>>, name: string) {
  const C = lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
  return () => <Suspense fallback={<div className="p-6"><Skeleton className="h-8 w-48" /><Skeleton className="mt-4 h-64" /></div>}><C /></Suspense>;
}
const Overview = L(() => import("./pages/Overview"), "Overview");
const ProjectsPage = L(() => import("./pages/Projects"), "ProjectsPage");
const ProjectDetail = L(() => import("./pages/Projects"), "ProjectDetail");
const NotificationsPage = L(() => import("./pages/Notifications"), "NotificationsPage");
const NotificationDetail = L(() => import("./pages/Notifications"), "NotificationDetail");
const ChannelPage = L(() => import("./pages/Channels"), "ChannelPage");
const TemplatesPage = L(() => import("./pages/Templates"), "TemplatesPage");
const TemplateDetail = L(() => import("./pages/Templates"), "TemplateDetail");
const WorkflowsPage = L(() => import("./pages/Workflows"), "WorkflowsPage");
const SchedulesPage = L(() => import("./pages/Schedules"), "SchedulesPage");
const LogsPage = L(() => import("./pages/Logs"), "LogsPage");
const AnalyticsPage = L(() => import("./pages/Analytics"), "AnalyticsPage");
const DevelopersPage = L(() => import("./pages/Developers"), "DevelopersPage");
const BrandingPage = L(() => import("./pages/Branding"), "BrandingPage");
const AdminPage = L(() => import("./pages/Admin"), "AdminPage");

const root = createRootRoute({ component: Outlet, notFoundComponent: () => <div className="p-10"><ErrorState error={Object.assign(new Error("This page does not exist."), { status: 404, code: "not_found" })} /></div> });
const login = createRoute({ getParentRoute: () => root, path: "/login", component: LoginPage });
const shell = createRoute({ getParentRoute: () => root, id: "shell", component: Shell });
const r = <P extends string>(path: P, component: () => React.JSX.Element) => createRoute({ getParentRoute: () => shell, path, component });

const tree = root.addChildren([
  login,
  shell.addChildren([
    r("/", Overview), r("/projects", ProjectsPage), r("/projects/$id", ProjectDetail),
    r("/notifications", NotificationsPage), r("/notifications/$id", NotificationDetail),
    r("/channels/$channel", ChannelPage), r("/templates", TemplatesPage), r("/templates/$id", TemplateDetail),
    r("/workflows", WorkflowsPage), r("/schedules", SchedulesPage), r("/logs", LogsPage),
    r("/analytics", AnalyticsPage), r("/branding", BrandingPage), r("/developers", DevelopersPage), r("/admin", AdminPage),
  ]),
]);

export const router = createRouter({ routeTree: tree, defaultPreload: "intent", defaultPreloadDelay: 30, defaultPreloadStaleTime: 30_000 });
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
