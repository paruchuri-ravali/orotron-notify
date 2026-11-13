import { useState } from "react";
import { Async, Field, PageHeader, Select } from "../components/ui";
import { useApi } from "../lib/hooks";
import { useScope } from "../lib/scope";
import type { Project } from "../lib/types";
import { BrandingTab } from "./Projects";

/** Email branding for the projects the signed-in role can access. The backend must enforce project access. */
export function BrandingPage() {
  const q = useApi<Project[]>("/internal/projects");
  const scope = useScope();
  const [picked, setPicked] = useState("");
  return (
    <>
      <PageHeader title="Email branding" description="Customize the header, body, footer and design of your project's emails. Changes apply to every template in the project." />
      <Async q={q} empty={(d) => d.length === 0}>
        {(projects) => {
          const active = projects.filter((p) => p.status === "active");
          const id = picked || (active.some((p) => p.id === scope.projectId) ? scope.projectId : active[0]?.id);
          return (
            <>
              {active.length > 1 && <div className="mb-4 max-w-xs"><Field label="Project"><Select value={id} onChange={(e) => setPicked(e.target.value)}>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div>}
              {id && <BrandingTab key={id} p={{ id }} />}
            </>
          );
        }}
      </Async>
    </>
  );
}
