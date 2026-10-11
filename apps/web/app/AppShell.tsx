"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { usePathname } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getCurrentOrgId } from "@/lib/org";
import { useCurrentRole } from "@/lib/useCurrentRole";
import { CommandPalette } from "./components/CommandPalette";
import { BrandLockup } from "@/components/BrandLockup";
import { PRODUCT_NAME } from "@/lib/brand";
import { NAV_GROUPS } from "@/lib/nav";


export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth({ ensureSignedIn: true });
  const { user, signOut, loading } = auth;

  const pathname = usePathname();
  const upsertCurrentUser = useMutation(api.users.upsertCurrentUser);

  const organizationId =
    "organizationId" in auth ? auth.organizationId : undefined;

  const switchToOrganization =
    "switchToOrganization" in auth ? auth.switchToOrganization : undefined;

  const currentOrgId = getCurrentOrgId(organizationId);

  const currentRole = useCurrentRole();

  useEffect(() => {
    if (loading || !user?.id || !user?.email || !currentOrgId) return;

    void upsertCurrentUser({
      workosUserId: user.id,
      email: user.email,
      name: user.firstName ?? undefined,
      organizationId: currentOrgId,
    });
  }, [
    loading,
    user?.id,
    user?.email,
    user?.firstName,
    currentOrgId,
    upsertCurrentUser,
  ]);

  function navClass(href: string) {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    return `block rounded-xl border px-3 py-2.5 text-sm font-medium transition ${isActive
      ? "border-neutral-200 bg-white text-neutral-950 shadow-sm"
      : "border-transparent text-neutral-400 hover:border-neutral-800 hover:bg-white/[0.035] hover:text-white"
      }`;
  }

  const navGroups = NAV_GROUPS;


  return (
    <main className="min-h-screen bg-[#050505] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.035),_transparent_30%)] text-white">
      <CommandPalette />

      <div className="grid min-h-screen md:grid-cols-[280px_1fr]">
        <aside className="border-b border-neutral-800/90 bg-[#080808]/95 p-4 backdrop-blur-xl md:sticky md:top-0 md:h-screen md:overflow-y-auto md:border-b-0 md:border-r md:p-6">
          <div className="rounded-2xl border border-neutral-800/90 bg-[#0b0b0b] p-4 shadow-sm shadow-black/20">
            <Link href="/" aria-label={`${PRODUCT_NAME} home`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              <BrandLockup stacked />
            </Link>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Connected knowledge. Governed context.
            </p>

            <div className="mt-4 inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-[#080808] px-2 py-1 text-xs text-neutral-500">
              <span>Press</span>
              <kbd className="rounded border border-neutral-700 bg-neutral-950 px-1 text-neutral-300">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="rounded border border-neutral-700 bg-neutral-950 px-1 text-neutral-300">
                K
              </kbd>
            </div>

          </div>

          <nav className="mt-6">
            <div className="grid grid-cols-2 gap-5 md:block">
              {navGroups.map((group, groupIndex) => (
                <div
                  key={group.label}
                  className={`col-span-2 ${groupIndex === 0 ? "md:mt-0" : "md:mt-5"}`}
                >
                  <p className="px-3 text-xs font-medium uppercase tracking-[0.14em] text-neutral-600">
                    {group.label}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 md:flex md:flex-col">
                    {group.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        prefetch={false}
                        className={navClass(link.href)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>


            <div className="col-span-2 mt-4 rounded-2xl border border-neutral-800/90 bg-[#0b0b0b] p-4 shadow-sm shadow-black/20 md:mt-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Organization
              </p>
              <p className="mt-2 break-all text-sm font-medium text-neutral-200">
                {currentOrgId}
              </p>

              {switchToOrganization && (
                <button
                  type="button"
                  onClick={() => switchToOrganization(currentOrgId)}
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-neutral-800 bg-[#080808] px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
                >
                  Use WorkOS organization
                </button>
              )}
            </div>

            <div className="col-span-2 mt-4 rounded-2xl border border-neutral-800/90 bg-[#0b0b0b] p-4 shadow-sm shadow-black/20 md:mt-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Signed in as
              </p>
              <p className="mt-2 truncate text-sm font-medium text-neutral-200">
                {user?.email ?? "Loading user..."}
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Role
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                {currentRole === "loading" ? "Loading..." : currentRole}
              </p>

              <button
                type="button"
                onClick={() => signOut()}
                className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-neutral-800 bg-[#080808] px-3 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
              >
                Sign out
              </button>
            </div>

          </nav>
        </aside>

        <section className="min-w-0 px-4 py-6 sm:px-5 md:px-8 md:py-8 lg:px-10">
          {children}
        </section>
      </div>
    </main>
  );
}
