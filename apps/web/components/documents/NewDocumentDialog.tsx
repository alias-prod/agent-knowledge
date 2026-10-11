"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";
import { useMutation } from "convex/react";
import { Upload } from "lucide-react";
import { DOCUMENT_LIMITS, KNOWLEDGE_TYPES, type KnowledgeType } from "@agent-knowledge/shared";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { documentError, type DocumentSummary } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";

export function NewDocumentDialog({ open, onOpenChange, organizationId, documents, onCreated, fallbackFocusRef }: {
  open: boolean; onOpenChange: (open: boolean) => void; organizationId: string;
  documents: DocumentSummary[]; onCreated: (id: string) => void;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const create = useMutation(api.knowledge.createDocument);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<KnowledgeType>("document");
  const [parentId, setParentId] = useState("");
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const openingControl = useRef<HTMLElement | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) { setError("Enter a document title."); titleInput.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      const id = await create({ organizationId, title, documentType: type, content, parentId: parentId ? parentId as Id<"knowledge"> : undefined });
      onCreated(id); onOpenChange(false); setTitle(""); setContent(""); setFilename(""); setParentId("");
    } catch (error) { setError(documentError(error)); } finally { setBusy(false); }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (!/\.(md|markdown|txt)$/i.test(file.name)) throw new Error("Choose a Markdown (.md) or plain-text (.txt) file.");
      if (file.size > DOCUMENT_LIMITS.content * 4) throw new Error("This file is too large. Import a document with no more than 20,000 characters.");
      const value = await file.text();
      if (value.length > DOCUMENT_LIMITS.content) throw new Error("This file is too large. Import a document with no more than 20,000 characters.");
      setContent(value); setFilename(file.name);
      if (!title) setTitle(file.name.replace(/\.(md|markdown|txt)$/i, "").slice(0, DOCUMENT_LIMITS.title));
    } catch (error) { setError(documentError(error)); }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogContent
        showCloseButton={!busy}
        onOpenAutoFocus={() => {
          openingControl.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = openingControl.current?.isConnected ? openingControl.current : fallbackFocusRef?.current;
          target?.focus();
        }}
      ><DialogHeader><DialogTitle>New Document</DialogTitle><DialogDescription>Create connected knowledge. New documents start as drafts and are not available to agents until reviewed and assigned.</DialogDescription></DialogHeader>
        <form className="flex flex-col gap-6" onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="new-document-title">Title</FieldLabel><Input ref={titleInput} id="new-document-title" value={title} maxLength={DOCUMENT_LIMITS.title} onChange={(event) => setTitle(event.target.value)} placeholder="Customer onboarding playbook…" aria-describedby={error ? "new-document-error" : undefined} aria-invalid={Boolean(error)} disabled={busy} /></Field>
            <Field><FieldLabel htmlFor="new-document-type">Knowledge Type</FieldLabel><select id="new-document-type" className="document-select" value={type} onChange={(event) => setType(event.target.value as KnowledgeType)} disabled={busy}>{KNOWLEDGE_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><FieldDescription>{KNOWLEDGE_TYPES.find((item) => item.id === type)?.description}</FieldDescription></Field>
            <Field><FieldLabel htmlFor="new-document-parent">Location</FieldLabel><select id="new-document-parent" className="document-select" value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={busy}><option value="">Workspace Root</option>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></Field>
            <Field><FieldLabel>Start From a File</FieldLabel><input ref={fileInput} type="file" className="sr-only" accept=".md,.markdown,.txt,text/markdown,text/plain" aria-label="Import Markdown file" onChange={(event) => void importFile(event.target.files?.[0])} disabled={busy} /><Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}><Upload data-icon="inline-start" aria-hidden="true" />Import Markdown</Button><FieldDescription>{filename ? `${filename} · ${content.length.toLocaleString("en")} characters` : "Optional. Markdown or plain text, up to 20,000 characters."}</FieldDescription></Field>
          </FieldGroup>
          {error && <FieldError id="new-document-error">{error}</FieldError>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create Document"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
