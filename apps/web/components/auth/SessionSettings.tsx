"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { z } from "zod";

const sessionRows = z.array(z.object({ id: z.string(), token: z.string(), expiresAt: z.coerce.date(), userAgent: z.string().nullish() }));
type Sessions = z.infer<typeof sessionRows>;
export function SessionSettings() {
  const { data: current } = authClient.useSession();
  const [sessions, setSessions] = useState<Sessions | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    setPending(true); setNotice("");
    try { const result = await authClient.listSessions(); if (result.error || !result.data) throw new Error(); setSessions(sessionRows.parse(result.data)); }
    catch { setNotice("Could not load your sessions. Try again."); }
    finally { setPending(false); }
  }
  return <section className="ak-card flex flex-col gap-5"><h2 className="font-display text-2xl">Active Sessions</h2><p className="text-sm leading-relaxed text-muted-foreground">Inspect your signed-in devices and revoke individual sessions. Device names are supplied by the browser and are not proof of identity.</p><Button variant="outline" disabled={pending} onClick={load}>{pending ? "Loading…" : "Refresh Sessions"}</Button>{sessions && <ul className="flex flex-col gap-4">{sessions.map(session => <li key={session.id} className="flex flex-col gap-3 border-b border-border pb-4"><p className="break-words text-sm">{session.userAgent || "Unknown device"}{session.token === current?.session.token ? " · This session" : ""}</p><p className="text-sm text-muted-foreground">Expires {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.expiresAt))}</p><Button variant="outline" disabled={pending} onClick={async () => { setPending(true); try { const result = await authClient.revokeSession({ token: session.token }); if (result.error) throw new Error(); if (session.token === current?.session.token) window.location.assign("/login"); else { setSessions(rows => rows?.filter(row => row.id !== session.id) ?? []); setNotice("Session revoked."); } } catch { setNotice("Could not revoke this session. Try again."); } finally { setPending(false); } }}>Revoke Session</Button></li>)}</ul>}<p role="status" className="text-sm text-muted-foreground">{notice}</p></section>;
}
