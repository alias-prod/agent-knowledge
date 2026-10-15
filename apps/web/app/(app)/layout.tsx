import { redirect } from "next/navigation";
import { AppShell } from "../AppShell";
import { ConvexClientProvider } from "../ConvexClientProvider";
import { ToastProvider } from "../components/ToastProvider";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import { api } from "../../../../convex/_generated/api";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const account = await fetchAuthQuery(api.auth.getCurrentUser, {});
  if (!account) redirect("/login");
  if (!account.user.emailVerified) redirect("/verify-email");
  const token = await getToken();
  return <ConvexClientProvider initialToken={token}><ToastProvider><AppShell>{children}</AppShell></ToastProvider></ConvexClientProvider>;
}
