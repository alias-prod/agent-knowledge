import { betterAuth } from "better-auth/minimal";
import { convexAdapter } from "@convex-dev/better-auth";
import { createAuthOptions } from "../authOptions";

// CLI-only: schema generation must never send an email or access a deployment.
export const auth = betterAuth(createAuthOptions(
  convexAdapter({} as never, {} as never),
  async () => { throw new Error("Schema generation cannot deliver authentication email"); },
));
