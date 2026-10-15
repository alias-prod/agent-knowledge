"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export function WorkspacePicker() {
  const { data: organizations, isPending } = authClient.useListOrganizations();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function openWorkspace(organizationId: string) {
    setPending(true); setError("");
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) throw new Error();
      // A full navigation disposes every old tenant subscription and transient editor state.
      window.location.assign("/dashboard");
    } catch { setError("Could not open this workspace. Check your membership and try again."); setPending(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const name = String(new FormData(event.currentTarget).get("workspace-name") ?? "").trim();
    if (!name) { setError("Enter a workspace name."); setPending(false); return; }
    try {
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50).replace(/^-|-$/g, "") || "workspace"}-${crypto.randomUUID().slice(0, 8)}`;
      const result = await authClient.organization.create({ name, slug });
      if (result.error || !result.data) throw new Error();
      await openWorkspace(result.data.id);
    } catch { setError("Could not create the workspace. Verify your email and try again."); setPending(false); }
  }
  return <div className="flex flex-col gap-8" data-workspaces-ready="true">
    <section className="flex flex-col gap-3" aria-label="Your workspaces">
      {isPending ? <p role="status">Loading your workspaces…</p> : organizations?.length ? organizations.map((org) => <Button key={org.id} variant="outline" size="lg" className="h-auto min-h-11 justify-between whitespace-normal text-left" onClick={() => openWorkspace(org.id)} disabled={pending}><span className="break-words">{org.name}</span><span aria-hidden="true">→</span></Button>) : <p className="text-sm leading-relaxed text-muted-foreground">No workspaces yet. Create one below, or open an invitation sent by your workspace administrator.</p>}
    </section>
    <form onSubmit={create} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="workspace-name">New Workspace Name</FieldLabel><Input id="workspace-name" name="workspace-name" required maxLength={100} autoComplete="organization" /></Field></FieldGroup><Button type="submit" size="lg" disabled={pending}>{pending ? "Please wait…" : "Create Workspace"}</Button></form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button variant="ghost" disabled={pending} onClick={async () => { const result = await authClient.signOut(); if (!result.error) window.location.assign("/login"); else setError("Sign-out failed. Try again."); }}>Sign Out</Button>
  </div>;
}
