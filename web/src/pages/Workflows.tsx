import { Async, Badge, Card, PageHeader, PendingBanner, Table, Td, Toggle } from "../components/ui";
import { api } from "../lib/api";
import { PENDING } from "../lib/features";
import { relTime, titleCase } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";
import type { Workflow } from "../lib/types";

export function WorkflowsPage() {
  const q = useApi<Workflow[]>("/internal/workflows");
  const toggle = useAction(({ w, active }: { w: Workflow; active: boolean }) => api.patch(`/internal/workflows/${w.id}`, { active }), { invalidate: ["/internal/workflows"], success: "Workflow updated" });
  return (
    <>
      <PageHeader title="Workflows" description="Event-triggered rules: conditions, channel selection, retries, fallback and escalation. Configured as structured rules, not a visual canvas." />
      <PendingBanner>{PENDING.workflows} {PENDING.smartRouting}</PendingBanner>
      <Card pad={false}>
        <Async q={q} empty={(d) => d.length === 0}>
          {(rows) => (
            <Table head={["Workflow", "Trigger", "Category", "Conditions", "Steps", "Version", "Updated", "Active"]}>
              {rows.map((w) => (
                <tr key={w.id}>
                  <Td className="font-medium">{w.name}</Td><Td className="font-mono text-xs">{w.trigger_event}</Td><Td><Badge>{titleCase(w.category)}</Badge></Td>
                  <Td className="font-mono text-xs">{w.conditions}</Td>
                  <Td><ol className="list-decimal pl-4 text-xs">{w.steps.map((s) => <li key={s}>{s}</li>)}</ol></Td>
                  <Td>v{w.version}</Td><Td className="text-muted">{relTime(w.updated_at)}</Td>
                  <Td><Toggle label={`Activate ${w.name}`} checked={w.active} onChange={(active) => toggle.mutate({ w, active })} /></Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}
