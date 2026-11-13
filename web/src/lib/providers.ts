/**
 * Credential fields per provider. Secret fields are write-only: sent once, stored encrypted by the backend,
 * and never shown again (only the last 4 characters). Format checks here are a convenience: the real test
 * is the "Test connection" call to the provider, and the backend must validate again.
 */
export interface CredField { key: string; label: string; secret?: boolean; placeholder?: string; hint?: string; test: (v: string) => boolean; error: string; default?: string }
export interface ProviderSpec { name: string; channel: "email" | "whatsapp"; fields: CredField[]; setup: string[] }

const digits = (min: number, max: number) => (v: string) => new RegExp(`^\\d{${min},${max}}$`).test(v);

export const PROVIDER_SPECS: Record<string, ProviderSpec> = {
  brevo: {
    name: "Brevo", channel: "email",
    fields: [{ key: "api_key", label: "API key (v3)", secret: true, placeholder: "xkeysib-…", hint: "Brevo → SMTP & API → API keys. Starts with xkeysib-.", test: (v) => /^xkeysib-[A-Za-z0-9-]{30,}$/.test(v), error: "Brevo API keys start with xkeysib- and are longer than this." }],
    setup: ["Create an API key in Brevo (SMTP & API → API keys).", "Add and verify your sender emails below. Brevo only sends from verified senders.", "Authenticate your domain (DKIM and DMARC) so mail is not marked as spam.", "Add the dashboard server's IP to Brevo's authorised IPs if you enabled IP restriction."],
  },
  resend: {
    name: "Resend", channel: "email",
    fields: [{ key: "api_key", label: "API key", secret: true, placeholder: "re_…", hint: "Starts with re_.", test: (v) => /^re_[A-Za-z0-9_]{16,}$/.test(v), error: "Resend API keys start with re_." }],
    setup: ["Create an API key in Resend.", "Add and verify your sending domain (SPF + DKIM)."],
  },
  aws_ses: {
    name: "AWS SES", channel: "email",
    fields: [
      { key: "access_key_id", label: "Access key ID", placeholder: "AKIA…", test: (v) => /^(AKIA|ASIA)[A-Z0-9]{16}$/.test(v), error: "Access key IDs are 20 characters starting with AKIA or ASIA." },
      { key: "secret_access_key", label: "Secret access key", secret: true, test: (v) => v.length === 40, error: "Secret access keys are 40 characters." },
      { key: "region", label: "Region", default: "ap-south-1", hint: "Use a dedicated IAM user limited to ses:SendEmail.", test: (v) => /^[a-z]{2}-[a-z]+-\d$/.test(v), error: "Use a region like ap-south-1." },
    ],
    setup: ["Create a dedicated IAM user that can only send email.", "Request SES production access (new accounts start in sandbox).", "Verify the sender identity or domain."],
  },
  meta_cloud_api: {
    name: "Meta WhatsApp Cloud API", channel: "whatsapp",
    fields: [
      { key: "phone_number_id", label: "Phone number ID", placeholder: "1090…", hint: "WhatsApp Manager → API setup. Not the phone number itself.", test: digits(10, 20), error: "Phone number ID is 10 to 20 digits." },
      { key: "waba_id", label: "WhatsApp Business Account ID", placeholder: "1234…", hint: "Needed to manage and submit message templates.", test: digits(10, 20), error: "WABA ID is 10 to 20 digits." },
      { key: "access_token", label: "Access token (system user)", secret: true, placeholder: "EAA…", hint: "Use a permanent system-user token, not the 24-hour test token.", test: (v) => /^EAA[A-Za-z0-9]{40,}$/.test(v), error: "Meta access tokens start with EAA and are much longer." },
      { key: "app_secret", label: "App secret", secret: true, hint: "Used to verify webhook signatures (X-Hub-Signature-256).", test: (v) => /^[a-f0-9]{32}$/.test(v), error: "App secrets are 32 hex characters." },
    ],
    setup: ["Create a Meta app with the WhatsApp product and complete Business verification.", "Copy the Phone number ID and WABA ID from WhatsApp Manager → API setup.", "Create a system user and generate a permanent access token with whatsapp_business_messaging and whatsapp_business_management.", "After saving, paste the callback URL and verify token below into the app's Webhooks settings.", "Message templates must be approved by Meta before use outside the 24-hour window."],
  },
  twilio_whatsapp: {
    name: "Twilio WhatsApp", channel: "whatsapp",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "AC…", test: (v) => /^AC[a-f0-9]{32}$/.test(v), error: "Account SIDs are AC plus 32 hex characters." },
      { key: "auth_token", label: "Auth token", secret: true, test: (v) => /^[a-f0-9]{32}$/.test(v), error: "Auth tokens are 32 hex characters." },
      { key: "from", label: "WhatsApp sender", placeholder: "whatsapp:+14155550100", test: (v) => /^whatsapp:\+\d{7,15}$/.test(v), error: "Use the format whatsapp:+14155550100." },
    ],
    setup: ["Enable a WhatsApp sender in Twilio.", "Copy the Account SID, auth token and sender number."],
  },
};

export const FREE_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com", "aol.com"];
export const isFreeMail = (email: string) => FREE_MAIL.includes(email.split("@")[1]?.toLowerCase() ?? "");
