import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Field, Input } from "./ui";
import type { ProviderSpec } from "../lib/providers";

export type CredValues = Record<string, string>;

/** Returns an error message per field key. `partial` lets secrets stay empty (= keep the stored one). */
export function validateCreds(spec: ProviderSpec, v: CredValues, partial = false): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of spec.fields) {
    const val = (v[f.key] ?? "").trim();
    if (!val) { if (!(partial && f.secret)) out[f.key] = "Required"; continue; }
    if (!f.test(val)) out[f.key] = f.error;
  }
  return out;
}

export function splitCreds(spec: ProviderSpec, v: CredValues) {
  const config: CredValues = {}; const secrets: CredValues = {};
  for (const f of spec.fields) { const val = (v[f.key] ?? "").trim(); if (val) (f.secret ? secrets : config)[f.key] = val; }
  return { config, secrets };
}

export function CredentialFields({ spec, values, onChange, errors, partial }: { spec: ProviderSpec; values: CredValues; onChange: (v: CredValues) => void; errors: Record<string, string>; partial?: boolean }) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-3">
      {spec.fields.map((f) => (
        <Field key={f.key} label={f.label} hint={f.secret && partial ? "Leave empty to keep the stored secret. Stored secrets are never shown." : f.hint} error={errors[f.key]}>
          <div className="relative">
            <Input type={f.secret && !shown[f.key] ? "password" : "text"} autoComplete="off" spellCheck={false} placeholder={f.placeholder} aria-invalid={!!errors[f.key]}
              value={values[f.key] ?? ""} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })} className={f.secret ? "pr-9 font-mono" : "font-mono"} />
            {f.secret && <button type="button" aria-label={shown[f.key] ? "Hide value" : "Show value"} onClick={() => setShown((s) => ({ ...s, [f.key]: !s[f.key] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{shown[f.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}
          </div>
        </Field>
      ))}
    </div>
  );
}
