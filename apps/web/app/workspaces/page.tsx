import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "../../../../convex/_generated/api";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { WorkspacePicker } from "@/components/auth/WorkspacePicker";
export const metadata: Metadata = { title: "Choose Workspace", robots: { index: false, follow: false } };
export default async function WorkspacesPage() {
  const account = await fetchAuthQuery(api.auth.getCurrentUser, {});
  if (!account) redirect("/login");
  if (!account.user.emailVerified) redirect("/verify-email");
  return <AuthFrame title="Your Workspaces" description="Choose where to work. Each workspace keeps its knowledge, members, and permissions separate."><WorkspacePicker /></AuthFrame>;
}
