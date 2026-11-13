import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Async, Badge, Card, Code, PageHeader, PendingBanner, Select, Table, Tabs, Td } from "../components/ui";
import { API_URL } from "../lib/api";
import { useApi } from "../lib/hooks";

type Lang = "curl" | "javascript" | "python" | "java" | "php";
const BASE = API_URL || "https://api.your-notify-domain.example";

const body = `{
  "category": "transactional",
  "to": { "external_id": "user_42", "email": "a@example.com", "phone": "+14155550100" },
  "channels": ["whatsapp", "email"],
  "template": { "key": "password-reset", "variables": { "link": "https://example.com/reset/abc" } },
  "priority": "critical",
  "expires_at": "2026-11-11T10:20:00Z"
}`;

const samples: Record<Lang, string> = {
  curl: `curl -X POST ${BASE}/v1/notifications \\
  -H "Authorization: Bearer $NOTIFY_API_KEY" \\
  -H "Idempotency-Key: reset-user42-2026-11-11" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`,
  javascript: `// Server-side only. Never expose the API key in browser code.
const res = await fetch("${BASE}/v1/notifications", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.NOTIFY_API_KEY}\`,
    "Idempotency-Key": "reset-user42-2026-11-11",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${body.replace(/\n/g, "\n  ")}),
});
if (!res.ok) throw new Error((await res.json()).error.message);
console.log(await res.json()); // { id: "ntf_...", status: "queued" }`,
  python: `import os, requests

res = requests.post(
    "${BASE}/v1/notifications",
    headers={
        "Authorization": f"Bearer {os.environ['NOTIFY_API_KEY']}",
        "Idempotency-Key": "reset-user42-2026-11-11",
    },
    json=${body.replace(/\n/g, "\n    ")},
    timeout=10,
)
res.raise_for_status()
print(res.json())`,
  java: `HttpClient client = HttpClient.newHttpClient();
String json = """
${body}
""";
HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("${BASE}/v1/notifications"))
    .header("Authorization", "Bearer " + System.getenv("NOTIFY_API_KEY"))
    .header("Idempotency-Key", "reset-user42-2026-11-11")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();
HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(res.statusCode() + " " + res.body());`,
  php: `<?php
$ch = curl_init("${BASE}/v1/notifications");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("NOTIFY_API_KEY"),
    "Idempotency-Key: reset-user42-2026-11-11",
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => <<<'JSON'
${body}
JSON,
]);
$response = curl_exec($ch);
echo $response;`,
};

const errors: [string, number, string][] = [
  ["invalid_request", 400, "Malformed JSON or failed validation. See `details`."], ["unauthorized", 401, "Missing, invalid or revoked API key."],
  ["forbidden", 403, "Key lacks scope or the environment is disabled."], ["not_found", 404, "Resource does not exist in this project/environment."],
  ["idempotency_conflict", 409, "Same Idempotency-Key reused with a different body."], ["rate_limited", 429, "Too many requests. Honor Retry-After."],
  ["quota_exceeded", 429, "Daily project quota reached."], ["recipient_suppressed", 422, "Recipient unsubscribed, bounced or opted out."],
  ["template_render_error", 422, "Missing variable or invalid template."], ["no_eligible_channel", 422, "No requested channel can reach this recipient."],
  ["provider_unavailable", 503, "All providers for the channel are down."], ["internal_error", 500, "Unexpected error. Quote request_id when contacting support."],
];

const verify = `// Node.js: verify an outbound webhook
import crypto from "node:crypto";
export function verify(rawBody, headers, secret) {
  const ts = headers["x-webhook-timestamp"], id = headers["x-webhook-id"];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window 5 min
  const expected = crypto.createHmac("sha256", secret).update(\`\${id}.\${ts}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headers["x-webhook-signature"]));
}`;

export function DevelopersPage() {
  const [tab, setTab] = useState<"start" | "examples" | "webhooks" | "errors" | "sdks" | "sandbox" | "openapi">("start");
  const [lang, setLang] = useState<Lang>("curl");
  return (
    <>
      <PageHeader title="Developer portal" description="Integrate from any language over HTTPS + JSON. SDKs are thin wrappers over the same contract." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "start", label: "Getting started" }, { id: "examples", label: "Examples" }, { id: "webhooks", label: "Webhooks" }, { id: "errors", label: "Error codes" }, { id: "sdks", label: "SDKs" }, { id: "sandbox", label: "Sandbox" }, { id: "openapi", label: "OpenAPI" }]} />
      {tab === "start" && (
        <div className="space-y-4">
          <Card title="1. Authenticate"><p className="text-sm">Create an API key per environment in <Link to="/projects" className="text-primary hover:underline">Projects → API keys</Link>. Send it as <code className="rounded bg-surface-2 px-1">Authorization: Bearer &lt;key&gt;</code>. The key determines the project and environment, so you never pass either. Use keys from your <strong>server only</strong>.</p></Card>
          <Card title="2. Send"><p className="mb-2 text-sm">POST <code className="rounded bg-surface-2 px-1">/v1/notifications</code> returns <Badge tone="info">202</Badge> once the request is durably stored; delivery is asynchronous. Always send an <code className="rounded bg-surface-2 px-1">Idempotency-Key</code> so retries never duplicate a message.</p></Card>
          <Card title="3. Track"><p className="text-sm">Poll <code className="rounded bg-surface-2 px-1">GET /v1/notifications/{`{id}`}</code> or register a webhook. Delivery is at-least-once internally; handlers should be idempotent. Delivery to a handset or inbox is never guaranteed.</p></Card>
          <Card title="Limits & pagination"><p className="text-sm">Rate limits are per API key and project (headers <code>X-RateLimit-*</code>, <code>Retry-After</code>). Lists use cursor pagination: pass <code>cursor</code>, read <code>next_cursor</code>; <code>limit</code> max 100. Batch endpoint accepts up to 1000 items.</p></Card>
        </div>
      )}
      {tab === "examples" && (
        <Card title="Send a notification" actions={<Select aria-label="Language" className="w-32" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{(Object.keys(samples) as Lang[]).map((l) => <option key={l} value={l}>{l}</option>)}</Select>}>
          <Code lang={lang}>{samples[lang]}</Code>
          <p className="mb-1 mt-4 text-sm font-medium">Response (202)</p>
          <Code>{`{\n  "id": "ntf_01J9Z...",\n  "status": "queued",\n  "deliveries": [{ "id": "dlv_...", "channel": "whatsapp", "status": "queued" }]\n}`}</Code>
        </Card>
      )}
      {tab === "webhooks" && (
        <Card title="Outbound webhooks">
          <p className="mb-3 text-sm">Events: <code>notification.queued | sent | delivered | read | failed | expired | cancelled</code>. Requests carry <code>x-webhook-id</code>, <code>x-webhook-timestamp</code> and <code>x-webhook-signature</code> (HMAC-SHA256 over <code>id.timestamp.body</code>). Failed deliveries are retried with backoff for up to 24 hours.</p>
          <Code>{verify}</Code>
        </Card>
      )}
      {tab === "errors" && (
        <Card title="Error format: { error: { code, message, details, request_id } }" pad={false}>
          <Table head={["Code", "HTTP", "Meaning"]}>{errors.map(([c, s, m]) => <tr key={c}><Td className="font-mono text-xs">{c}</Td><Td>{s}</Td><Td>{m}</Td></tr>)}</Table>
        </Card>
      )}
      {tab === "sdks" && (
        <div className="space-y-4">
          <PendingBanner>No SDK has been published yet. The TypeScript SDK is planned first, then Python; other languages are generated from the OpenAPI spec on demand. Until then, use plain HTTP as in the examples.</PendingBanner>
          <Card title="Planned SDK contract"><p className="text-sm">Same method names in every language: <code>notifications.send</code>, <code>.get</code>, <code>.list</code>, <code>.cancel</code>, <code>templates.*</code>, <code>webhooks.verify</code>. Auto-generated idempotency keys, retry on 5xx/429, typed errors.</p></Card>
        </div>
      )}
      {tab === "sandbox" && (
        <Card title="Sandbox / testing"><p className="text-sm">Use a <strong>Development</strong> environment key. Sandbox sends are recorded and visible in the explorer but are not delivered to real recipients unless the address is on the project’s allow-list. Test sending from a template is available on the template page.</p><p className="mt-2 text-xs text-muted">Backend enforcement of the allow-list is pending.</p></Card>
      )}
      {tab === "openapi" && <OpenApi />}
    </>
  );
}

function OpenApi() {
  const q = useApi<{ openapi: string; info: { title: string; version: string }; paths: Record<string, unknown> }>("/v1/openapi.json");
  return (
    <Card title="OpenAPI specification (served by the API)">
      <Async q={q} skeleton={<p className="text-sm text-muted">Loading…</p>}>
        {(s) => <div className="text-sm"><p>{s.info.title} v{s.info.version} · OpenAPI {s.openapi} · {Object.keys(s.paths).length} paths</p><a className="text-primary hover:underline" href={`${API_URL}/v1/openapi.json`} target="_blank" rel="noreferrer">Download openapi.json</a></div>}
      </Async>
    </Card>
  );
}
