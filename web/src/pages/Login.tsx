import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Code2, Crown, Radio, UserCog } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input } from "../components/ui";
import { api, USE_MOCK } from "../lib/api";
import { useAction } from "../lib/hooks";
import type { Role } from "../lib/types";

const roles: { role: Role; title: string; icon: typeof Crown; desc: string }[] = [
  { role: "org_admin", title: "Main admin", icon: Crown, desc: "Full control: projects, providers, keys, users, audit log." },
  { role: "project_admin", title: "Manager", icon: UserCog, desc: "Runs assigned projects: members, keys, providers, branding." },
  { role: "developer", title: "Developer", icon: Code2, desc: "Builds and tests: API keys, templates, logs, developer docs." },
  { role: "client", title: "Client", icon: Building2, desc: "Read-only view of their own project: notifications and analytics." },
];

export function LoginPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const enter = () => { qc.clear(); navigate({ to: "/" }); };
  const demo = useAction((role: Role) => api.post("/internal/auth/demo-login", { role }), { onSuccess: enter });
  const request = useAction(() => api.post("/internal/auth/otp/request", { email }), { success: "Code sent if the email is registered", onSuccess: () => setSent(true) });
  const verify = useAction(() => api.post("/internal/auth/otp/verify", { email, code }), { onSuccess: enter });
  return (
    <div className="app-glow grid min-h-full place-items-center p-4">
      <div className="page-enter w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg"><Radio className="size-5" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Orotron Notify</h1>
        </div>
        {USE_MOCK ? (
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-base font-semibold">Sign in as</h2>
            <p className="mb-4 mt-1 text-[13px] text-muted">Demo mode: pick a role to see what each person gets. There is no real authentication yet, and the real backend will enforce these permissions itself.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {roles.map((r) => (
                <button key={r.role} onClick={() => demo.mutate(r.role)} disabled={demo.isPending}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left hover:border-primary hover:bg-primary-soft disabled:opacity-60">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted group-hover:bg-primary group-hover:text-primary-fg"><r.icon className="size-4" /></span>
                  <span><span className="block text-[13.5px] font-semibold">{r.title}</span><span className="mt-0.5 block text-xs text-muted">{r.desc}</span></span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-sm rounded-2xl border border-border bg-surface p-6">
            <h2 className="mb-4 text-base font-semibold">Sign in</h2>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); sent ? verify.mutate(undefined) : request.mutate(undefined); }}>
              <Field label="Work email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} /></Field>
              {sent && <Field label="6-digit code" hint="Check your inbox. Codes expire in 10 minutes."><Input inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value)} /></Field>}
              <Button type="submit" variant="primary" className="w-full" loading={request.isPending || verify.isPending}>{sent ? "Verify and sign in" : "Email me a code"}</Button>
            </form>
            <p className="mt-3 text-xs text-muted">Your role (admin, manager, developer or client) is assigned by your organization.</p>
          </div>
        )}
      </div>
    </div>
  );
}
