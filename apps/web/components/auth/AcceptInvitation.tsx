"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AcceptInvitation({ id }: { id?: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!id) return <p role="alert">This invitation link is incomplete. Ask your administrator for a new invitation.</p>;
  if (isPending) return <p role="status">Checking your account…</p>;
  if (!session) return <div className="flex flex-col gap-4"><p className="text-sm leading-relaxed text-muted-foreground">Sign in with the invited email address. A different address cannot accept this invitation.</p><Button asChild><Link href={`/login?next=${encodeURIComponent(`/accept-invitation?id=${id}`)}`}>Sign In to Review Invitation</Link></Button><Link href="/sign-up" className="text-sm underline underline-offset-4">Create an account first</Link></div>;
  async function accept() {
    if (!id) return;
    setPending(true); setError("");
    try {
      const result = await authClient.organization.acceptInvitation({ invitationId: id });
      if (result.error || !result.data) throw new Error();
      const active = await authClient.organization.setActive({ organizationId: result.data.member.organizationId });
      if (active.error) throw new Error();
      window.location.assign("/dashboard");
    } catch { setError("This invitation cannot be accepted. Check that your email is verified and matches the invited address, or ask your administrator to resend an expired or revoked invitation."); setPending(false); }
  }
  return <div className="flex flex-col gap-5"><p className="break-words text-sm">Signed in as {session.user.email}</p>{error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}<Button onClick={accept} disabled={pending}>{pending ? "Accepting…" : "Accept Workspace Invitation"}</Button><Button variant="outline" onClick={async () => { await authClient.signOut(); window.location.reload(); }}>Use a Different Account</Button><Link href="/workspaces" className="text-sm underline underline-offset-4">Back to Workspaces</Link></div>;
}
