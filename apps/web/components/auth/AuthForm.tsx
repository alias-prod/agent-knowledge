"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

function authFailure(error: { status: number }, fallback: string) {
  return new Error(error.status === 503 ? "Email delivery is unavailable. Your administrator must verify the sender domain before account email can be sent." : fallback);
}
export type AuthMode = "login" | "signup" | "forgot" | "reset" | "verify";
export function AuthForm({ mode, token, notice, next = "/workspaces" }: { mode: AuthMode; token?: string; notice?: string; next?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(notice ?? "");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [submitted, setSubmitted] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setPending(true); setError(""); setMessage("");
    try {
      const callbackURL = `${window.location.origin}/login?verified=1`;
      if (mode === "login") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error("Sign-in failed. Check your credentials and verify your email, then try again.");
        if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
          window.location.assign("/two-factor");
          return;
        }
        window.location.assign(next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/workspaces");
      } else if (mode === "signup") {
        const result = await authClient.signUp.email({ email, password, name: String(values.get("name") ?? "").trim(), callbackURL });
        if (result.error) throw authFailure(result.error, "We could not finish sign-up. Try signing in or requesting a password reset.");
        setMessage("Check your inbox for your verification link. Verify your email before signing in."); setSubmitted(true);
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
        if (result.error) throw authFailure(result.error, "We could not send the recovery request. Please try again.");
        setMessage("If an account exists for this address, a password reset link is on its way. Check your inbox."); setSubmitted(true);
      } else if (mode === "reset") {
        if (!token) throw new Error("This reset link is invalid. Request a new password reset.");
        const result = await authClient.resetPassword({ token, newPassword: password });
        if (result.error) throw new Error("This reset link is invalid or expired. Request a new password reset.");
        setMessage("Your password has been reset. Sign in with your new password."); setSubmitted(true);
      } else {
        const result = await authClient.sendVerificationEmail({ email, callbackURL });
        if (result.error) throw authFailure(result.error, "We could not send the verification request. Please try again.");
        setMessage("If your account needs verification, a new link is on its way. Check your inbox."); setSubmitted(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed. Please try again.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setPending(false); }
  }
  const label = { login: "Sign In", signup: "Create Account", forgot: "Send Reset Link", reset: "Save New Password", verify: "Send Verification Link" }[mode];
  return <>
    <form onSubmit={submit} aria-busy={pending} className="flex flex-col gap-6" data-auth-ready="true">
      <FieldGroup>
        {mode === "signup" && <Field><FieldLabel htmlFor="name">Full Name</FieldLabel><Input id="name" name="name" autoComplete="name" required maxLength={100} /></Field>}
        {mode !== "reset" && <Field><FieldLabel htmlFor="email">Email Address</FieldLabel><Input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required maxLength={254} /></Field>}
        {["login", "signup", "reset"].includes(mode) && <Field><FieldLabel htmlFor="password">{mode === "reset" ? "New Password" : "Password"}</FieldLabel><Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} aria-describedby={mode !== "login" ? "password-help" : undefined} />{mode !== "login" && <p id="password-help" className="text-sm text-muted-foreground">Use at least 8 characters. A password manager is recommended.</p>}</Field>}
      </FieldGroup>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm leading-relaxed text-foreground">{message}</p>}
      {!submitted && <Button type="submit" size="lg" disabled={pending}>{pending ? "Please wait…" : label}</Button>}
    </form>
    <nav aria-label="Account access" className="flex flex-col gap-4 text-sm text-muted-foreground">
      {mode === "login" ? <><Link href="/forgot-password" className="underline underline-offset-4">Forgot your password?</Link><p>New to ALIAS? <Link href="/sign-up" className="text-foreground underline underline-offset-4">Create an account</Link></p><Link href="/verify-email" className="underline underline-offset-4">Resend verification email</Link></> : <Link href="/login" className="text-foreground underline underline-offset-4">Back to sign in</Link>}
      {mode === "reset" && <Link href="/forgot-password" className="underline underline-offset-4">Request a new reset link</Link>}
    </nav>
  </>;
}
