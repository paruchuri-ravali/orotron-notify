import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { EnvKind } from "./types";

export interface Scope {
  orgId: string;
  projectId: string; // "all" or project id
  env: EnvKind | "all";
  setOrgId: (v: string) => void;
  setProjectId: (v: string) => void;
  setEnv: (v: EnvKind | "all") => void;
}
const Ctx = createContext<Scope | null>(null);

function load(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function save(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* storage unavailable */ }
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [orgId, setOrgId] = useState(() => load("scope.org", ""));
  const [projectId, setProjectId] = useState(() => load("scope.project", "all"));
  const [env, setEnv] = useState<EnvKind | "all">(() => load("scope.env", "all") as EnvKind | "all");
  useEffect(() => save("scope.org", orgId), [orgId]);
  useEffect(() => save("scope.project", projectId), [projectId]);
  useEffect(() => save("scope.env", env), [env]);
  return <Ctx.Provider value={{ orgId, projectId, env, setOrgId, setProjectId, setEnv }}>{children}</Ctx.Provider>;
}

export function useScope() {
  const c = useContext(Ctx);
  if (!c) throw new Error("ScopeProvider missing");
  return c;
}
