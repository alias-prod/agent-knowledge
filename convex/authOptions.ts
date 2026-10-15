import type { BetterAuthOptions } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { convex } from "@convex-dev/better-auth/plugins";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { getAuthEnvironment } from "./authEnvironment";
import { sendAuthMail, assertAuthMailReady } from "./authMail";

export type AuthMail = {
  kind: "verification" | "reset" | "invitation";
  email: string;
  url: string;
  deliveryId?: string;
};

export type SendAuthMail = (message: AuthMail) => Promise<void>;

export function createAuthOptions(
  database: BetterAuthOptions["database"],
  sendMail: SendAuthMail = sendAuthMail,
) {
  const configuration = getAuthEnvironment(process.env);
  return {
    ...configuration,
    database,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (["/sign-up/email", "/send-verification-email", "/request-password-reset", "/organization/invite-member"].includes(ctx.path)) {
          try { await assertAuthMailReady(process.env); }
          catch { throw new APIError("SERVICE_UNAVAILABLE", { message: "Authentication email is unavailable. Ask your administrator to verify the sender domain." }); }
        }
      }),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendMail({ kind: "reset", email: user.email, url });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail({ kind: "verification", email: user.email, url });
      },
    },
    session: configuration.session,
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: async (user) => user.emailVerified === true,
        creatorRole: "owner",
        disableOrganizationDeletion: true,
        requireEmailVerificationOnInvitation: true,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        sendInvitationEmail: async ({ id, email }) => {
          if (!configuration.baseURL) throw new APIError("SERVICE_UNAVAILABLE");
          const url = new URL("/accept-invitation", configuration.baseURL);
          url.searchParams.set("id", id);
          // A deliberate resend may reuse the same invitation URL. Retries of
          // this delivery retain its ID; a new plugin callback gets a new one.
          await sendMail({ kind: "invitation", email, url: url.toString(), deliveryId: crypto.randomUUID() });
        },
      }),
      convex({ authConfig: { providers: [getAuthConfigProvider()] } }),
    ],
  } satisfies BetterAuthOptions;
}
