"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Check, Download, History, Network, Save, Settings2 } from "lucide-react";
import { documentGraphHref, KNOWLEDGE_TYPES } from "@agent-knowledge/shared";
import { api } from "../../../../convex/_generated/api";
import { documentError, downloadDocument, updateDocumentParams, type DocumentListing, type WorkspaceDocument } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import type { DocumentEditorHandle, SaveState } from "./CollaborativeEditor";
import { DocumentPreview } from "./DocumentPreview";
import { DocumentContext } from "./DocumentContext";
import { DocumentProperties } from "./DocumentProperties";
import { DocumentHistory } from "./DocumentHistory";
import { useDocumentNavigationGuard } from "./use-document-navigation";

const CollaborativeEditor = dynamic(() => import("./CollaborativeEditor").then((module) => module.CollaborativeEditor), { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> });

export function DocumentDetail({ id, organizationId, listing }: { id: string; organizationId: string; listing: DocumentListing }) {
  const document = useQuery(api.knowledge.getDocument, { id, organizationId });
  if (document === undefined) return <div className="p-6" role="status" aria-label="Loading document"><Skeleton className="h-12 w-2/3" /><Skeleton className="mt-6 h-96 w-full" /></div>;
  if (!document) return <Empty><EmptyHeader><EmptyTitle>Document Not Found</EmptyTitle><EmptyDescription>This document may have been removed, or it belongs to another workspace. Choose a document from your library.</EmptyDescription></EmptyHeader></Empty>;
  return <EditorContent key={document.id} document={document} organizationId={organizationId} listing={listing} />;
}

function EditorContent({ document, organizationId, listing }: { document: WorkspaceDocument; organizationId: string; listing: DocumentListing }) {
  const params = useSearchParams();
  const mode = !document.canEdit || params.get("mode") === "preview" ? "preview" : "write";
  const sync = useMutation(api.knowledge.syncDocument);
  const checkpoint = useMutation(api.knowledge.createDocumentCheckpoint);
  const [content, setContent] = useState(document.content);
  const [saveState, setSaveState] = useState<SaveState>({ status: "saved" });
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const editorRef = useRef<DocumentEditorHandle | null>(null);
  const unsaved = saveState.status !== "saved";
  useDocumentNavigationGuard(unsaved);
  const persist = useCallback((update: ArrayBuffer) => sync({ organizationId, id: document.id, update }), [sync, organizationId, document.id]);
  const label = KNOWLEDGE_TYPES.find((type) => type.id === document.documentType)?.label ?? "Document";
  const displayContent = document.canEdit ? content : document.content;
  const words = displayContent.trim().split(/\s+/).filter(Boolean).length;

  async function saveVersion() {
    setCheckpointBusy(true); setError(""); setNotice("");
    try {
      await editorRef.current?.flush();
      await checkpoint({ organizationId, id: document.id });
      setNotice("Version saved to history.");
    } catch (error) { setError(documentError(error)); } finally { setCheckpointBusy(false); }
  }

  return (
    <div className="document-editing-layout">
      <div className="document-writing-pane">
        <header className="document-record-header">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{label}</Badge><Badge variant="secondary">{document.status === "verified" ? "Verified" : "Draft"}</Badge><span className="text-sm text-muted-foreground">{document.category}</span></div>
          <h2 className="document-title font-display text-balance">{document.title}</h2>
          <div className="document-record-actions">
            <div className="flex flex-wrap items-center gap-1"><Button variant="ghost" size="sm" onClick={() => setPropertiesOpen(true)}><Settings2 data-icon="inline-start" aria-hidden="true" />Properties</Button><Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}><History data-icon="inline-start" aria-hidden="true" />History</Button><Button variant="ghost" size="icon" aria-label="Export document as Markdown" onClick={() => downloadDocument(document.title, editorRef.current?.getContent() ?? displayContent)}><Download aria-hidden="true" /></Button></div>
            <Button variant="ghost" asChild size="sm"><Link href={documentGraphHref(document.id)} prefetch={false}><Network data-icon="inline-start" aria-hidden="true" />View in Graph<ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
          </div>
        </header>
        {error && <div className="px-5 py-3"><Alert><AlertTitle>Version Could Not Be Saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div>}
        {saveState.status === "error" && <div className="px-5 py-3"><Alert><AlertTitle>Edits Have Not Synced</AlertTitle><AlertDescription><p>{saveState.message} Keep this tab open or export your Markdown.</p><Button variant="outline" size="sm" onClick={() => void editorRef.current?.flush().catch(() => undefined)}>Retry Sync</Button></AlertDescription></Alert></div>}
        <Tabs value={mode} onValueChange={(value) => updateDocumentParams({ mode: value === "write" ? null : "preview" })}>
          <div className="document-editor-tabs"><TabsList aria-label="Document mode">{document.canEdit && <TabsTrigger value="write">Write</TabsTrigger>}<TabsTrigger value="preview">Preview</TabsTrigger></TabsList><span role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">{saveState.status === "saved" && <Check className="size-4" aria-hidden="true" />}{!document.canEdit ? "Read-only access" : saveState.status === "saved" ? "All changes synced" : saveState.status === "saving" ? "Syncing…" : saveState.status === "error" ? "Sync needs attention" : "Unsynced changes"}</span></div>
          {document.canEdit && <TabsContent value="write" forceMount className="data-[state=inactive]:hidden"><CollaborativeEditor id={document.id} state={document.collaborationState} readOnly={false} onSave={persist} onContent={setContent} onState={setSaveState} handleRef={editorRef} /></TabsContent>}
          <TabsContent value="preview"><DocumentPreview content={displayContent} /></TabsContent>
        </Tabs>
        <footer className="document-editor-footer"><p className="text-sm tabular-nums text-muted-foreground">{words.toLocaleString("en")} words · {displayContent.length.toLocaleString("en")} characters</p>{document.canEdit && <Button size="sm" variant="outline" disabled={checkpointBusy} onClick={() => void saveVersion()}><Save data-icon="inline-start" aria-hidden="true" />{checkpointBusy ? "Saving…" : "Save Version"}</Button>}</footer>
        <p className="document-save-notice" role="status">{notice || (document.canEdit ? "Live collaborative editing. Content changes return verified knowledge to draft for review." : "An owner or admin can edit and manage this document.")}</p>
      </div>
      <DocumentContext document={document} organizationId={organizationId} listing={listing} onEdit={() => setPropertiesOpen(true)} />
      <DocumentProperties key={propertiesOpen ? "open" : "closed"} document={document} listing={listing} organizationId={organizationId} open={propertiesOpen} onOpenChange={setPropertiesOpen} />
      <DocumentHistory document={document} organizationId={organizationId} open={historyOpen} onOpenChange={setHistoryOpen} canRestore={!unsaved} />
    </div>
  );
}
