"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ConfirmDialog } from "../../components/ConfirmDialog";

type Role = "owner" | "admin" | "member";
export default function MembersPage() {
  const { authOrganizationId, user, role } = useAuth();
  const { data: organization, isPending, refetch } = authClient.useActiveOrganization();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const canManage = role === "owner" || role === "admin";
  async function perform(action: () => Promise<{ error: unknown }>, message: string) {
    setPending(true); setError(""); setNotice("");
    try { const result = await action(); if (result.error) throw new Error(); await refetch(); setNotice(message); }
    catch { setError("The change could not be completed. Check your permissions and try again. A workspace must always retain an owner."); }
    finally { setPending(false); }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await perform(() => authClient.organization.inviteMember({ organizationId: authOrganizationId, email: String(data.get("email")).trim(), role: String(data.get("role")) as Role }), "Invitation sent. Membership begins only after acceptance.");
  }
  return <div className="ak-page" data-members-ready="true">
    <header className="flex flex-col gap-3 border-b border-border pb-6"><p className="text-sm uppercase tracking-widest text-muted-foreground">Workspace Administration</p><h1 className="font-display text-4xl tracking-wide">Members</h1><p className="text-sm leading-relaxed text-muted-foreground">Manage access to {organization?.name ?? "your workspace"}. Invitations do not grant access until accepted.</p></header>
    {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}{notice && <p role="status" className="text-sm leading-relaxed">{notice}</p>}
    {canManage && <section className="ak-card flex flex-col gap-5"><h2 className="font-display text-2xl">Invite a Teammate</h2><form onSubmit={invite} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="invite-email">Email Address</FieldLabel><Input id="invite-email" name="email" type="email" autoComplete="email" required maxLength={254} /></Field><Field><FieldLabel htmlFor="invite-role">Starting Role</FieldLabel><select id="invite-role" name="role" className="ak-select"><option value="member">Member</option><option value="admin">Admin</option>{role === "owner" && <option value="owner">Owner</option>}</select></Field></FieldGroup><Button type="submit" disabled={pending}>{pending ? "Please wait…" : "Send Invitation"}</Button></form></section>}
    <section className="ak-card flex flex-col gap-5"><h2 className="font-display text-2xl">Workspace Members</h2>{isPending ? <p role="status">Loading members…</p> : <ul className="flex flex-col gap-4">{organization?.members.map((member) => <li key={member.id} className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium">{member.user.name}{member.userId === user.id ? " (you)" : ""}</p><p className="break-all text-sm text-muted-foreground">{member.user.email}</p></div><div className="flex flex-wrap items-center gap-3">{canManage ? <><label className="sr-only" htmlFor={`role-${member.id}`}>Role for {member.user.email}</label><select id={`role-${member.id}`} className="ak-select w-auto" value={member.role} disabled={pending || role !== "owner" && member.role === "owner"} onChange={(event) => perform(() => authClient.organization.updateMemberRole({ organizationId: authOrganizationId, memberId: member.id, role: event.target.value as Role }), "Member role updated.")}><option value="member">Member</option><option value="admin">Admin</option>{(role === "owner" || member.role === "owner") && <option value="owner">Owner</option>}</select><Button variant="outline" disabled={pending || role !== "owner" && member.role === "owner"} onClick={() => setRemoveId(member.id)}>Remove</Button></> : <span className="text-sm capitalize">{member.role}</span>}</div></li>)}</ul>}</section>
    {canManage && <section className="ak-card flex flex-col gap-5"><h2 className="font-display text-2xl">Invitations</h2>{!organization?.invitations.length ? <p className="text-sm text-muted-foreground">No invitations yet.</p> : <ul className="flex flex-col gap-4">{organization.invitations.map((invitation) => <li key={invitation.id} className="flex flex-col gap-3 border-b border-border pb-4"><p className="break-all text-sm font-medium">{invitation.email}</p><p className="text-sm capitalize text-muted-foreground">{invitation.role} · {invitation.status}{new Date(invitation.expiresAt).getTime() <= Date.now() ? " · expired" : ""}</p>{invitation.status === "pending" && <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={pending} onClick={() => perform(() => authClient.organization.inviteMember({ organizationId: authOrganizationId, email: invitation.email, role: invitation.role as Role, resend: true }), "Invitation resent.")}>Resend</Button><Button variant="outline" disabled={pending} onClick={() => perform(() => authClient.organization.cancelInvitation({ invitationId: invitation.id }), "Invitation revoked.")}>Revoke</Button></div>}</li>)}</ul>}</section>}
    <ConfirmDialog open={!!removeId} onCancel={() => setRemoveId(null)} tone="danger" onConfirm={async () => { if (!removeId) return; await perform(() => authClient.organization.removeMember({ organizationId: authOrganizationId, memberIdOrEmail: removeId }), "Member removed."); setRemoveId(null); }} title="Remove Member?" description="This member will lose access to this workspace immediately." confirmLabel="Remove Member" />
  </div>;
}
