"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { AssistantReadResult } from "@agent-knowledge/shared";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { safeAssistantHref } from "@/lib/assistant/presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AssistantResult } from "./AssistantResult";
import { DraftApproval } from "./DraftApproval";

type Turn = { id: string; question: string; text: string; message?: string; error?: string; sources?: { id: string; title: string; href: string }[]; discoveries?: AssistantReadResult[] };
const subscribeMedia = (notify: () => void) => { const media = window.matchMedia("(min-width: 1280px)"); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify); };
export function AssistantCompanion({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { organizationId, authOrganizationId } = useAuth();
  const desktop = useSyncExternalStore(subscribeMedia, () => window.matchMedia("(min-width: 1280px)").matches, () => false);
  const [open, setOpen] = useState(false);
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  const [question, setQuestion] = useState("");
  const [agentId, setAgentId] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [voice, setVoice] = useState("");
  const [checkingVoice, setCheckingVoice] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<{ id: string; controller: AbortController } | null>(null);
  const cancel = useMutation(api.assistantOperations.cancelRequest);
  const deleteHistory = useMutation(api.assistantOperations.deleteHistory);
  const agents = useQuery(api.agents.listAgents, { organizationId, status: "active" });
  const history = useQuery(api.assistantOperations.history, historyEnabled ? { organizationId } : "skip");
  useEffect(() => {
    const launch = () => setOpen(true);
    const end = () => { const active = request.current; if (active) { active.controller.abort(); void cancel({ organizationId, requestId: active.id }).catch(() => undefined); } };
    window.addEventListener("alias:open-assistant", launch);
    window.addEventListener("pagehide", end);
    return () => { end(); window.removeEventListener("alias:open-assistant", launch); window.removeEventListener("pagehide", end); };
  }, [organizationId, cancel]);
  function updateTurn(id: string, change: Partial<Turn>) { setTurns(current => current.map(turn => turn.id === id ? { ...turn, ...change } : turn)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !question.trim()) return;
    const prompt = question.trim();
    const id = crypto.randomUUID();
    const controller = new AbortController();
    request.current = { id, controller }; setPending(true); setQuestion(""); setNotice("");
    setTurns(current => [...current.slice(-19), { id, question: prompt, text: "" }]);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id, question: prompt, ...(agentId ? { agentId } : {}), historyEnabled }), signal: controller.signal });
      if (!response.ok) { const result = await response.json(); throw new Error(typeof result.error === "string" ? result.error : "Assistant unavailable."); }
      if (!response.body) throw new Error("The response was empty. Try again.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let text = "";
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        if (request.current?.id !== id) { await reader.cancel(); break; }
        buffer += decoder.decode(chunk.value, { stream: true });
        if (buffer.length > 100_000) throw new Error("Response limit reached.");
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "text" && typeof event.delta === "string") { text += event.delta; updateTurn(id, { text }); }
          else if (event.type === "complete") updateTurn(id, { message: event.message, sources: event.sources, discoveries: event.discoveries });
          else if (event.type === "error") updateTurn(id, { error: event.error });
        }
      }
      setNotice("Assistant response complete. Review links or proposed changes below.");
    } catch (cause) { updateTurn(id, { error: controller.signal.aborted ? "Request cancelled. No pending proposal can be committed." : cause instanceof Error ? cause.message : "The request failed. Try again." }); }
    finally { if (request.current?.id === id) { request.current = null; setPending(false); } }
  }
  async function cancelTask() {
    const active = request.current; if (!active) return;
    active.controller.abort();
    try { await cancel({ organizationId, requestId: active.id }); setNotice("Request cancelled; pending proposals were discarded."); }
    catch { setNotice("Cancellation could not be confirmed. Do not approve this request; wait for its expiry."); }
  }
  const body = <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
    <div className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">Verified knowledge, workspace search, and drafts with your approval.</p><p className="text-sm text-muted-foreground">History is off by default. Open Documents, Find a title, and Show ontology graph work without model generation. No audio is recorded by this app.</p></div>
    <FieldGroup><Field><FieldLabel htmlFor="assistant-agent">Knowledge Agent</FieldLabel><select id="assistant-agent" className="ak-select" value={agentId} disabled={pending} onChange={event => setAgentId(event.target.value)}><option value="">Choose an agent for grounded answers</option>{agents?.map(agent => <option value={agent._id} key={agent._id}>{agent.name}</option>)}</select><p className="text-sm text-muted-foreground">Only verified, approved sources assigned to this active agent can support an answer.</p></Field></FieldGroup>
    {!turns.length && <div className="flex flex-col gap-2" aria-label="Example questions">{["Open Documents", "Find the onboarding policy", "Draft a decision note"].map(example => <Button key={example} variant="outline" className="justify-start" onClick={() => setQuestion(example)}>{example}</Button>)}</div>}
    <div className="flex flex-col gap-6" aria-label="Assistant conversation">{turns.map(turn => <section key={turn.id} className="flex flex-col gap-4"><h3 className="break-words text-sm font-medium">{turn.question}</h3>{turn.message ? <AssistantResult message={turn.message} fallback={turn.text} /> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{turn.text || (pending ? "Working with your workspace permissions…" : "")}</p>}{turn.error && <p role="alert" className="text-sm leading-relaxed text-destructive">{turn.error}</p>}{turn.sources && turn.sources.length > 0 && <div className="flex flex-col gap-2"><h4 className="text-sm font-medium">Sources</h4>{turn.sources.map((source, index) => { const href = safeAssistantHref(source.href); return href ? <Link key={source.id} href={href} className="min-h-11 break-words rounded-md border border-border p-3 text-sm underline underline-offset-4">[{index + 1}] {source.title}</Link> : null; })}</div>}{!turn.message && turn.discoveries?.map((result, index) => <div key={index} className="flex flex-col gap-2">{result.kind === "navigation" ? <AssistantLink href={result.href} title={`Open ${result.title}`} /> : <>{result.items.map(item => <AssistantLink key={item.id} href={item.href} title={item.title} />)}{!result.items.length && <p className="text-sm text-muted-foreground">No matching titles in this workspace.</p>}</>}</div>)}<DraftApproval requestId={turn.id} /></section>)}</div>
    <form onSubmit={submit} className="flex flex-col gap-3"><FieldGroup><Field><FieldLabel htmlFor="assistant-question">Ask ALIAS</FieldLabel><Input id="assistant-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} autoComplete="off" placeholder="Ask about this workspace…" onKeyDown={event => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} /></Field></FieldGroup><div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending || !question.trim()}>{pending ? "Working…" : "Send Question"}</Button>{pending && <Button type="button" variant="outline" onClick={cancelTask}>Cancel Task</Button>}<Button type="button" variant="outline" disabled={checkingVoice} onClick={async () => { setCheckingVoice(true); try { const response = await fetch("/api/assistant/voice", { cache: "no-store" }); const result = await response.json(); setVoice(result.reason ?? result.error ?? "Voice is unavailable."); } catch { setVoice("Could not check voice availability. Use text, or try again later."); } finally { setCheckingVoice(false); } }}>{checkingVoice ? "Checking Voice…" : "Start Voice"}</Button></div></form>
    {voice && <section className="flex flex-col gap-3 rounded-md border border-border p-3"><h3 className="text-sm font-medium">Voice Not Started</h3><p role="status" className="text-sm leading-relaxed">{voice}</p><a href={`/dashboard?workspace=${encodeURIComponent(authOrganizationId)}`} target="_blank" rel="noopener noreferrer" className="min-h-11 py-3 text-sm underline underline-offset-4">Open Workspace in New Tab</a></section>}
    <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">Privacy & History</summary><div className="flex flex-col gap-4"><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={historyEnabled} onChange={event => setHistoryEnabled(event.target.checked)} />Save new conversations for 7 days</label><p className="text-muted-foreground">Source excerpts go to the AI provider to answer your question. The app stores no transcript unless you enable history. Minimal request and operation receipts are retained separately. Provider retention policies still apply.</p>{history?.map(item => <details key={item._id}><summary className="min-h-11 cursor-pointer break-words py-3">{item.question}</summary><p className="text-muted-foreground">Saved response. Past approvals cannot be replayed.</p><AssistantResult message={item.message} fallback="Saved response could not be rendered. Ask again to retrieve current sources." /></details>)}<Button variant="outline" onClick={async () => { try { const result = await deleteHistory({ organizationId }); setNotice(result.remaining ? "Deleted a batch. Select Delete again to remove remaining history." : "Saved conversation history deleted."); } catch { setNotice("Could not delete history. Try again."); } }}>Delete Saved History</Button></div></details>
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{notice}</p>
  </div>;
  return <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal={!desktop}><DialogPrimitive.Trigger asChild><Button variant="outline" className="fixed bottom-5 right-5 min-h-11" aria-label="Open Ask ALIAS companion">Ask ALIAS</Button></DialogPrimitive.Trigger>{open && <DialogPrimitive.Portal>{!desktop && <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-background/90" />}<DialogPrimitive.Content aria-describedby="assistant-description" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-xl focus:outline-none"><header className="flex items-center justify-between border-b border-border p-5"><div className="flex flex-col gap-1"><DialogPrimitive.Title className="font-display text-2xl tracking-wide">Ask ALIAS</DialogPrimitive.Title><DialogPrimitive.Description id="assistant-description" className="text-sm text-muted-foreground">Your current workspace · {pending ? "Working" : "Ready"}</DialogPrimitive.Description></div><DialogPrimitive.Close asChild><Button variant="outline" aria-label="Collapse Ask ALIAS">Close</Button></DialogPrimitive.Close></header>{body}</DialogPrimitive.Content></DialogPrimitive.Portal>}</DialogPrimitive.Root>;
}
function AssistantLink({ href, title }: { href: string; title: string }) { const safe = safeAssistantHref(href); return safe ? <Link href={safe} className="min-h-11 break-words rounded-md border border-border p-3 text-sm underline underline-offset-4">{title}</Link> : null; }
