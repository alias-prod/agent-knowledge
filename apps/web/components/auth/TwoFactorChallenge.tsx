"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export function TwoFactorChallenge() {
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setPending(true); setError("");
    try {
      const result = backup ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) throw new Error();
      window.location.assign("/workspaces");
    } catch { setError("Verification failed. Check your code, or sign in again to start a new challenge."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="factor-code">{backup ? "Recovery Code" : "Authenticator Code"}</FieldLabel><Input id="factor-code" name="code" inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" spellCheck={false} required maxLength={64} aria-describedby="factor-help" /><p id="factor-help" className="text-sm text-muted-foreground">{backup ? "Each recovery code can be used only once." : "Enter the current 6-digit code from your authenticator app."}</p></Field></FieldGroup>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending}>{pending ? "Verifying…" : "Verify & Sign In"}</Button><Button type="button" variant="outline" disabled={pending} onClick={() => { setBackup(!backup); setError(""); }}>{backup ? "Use Authenticator" : "Use Recovery Code"}</Button><a className="text-sm underline underline-offset-4" href="/login">Back to Sign In</a></form>;
}
