import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
export const metadata: Metadata = { title: "Sign In", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string; next?: string; error?: string }> }) {
  const params = await searchParams;
  return <AuthFrame title="Welcome Back" description="Sign in to your connected knowledge workspace."><AuthForm mode="login" next={params.next} notice={params.verified ? "Email verified. You can now sign in." : params.error ? "The verification link is invalid or expired. Request a new link below." : undefined} /></AuthFrame>;
}
