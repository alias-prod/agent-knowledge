import { Resend } from "resend";
import { getAuthEnvironment } from "./authEnvironment";
import type { AuthMail, SendAuthMail } from "./authOptions";

type MailEnvironment = Record<string, string | undefined>;
type MailClient = Pick<Resend, "emails">;

const messages = {
  verification: {
    subject: "Verify your ALIAS email address",
    action: "Verify email address",
    description: "Confirm this email address to finish setting up your ALIAS account.",
  },
  reset: {
    subject: "Reset your ALIAS password",
    action: "Reset password",
    description: "Use the link below to choose a new password for your ALIAS account.",
  },
  invitation: {
    subject: "Your ALIAS workspace invitation",
    action: "View invitation",
    description: "You have been invited to an ALIAS workspace. Sign in with this email address to review the invitation.",
  },
} as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function getAuthMailConfiguration(env: MailEnvironment) {
  const domain = env.RESEND_EMAIL_DOMAIN?.trim().toLowerCase();
  if (!env.RESEND_API_KEY || !domain || domain.length > 253
    || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
    || domain === "resend.dev") {
    throw new Error("Authentication email requires Resend and a verified sender domain");
  }
  const { baseURL } = getAuthEnvironment(env);
  if (!baseURL) throw new Error("Authentication email requires a canonical site origin");
  return { from: `ALIAS <security@${domain}>`, origin: baseURL };
}

async function idempotencyKey(message: AuthMail) {
  const input = JSON.stringify([message.kind, message.email, message.url, message.deliveryId]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `auth-${message.kind}/${hash}`;
}

export function createAuthMailSender(
  env: MailEnvironment,
  client?: MailClient,
): SendAuthMail {
  return async (message) => {
    const configuration = getAuthMailConfiguration(env);
    const url = new URL(message.url);
    if (url.origin !== configuration.origin || url.username || url.password || url.hash
      || (url.protocol !== "https:" && !(env.NODE_ENV === "development"
        && url.origin === "http://localhost:3000"))) {
      throw new Error("Authentication email contains an invalid action origin");
    }
    if (message.email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(message.email)) {
      throw new Error("Authentication email contains an invalid recipient");
    }
    const copy = messages[message.kind];
    const resend = client ?? new Resend(env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: configuration.from,
      to: [message.email],
      subject: copy.subject,
      text: `${copy.description}\n\n${copy.action}: ${message.url}\n\nIf you did not request this email, you can ignore it. Do not forward this link.`,
      html: `<h1>${copy.subject}</h1><p>${copy.description}</p><p><a href="${escapeHtml(message.url)}">${copy.action}</a></p><p>If you did not request this email, you can ignore it. Do not forward this link.</p>`,
    }, { idempotencyKey: await idempotencyKey(message) });
    if (error || !data?.id) {
      // Do not expose recipients, action tokens, or provider response bodies.
      throw new Error("Authentication email could not be delivered");
    }
  };
}

export async function assertAuthMailReady(env: MailEnvironment) {
  const configuration = getAuthMailConfiguration(env);
  const headers = { Authorization: `Bearer ${env.RESEND_API_KEY}` };
  const response = await fetch("https://api.resend.com/domains", { headers });
  const payload = await response.json() as {
    name?: string;
    data?: { name: string; status: string }[];
  };
  if (!response.ok) {
    if (response.status !== 401 || payload.name !== "restricted_api_key") {
      throw new Error("Authentication email service is unavailable");
    }
    // Sending-only keys cannot inspect domains. Resend's delivery simulator still
    // checks sender permissions and verification without emailing a real inbox.
    const probe = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Idempotency-Key": `auth-readiness/${env.RESEND_EMAIL_DOMAIN?.trim().toLowerCase()}/${Math.floor(Date.now() / 300000)}`,
      },
      body: JSON.stringify({
        from: configuration.from,
        to: ["delivered@resend.dev"],
        subject: "ALIAS authentication email readiness",
        text: "Non-user delivery check for authentication email configuration.",
      }),
    });
    const delivery = await probe.json() as { id?: string };
    if (!probe.ok || !delivery.id) throw new Error("Authentication email service is unavailable");
    return;
  }
  if (!payload.data?.some((domain) => domain.name === env.RESEND_EMAIL_DOMAIN?.trim().toLowerCase() && domain.status === "verified")) {
    throw new Error("Authentication email requires a verified sender domain");
  }
}

export const sendAuthMail: SendAuthMail = (message) => createAuthMailSender(process.env)(message);
