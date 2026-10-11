"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { History, RotateCcw } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { documentError, type WorkspaceDocument } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DocumentPreview } from "./DocumentPreview";

export function DocumentHistory({ document, organizationId, open, onOpenChange, canRestore }: { document: WorkspaceDocument; organizationId: string; open: boolean; onOpenChange: (open: boolean) => void; canRestore: boolean }) {
  const versions = useQuery(api.knowledge.listDocumentVersions, open ? { organizationId, id: document.id } : "skip");
  const restore = useMutation(api.knowledge.restoreDocumentVersion);
  const [selectedId, setSelectedId] = useState<Id<"knowledgeVersions"> | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(document.updatedAt);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = versions?.find((version) => version.id === selectedId);
  const changed = document.updatedAt !== expectedUpdatedAt;
  async function restoreSelected() {
    if (!selected) return;
    setBusy(true); setError("");
    try { await restore({ organizationId, id: document.id, versionId: selected.id, expectedUpdatedAt }); onOpenChange(false); setConfirm(false); setSelectedId(null); }
    catch (error) { setError(documentError(error)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) { onOpenChange(value); setConfirm(false); setError(""); } }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Version History</DialogTitle><DialogDescription>Up to 30 recent checkpoints. Autosave preserves periodic snapshots; Save Version adds an explicit checkpoint.</DialogDescription></DialogHeader>
        {error && <Alert><AlertTitle>Restore Could Not Complete</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="document-history-layout"><nav className="document-version-list" aria-label="Document versions">{versions === undefined ? <p role="status" className="text-sm text-muted-foreground">Loading versions…</p> : !versions.length ? <p className="text-sm leading-6 text-muted-foreground">No checkpoints yet. Save a version from the editor.</p> : versions.map((version) => <button type="button" key={version.id} className={cn("document-version", version.id === selectedId && "is-selected")} aria-pressed={version.id === selectedId} onClick={() => { setSelectedId(version.id); setExpectedUpdatedAt(document.updatedAt); setConfirm(false); setError(""); }}><span className="flex items-center gap-2"><History className="size-4 shrink-0" aria-hidden="true" />{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(version.createdAt)}</span><span className="block break-all text-sm text-muted-foreground">{version.changedByEmail || "Workspace editor"}</span></button>)}</nav><div className="min-w-0">{selected ? <><h3 className="px-6 font-display text-2xl text-balance">{selected.title}</h3><DocumentPreview content={selected.content} /></> : <p className="p-6 text-sm leading-6 text-muted-foreground">Choose a checkpoint to inspect its contents before restoring.</p>}</div></div>
        {confirm && <Alert><AlertTitle>Restore This Checkpoint?</AlertTitle><AlertDescription>This replaces the title and content for everyone. The current version is preserved first. Agent permissions stay unchanged, and the restored document returns to draft for review.</AlertDescription></Alert>}
        {changed && selected && <p role="status" className="text-sm leading-6 text-muted-foreground">The document changed while you were reviewing history. Select the checkpoint again to review and confirm against the latest document.</p>}
        {!canRestore && <p className="text-sm leading-6 text-muted-foreground">Wait for your edits to sync before restoring a version.</p>}
        <DialogFooter><Button variant="outline" onClick={() => { if (confirm) setConfirm(false); else onOpenChange(false); }} disabled={busy}>{confirm ? "Cancel Restore" : "Close"}</Button>{document.canEdit && selected && <Button disabled={busy || !canRestore || changed} onClick={() => confirm ? void restoreSelected() : setConfirm(true)}><RotateCcw data-icon="inline-start" aria-hidden="true" />{busy ? "Restoring…" : confirm ? "Confirm Restore" : "Restore Version"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
