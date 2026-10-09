"use client";

import Link from "next/link";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { type ReactNode, useCallback, useState } from "react";
import {
  useAccessToken,
  useAuth as useWorkOSAuth,
} from "@workos-inc/authkit-nextjs/components";

// Bridges WorkOS AuthKit's auth state to the { isLoading, isAuthenticated,
// fetchAccessToken } shape ConvexProviderWithAuth expects, so ctx.auth.getUserIdentity()
// in Convex functions resolves to the signed-in WorkOS user. See convex/auth.config.ts
// for the corresponding JWT verification setup.
function useAuthForConvex() {
  const { user, loading } = useWorkOSAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      const token = forceRefreshToken
        ? await refresh()
        : await getAccessToken();
      return token ?? null;
    },
    [user, getAccessToken, refresh]
  );

  return {
    isLoading: loading,
    isAuthenticated: !loading && user !== null,
    fetchAccessToken,
  };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [convex] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
    return url ? new ConvexReactClient(url) : null;
  });

  if (!convex) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 font-sans">
        <section
          className="ak-card w-full max-w-lg"
          aria-labelledby="convex-configuration-title"
        >
          <h1 id="convex-configuration-title" className="ak-header-title text-balance">
            Workspace connection unavailable
          </h1>
          <p className="ak-header-description">
            The Convex deployment URL is missing from this environment. The
            workspace cannot load until its backend configuration is available.
          </p>
          <p className="ak-header-description">
            Required setting: <code className="break-all">NEXT_PUBLIC_CONVEX_URL</code>.
          </p>
          <div className="mt-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ak-button-primary"
              >
                Reload
              </button>
              <Link href="/ontology" className="ak-button-secondary">
                Explore the schema
              </Link>
              <Link href="/" className="ak-button-secondary">
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
