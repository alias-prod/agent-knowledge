import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { AcceptInvitation } from "@/components/auth/AcceptInvitation";
export const metadata: Metadata = { title: "Workspace Invitation", robots: { index: false, follow: false } };
export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <AuthFrame title="Join Your Workspace" description="Invitations grant only the role assigned by your workspace administrator."><AcceptInvitation id={id} /></AuthFrame>;
}
