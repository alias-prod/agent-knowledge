import type { BetterAuthOptions } from "better-auth/minimal";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { convex } from "@convex-dev/better-auth/plugins";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { getAuthEnvironment } from "./authEnvironment";

export type AuthMail = {
  kind: "verification" | "reset" | "invitation";
  email: string;
  url: string;
};

export type SendAuthMail = (message: AuthMail) => Promise<void>;

export function createAuthOptions(
  database: BetterAuthOptions["database"],
  sendMail: SendAuthMail,
) {
  const configuration = getAuthEnvironment(process.env);
  return {
    ...configuration,
    database,
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
          await sendMail({ kind: "invitation", email, url: url.toString() });
        },
      }),
      convex({ authConfig: { providers: [getAuthConfigProvider()] } }),
    ],
  } satisfies BetterAuthOptions;
}
