"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export function TwoFactorSettings() {
  const { data: session, refetch } = authClient.useSession();
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const enabled = session?.user.twoFactorEnabled === true;
  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(""); setError("");
    const form = event.currentTarget;
    const password = String(new FormData(form).get("factor-password") ?? "");
    try {
      if (enabled) {
        const result = await authClient.twoFactor.disable({ password });
        if (result.error) throw new Error();
        setSetup(null); setNotice("Two-factor authentication disabled.");
      } else {
        const result = await authClient.twoFactor.enable({ password });
        if (result.error || !result.data) throw new Error();
        setSetup(result.data);
      }
      form.reset(); await refetch();
    } catch { setError("Could not change two-factor authentication. Check your password and try again."); }
    finally { setPending(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: String(new FormData(event.currentTarget).get("enroll-code") ?? "").trim(), trustDevice: false });
      if (result.error) throw new Error();
      setSetup(null); setNotice("Two-factor authentication enabled. Keep your recovery codes safe."); await refetch();
    } catch { setError("Code not accepted. Enter a fresh code from your authenticator app."); }
    finally { setPending(false); }
  }
  return <section className="ak-card flex flex-col gap-5"><h2 className="font-display text-2xl">Two-Factor Authentication</h2><p className="text-sm leading-relaxed text-muted-foreground">{enabled ? "Enabled. Your password and authenticator protect your account." : "Add an authenticator app as a second factor. Setup is not active until you verify a code."}</p>{notice && <p role="status">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{setup ? <div className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="totp-uri">Authenticator Setup URI</FieldLabel><Input id="totp-uri" readOnly value={setup.totpURI} autoComplete="off" /><p className="text-sm text-muted-foreground">Import this URI into your authenticator. It contains a secret: never share it.</p></Field></FieldGroup><details><summary className="min-h-11 cursor-pointer py-3">Save Your Recovery Codes</summary><pre className="overflow-x-auto rounded-md border border-border bg-background p-4 text-sm text-foreground">{setup.backupCodes.join("\n")}</pre><p className="text-sm leading-relaxed">Save these in your password manager before verifying. Each works once.</p></details><form onSubmit={verify} className="flex flex-col gap-4"><FieldGroup><Field><FieldLabel htmlFor="enroll-code">Authenticator Code</FieldLabel><Input id="enroll-code" name="enroll-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></Field></FieldGroup><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required />I saved my recovery codes securely</label><Button disabled={pending}>Verify & Enable</Button></form><Button variant="outline" onClick={() => setSetup(null)}>Close Setup</Button></div> : <form onSubmit={configure} className="flex flex-col gap-4"><FieldGroup><Field><FieldLabel htmlFor="factor-password">Current Password</FieldLabel><Input id="factor-password" name="factor-password" type="password" autoComplete="current-password" required maxLength={128} /></Field></FieldGroup><Button variant={enabled ? "outline" : "default"} disabled={pending || !session}>{pending ? "Please wait…" : enabled ? "Disable Two-Factor" : "Set Up Authenticator"}</Button></form>}</section>;
}
