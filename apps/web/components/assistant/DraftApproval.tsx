"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function DraftApproval({ requestId }: { requestId: string }) {
  const { organizationId } = useAuth();
  const operations = useQuery(api.assistantOperations.listOperations, { organizationId, requestId });
  const commit = useMutation(api.assistantOperations.commitDraft);
  const cancel = useMutation(api.assistantOperations.cancelRequest);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <>{operations?.map(operation => <section key={operation._id} className="flex flex-col gap-4 rounded-md border border-border bg-background p-4 text-foreground" aria-label="Document change approval">{operation.status === "committed" && operation.resultId ? <><h3 className="font-medium">Draft Saved</h3><Link className="min-h-11 py-3 text-sm underline underline-offset-4" href={`/documents?doc=${encodeURIComponent(operation.resultId)}`}>Open Saved Draft</Link><p className="text-sm text-muted-foreground">Knowledge answering remains disabled until manual review.</p></> : operation.status === "cancelled" ? <p className="text-sm">Proposal cancelled. Nothing was saved.</p> : <><h3 className="font-medium">Review Before Saving</h3><p className="text-sm text-muted-foreground">{operation.kind === "create" ? "Create a new draft" : "Replace document content"}. Expires 5 minutes after the request began.</p>{operation.kind === "edit" && <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Current Version: {operation.beforeTitle}</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm leading-relaxed text-muted-foreground">{operation.beforeContent}</pre></details>}<p className="break-words text-sm font-medium">Proposed: {operation.title}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm leading-relaxed text-muted-foreground">{operation.content}</pre><div className="flex flex-wrap gap-3"><Button disabled={pending} onClick={async () => { setPending(true); setError(""); try { await commit({ organizationId, operationId: operation._id }); } catch { setError("Could not save. This proposal may have expired or the document changed. Prepare a new proposal."); } finally { setPending(false); } }}>{pending ? "Saving…" : "Confirm & Save Draft"}</Button><Button variant="outline" disabled={pending} onClick={async () => { setPending(true); try { await cancel({ organizationId, requestId }); } catch { setError("Cancellation failed. Try again."); } finally { setPending(false); } }}>Discard</Button></div></>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>)}</>;
}
