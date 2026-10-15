"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export function AccountSettings() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>, password: boolean) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setPending(true); setError(""); setMessage("");
    try {
      const result = password ? await authClient.changePassword({ currentPassword: String(data.get("current")), newPassword: String(data.get("new")), revokeOtherSessions: true }) : await authClient.updateUser({ name: String(data.get("name")).trim() });
      if (result.error) throw new Error();
      setMessage(password ? "Password changed. Other sessions have been revoked." : "Profile saved.");
      if (password) form.reset();
    } catch { setError("Could not save the change. Check your details and try again."); }
    finally { setPending(false); }
  }
  return <div className="ak-page max-w-3xl"><header className="flex flex-col gap-3"><p className="text-sm uppercase tracking-widest text-muted-foreground">Personal Settings</p><h1 className="font-display text-4xl">Your Account</h1><p className="break-all text-sm text-muted-foreground">{user.email} · Email verified</p></header>{message && <p role="status">{message}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}<section className="ak-card flex flex-col gap-5"><h2 className="font-display text-2xl">Profile</h2><form onSubmit={(event) => submit(event, false)} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="account-name">Full Name</FieldLabel><Input id="account-name" name="name" defaultValue={user.name} required maxLength={100} autoComplete="name" /></Field></FieldGroup><Button disabled={pending}>Save Profile</Button></form></section><section className="ak-card flex flex-col gap-5"><h2 className="font-display text-2xl">Password & Sessions</h2><form onSubmit={(event) => submit(event, true)} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="current-password">Current Password</FieldLabel><Input id="current-password" name="current" type="password" autoComplete="current-password" required maxLength={128} /></Field><Field><FieldLabel htmlFor="new-password">New Password</FieldLabel><Input id="new-password" name="new" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></Field></FieldGroup><Button disabled={pending}>Change Password</Button></form><Button variant="outline" disabled={pending} onClick={async () => { setPending(true); const result = await authClient.revokeOtherSessions(); if (result.error) setError("Could not revoke other sessions. Try again."); else setMessage("All other sessions have been revoked."); setPending(false); }}>Sign Out Other Sessions</Button></section></div>;
}
