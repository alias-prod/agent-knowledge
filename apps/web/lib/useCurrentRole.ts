"use client";
import { useAuth } from "./auth-context";
import type { CurrentRole } from "@agent-knowledge/shared";
export type { CurrentRole };
export function useCurrentRole(): CurrentRole { return useAuth().role; }
