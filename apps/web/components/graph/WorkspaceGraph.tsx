"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "../../../../convex/_generated/api";
import { getCurrentOrgId } from "@/lib/org";
import { Button } from "@/components/ui/button";
import { GraphExplorer } from "./GraphExplorer";

export function WorkspaceGraph() {
  const auth = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const workosOrganizationId = "organizationId" in auth ? auth.organizationId : undefined;
  const organizationId = getCurrentOrgId(typeof workosOrganizationId === "string" ? workosOrganizationId : undefined);
  const snapshot = useQuery(api.knowledge.getGraphSnapshot, isAuthenticated ? { organizationId } : "skip");

  if (!isLoading && !isAuthenticated) {
    return <section className="graph-panel"><div className="graph-inspector-content"><h1 className="font-display text-3xl">Sign in to explore your company brain</h1><p className="text-sm leading-6 text-muted-foreground">Workspace knowledge and agent context are only available to authenticated members.</p><div><Button asChild><Link href="/login" prefetch={false}>Sign In</Link></Button></div></div></section>;
  }

  if (!snapshot || snapshot.organizationId !== organizationId) {
    return <div className="graph-panel" role="status"><p className="graph-scene-message">Loading your workspace knowledge and context…</p></div>;
  }

  return <GraphExplorer key={snapshot.organizationId} snapshot={snapshot} />;
}
