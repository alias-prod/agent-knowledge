"use client";
import { createContext, useContext } from "react";
import type { CurrentRole } from "@agent-knowledge/shared";

export type WorkspaceAuth = {
  user: { id: string; email: string; name: string; firstName: string };
  organizationId: string;
  authOrganizationId: string;
  role: Exclude<CurrentRole, "loading">;
  loading: false;
  signOut: () => Promise<void>;
};
export const WorkspaceAuthContext = createContext<WorkspaceAuth | null>(null);
export function useCurrentOrganization() { return useAuth().organizationId; }
export function useAuth(_options?: { ensureSignedIn?: boolean }) {
  const auth = useContext(WorkspaceAuthContext);
  if (!auth) throw new Error("Workspace authentication is not ready");
  return auth;
}
