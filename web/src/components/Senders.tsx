import { BadgeCheck, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Async, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Table, Td, useConfirm } from "./ui";
import { api } from "../lib/api";
import { fmtDate } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";
import { isFreeMail, PROVIDER_SPECS } from "../lib/providers";
import type { ProviderConfig, Sender } from "../lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the name recipients will see").max(80),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  provider: z.string().min(1, "Choose a provider"),
});
type Form = z.infer<typeof schema>;
const tone = { verified: "success", pending: "warning", failed: "danger" } as const;

/** Sender identities ("From" addresses). Providers only send from verified senders. */
export function Senders({ providers, canEdit }: { providers: ProviderConfig[]; canEdit: boolean }) {
  const confirm = useConfirm();
  const q = useApi<Sender[]>("/internal/senders");
  const [open, setOpen] = useState(false);
  const inv = { invalidate: ["/internal/senders", "/internal/audit-logs"] };
  const emailProviders = providers.filter((p) => p.channel === "email");
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", provider: emailProviders[0]?.provider ?? "brevo" } });
  const add = useAction((v: Form) => api.post("/internal/senders", v), { ...inv, success: "Sender added. Verify it before sending.", onSuccess: () => { setOpen(false); form.reset(); } });
  const verify = useAction((s: Sender) => api.post<Sender>(`/internal/senders/${s.id}/verify`), inv);
  const makeDefault = useAction((s: Sender) => api.patch(`/internal/senders/${s.id}`, { is_default: true }), { ...inv, success: "Default sender updated" });
  const remove = useAction((s: Sender) => api.del(`/internal/senders/${s.id}`), { ...inv, success: "Sender removed" });
  const email = form.watch("email");
  const providerNames = Array.from(new Set(["brevo", ...emailProviders.map((p) => p.provider)]));
  return (
    <Card title="Sender emails" pad={false} actions={canEdit ? <Button size="sm" variant="primary" onClick={() => setOpen(true)}>Add sender</Button> : undefined}>
      <Async q={q} empty={(d) => d.length === 0} skeleton={<p className="p-4 text-sm text-muted">Loading…</p>}>
        {(rows) => (
          <Table head={["Sender", "Provider", "Status", "Added", ""]}>
            {rows.map((s) => (
              <tr key={s.id}>
                <Td><div className="flex items-center gap-2 font-medium">{s.name}{s.is_default && <Badge tone="primary" dot={false}>Default</Badge>}</div><div className="text-xs text-muted-foreground">{s.email}</div>{s.message && <div role="alert" className="mt-1 max-w-md text-xs text-danger">{s.message}</div>}</Td>
                <Td>{PROVIDER_SPECS[s.provider]?.name ?? s.provider}</Td>
                <Td><Badge tone={tone[s.status]}>{s.status}</Badge>{s.verified_at && <div className="text-xs text-muted-foreground">{fmtDate(s.verified_at)}</div>}</Td>
                <Td className="text-muted-foreground">{fmtDate(s.created_at)}</Td>
                <Td className="space-x-1 whitespace-nowrap text-right">
                  {canEdit && <>
                    {s.status !== "verified" && <Button size="sm" loading={verify.isPending && verify.variables?.id === s.id} onClick={() => verify.mutate(s)}><BadgeCheck className="size-3.5" />Check</Button>}
                    {s.status === "verified" && !s.is_default && <Button size="sm" onClick={() => makeDefault.mutate(s)}><Star className="size-3.5" />Make default</Button>}
                    <Button size="sm" aria-label={`Remove ${s.email}`} onClick={async () => { if (await confirm({ title: `Remove ${s.email}?`, description: "Templates and projects using this sender will fall back to the default sender.", confirmLabel: "Remove sender", danger: true })) remove.mutate(s); }}><Trash2 className="size-3.5" /></Button>
                  </>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
      {q.data?.length === 0 && <EmptyState title="No sender emails yet" description="Add the address your emails are sent from, then verify it." />}
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Providers send only from verified senders, on a domain you own with SPF, DKIM and DMARC set up. Free mail addresses (Gmail, Yahoo, Outlook…) cannot be authenticated and are rejected.</p>
      <Modal open={open} onOpenChange={setOpen} title="Add sender email" description="The name and address recipients see in the From field.">
        <form className="space-y-3" noValidate onSubmit={form.handleSubmit((v) => add.mutate(v))}>
          <Field label="Sender name" error={form.formState.errors.name?.message}><Input autoComplete="off" placeholder="Demo Storefront" aria-invalid={!!form.formState.errors.name} {...form.register("name")} /></Field>
          <Field label="Sender email" error={form.formState.errors.email?.message}><Input type="email" placeholder="no-reply@yourdomain.com" aria-invalid={!!form.formState.errors.email} {...form.register("email")} /></Field>
          {email && isFreeMail(email) && <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">This is a free mail address. Providers cannot authenticate it, so verification will fail. Use an address on your own domain.</p>}
          <Field label="Provider"><Select value={form.watch("provider")} onChange={(e) => form.setValue("provider", e.target.value)}>{providerNames.map((k) => <option key={k} value={k}>{PROVIDER_SPECS[k]?.name ?? k}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={add.isPending}>Add sender</Button></div>
        </form>
      </Modal>
    </Card>
  );
}
