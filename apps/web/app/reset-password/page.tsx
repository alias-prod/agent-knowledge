import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthForm } from "@/components/auth/AuthForm";
export const metadata: Metadata = { title: "Reset Password", robots: { index: false, follow: false } };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return <AuthFrame title="Choose a New Password" description="A successful reset signs out existing sessions for your account."><AuthForm mode="reset" token={error ? undefined : token} notice={!token || error ? "This reset link is missing or invalid. Request a new link below." : undefined} /></AuthFrame>;
}
