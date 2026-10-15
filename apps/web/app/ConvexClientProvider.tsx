"use client";

import Link from "next/link";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { type ReactNode, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ConvexClientProvider({ children, initialToken }: { children: ReactNode; initialToken?: string | null }) {
  const [convex] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
    return url ? new ConvexReactClient(url) : null;
  });
  if (!convex) return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 font-sans">
      <section className="ak-card w-full max-w-lg" aria-labelledby="convex-configuration-title">
        <h1 id="convex-configuration-title" className="ak-header-title text-balance">Workspace connection unavailable</h1>
        <p className="ak-header-description">The Convex deployment URL is missing from this environment. The workspace cannot load until its backend configuration is available.</p>
        <p className="ak-header-description">Required setting: <code>NEXT_PUBLIC_CONVEX_URL</code>.</p>
        <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => window.location.reload()} className="ak-button-primary">Reload</button><Link href="/ontology" className="ak-button-secondary">Explore the schema</Link><Link href="/" className="ak-button-secondary">Back to home</Link></div>
      </section>
    </main>
  );
  return <ConvexBetterAuthProvider client={convex} authClient={authClient} initialToken={initialToken}>{children}</ConvexBetterAuthProvider>;
}
