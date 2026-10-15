"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { WorkspaceAuthContext, type WorkspaceAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/BrandLockup";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/lib/nav";
import { CommandPalette } from "./components/CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const account = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");
  const initialize = useMutation(api.auth.initializeWorkspace);
  const [initialized, setInitialized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    initialize({}).then(() => { if (active) setInitialized(true); }).catch(() => {
      if (active) setError("Workspace setup failed. Reload to try again, or choose another workspace.");
    });
    return () => { active = false; };
  }, [isAuthenticated, initialize]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated || account === null) window.location.replace("/login");
    else if (initialized && account && !account.workspace) window.location.replace("/workspaces");
  }, [isLoading, isAuthenticated, initialized, account]);
  if (error) return <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 p-6"><h1 className="font-display text-3xl">Workspace Unavailable</h1><p role="alert">{error}</p><Button asChild><Link href="/workspaces">Choose a Workspace</Link></Button></main>;
  if (!initialized || !account?.workspace) return <main className="flex min-h-svh items-center justify-center text-muted-foreground" role="status">Connecting your workspace…</main>;
  const workspace = account.workspace;
  const user = { ...account.user, firstName: account.user.name.split(" ")[0] };
  const signOut = async () => {
    const result = await authClient.signOut();
    if (result.error) { setError("Sign-out failed. Please try again."); return; }
    window.location.assign("/login");
  };
  const context: WorkspaceAuth = { user, organizationId: workspace.organizationId,
    authOrganizationId: workspace.authOrganizationId, role: workspace.role, loading: false, signOut };
  return <WorkspaceAuthContext value={context}>
    <div className="min-h-svh bg-background text-foreground font-sans">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:p-3 focus:text-primary-foreground">Skip to Content</a>
      <CommandPalette />
      <div className="flex min-h-svh flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card p-4 text-card-foreground md:sticky md:top-0 md:h-svh md:w-60 md:overflow-y-auto md:border-b-0 md:border-r md:p-5">
          <div className="flex items-center justify-between gap-4"><Link href="/" aria-label="ALIAS UCE home"><BrandLockup stacked /></Link><Button variant="outline" className="md:hidden" aria-expanded={menuOpen} aria-controls="workspace-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close Menu" : "Menu"}</Button></div>
          <div id="workspace-menu" className={`${menuOpen ? "flex" : "hidden"} flex-col gap-6 md:flex`}>
          <div className="flex flex-col gap-3"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Workspace</span><Link href="/workspaces" className="text-sm underline underline-offset-4">Switch</Link></div><WorkspaceLabel /><p className="truncate text-sm text-muted-foreground">{user.email}</p><div className="flex items-center justify-between"><span className="text-sm capitalize">{workspace.role}</span><Link href="/account" className="text-sm underline underline-offset-4">Account</Link></div></div>
          <nav aria-label="Workspace navigation" className="flex flex-col gap-5">{NAV_GROUPS.map((group) => <div key={group.label} className="flex flex-col gap-2"><p className="text-sm uppercase tracking-widest text-muted-foreground">{group.label}</p><div className="grid grid-cols-2 gap-1 md:flex md:flex-col">{group.links.map((link) => { const selected = pathname === link.href || pathname.startsWith(`${link.href}/`); return <Link key={link.href} href={link.href} prefetch={false} aria-current={selected ? "page" : undefined} className={`rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>{link.label}</Link>; })}</div></div>)}</nav>
          <Button variant="outline" onClick={signOut}>Sign Out</Button>
          </div>
        </aside>
        <main id="workspace-content" key={workspace.organizationId} className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</main>
      </div>
    </div>
  </WorkspaceAuthContext>;
}

function WorkspaceLabel() {
  const { data } = authClient.useActiveOrganization();
  return <p className="break-words font-medium">{data?.name ?? "Your Workspace"}</p>;
}
