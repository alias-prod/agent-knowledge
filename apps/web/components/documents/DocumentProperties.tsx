"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { DOCUMENT_LIMITS, KNOWLEDGE_TYPES, RELATIONSHIP_KINDS, type KnowledgeType, type RelationshipKind } from "@agent-knowledge/shared";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { documentError, type DocumentListing, type WorkspaceDocument } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend, FieldError } from "@/components/ui/field";

function properties(document: WorkspaceDocument) {
  return { title: document.title, category: document.category, documentType: document.documentType,
    parentId: document.parentId || "", sourceUrl: document.sourceUrl || "", relations: document.relations,
    allowedAgentIds: document.allowedAgentIds, canUseToAnswer: document.canUseToAnswer, canUseToAct: document.canUseToAct };
}

export function DocumentProperties({ document, listing, organizationId, open, onOpenChange }: {
  document: WorkspaceDocument; listing: DocumentListing; organizationId: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const save = useMutation(api.knowledge.saveDocumentMetadata);
  const [initial, setInitial] = useState(() => properties(document));
  const [draft, setDraft] = useState(initial);
  const [revision, setRevision] = useState(document.metadataRevision);
  const [relationKind, setRelationKind] = useState<RelationshipKind>("references");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = document.canEdit && !busy;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function close(value: boolean) {
    if (busy) return;
    if (!value && dirty && !window.confirm("Discard unsaved document properties?")) return;
    onOpenChange(value);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!draft.title.trim() || !draft.category.trim()) { setError("Enter both a title and a category."); return; }
    setBusy(true);
    try {
      await save({ organizationId, id: document.id, expectedRevision: revision, ...draft, parentId: draft.parentId ? draft.parentId as Id<"knowledge"> : undefined, sourceUrl: draft.sourceUrl || undefined });
      onOpenChange(false);
    } catch (error) { setError(documentError(error)); } finally { setBusy(false); }
  }

  function addRelation() {
    if (!target) return;
    if (draft.relations.some((relation) => relation.targetId === target && relation.kind === relationKind)) { setError("This relationship is already linked."); return; }
    setDraft({ ...draft, relations: [...draft.relations, { targetId: target as Id<"knowledge">, kind: relationKind }] });
    setTarget(""); setError("");
  }

  function reload() {
    const value = properties(document);
    setInitial(value); setDraft(value); setRevision(document.metadataRevision); setError("");
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Document Properties</DialogTitle><DialogDescription>These are live records in the Unified Context Engine. Changes to content, classification, links, or permissions return knowledge to draft for review.</DialogDescription></DialogHeader>
        <form className="flex flex-col gap-6" onSubmit={submit}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="doc-property-title">Title</FieldLabel><Input id="doc-property-title" required maxLength={DOCUMENT_LIMITS.title} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} disabled={!editable} /></Field>
            <Field><FieldLabel htmlFor="doc-property-type">Knowledge Type</FieldLabel><select id="doc-property-type" className="document-select" value={draft.documentType} onChange={(event) => setDraft({ ...draft, documentType: event.target.value as KnowledgeType })} disabled={!editable}>{KNOWLEDGE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></Field>
            <Field><FieldLabel htmlFor="doc-property-category">Category</FieldLabel><Input id="doc-property-category" required maxLength={64} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} disabled={!editable} /></Field>
            <Field><FieldLabel htmlFor="doc-property-parent">Parent Document</FieldLabel><select id="doc-property-parent" className="document-select" value={draft.parentId} onChange={(event) => setDraft({ ...draft, parentId: event.target.value })} disabled={!editable}><option value="">Workspace Root</option>{draft.parentId && !listing.documents.some((row) => row.id === draft.parentId) && <option value={draft.parentId}>Current Parent (outside loaded list)</option>}{listing.documents.filter((row) => row.id !== document.id).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></Field>
            <Field><FieldLabel htmlFor="doc-property-source">Source URL</FieldLabel><Input id="doc-property-source" type="url" maxLength={2048} placeholder="https://example.com/source…" value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} disabled={!editable} /><FieldDescription>HTTPS sources only. External content is not imported automatically.</FieldDescription></Field>
            <FieldSet><FieldLegend>Knowledge Relationships</FieldLegend><FieldDescription>Explicit links appear in the graph and the target document&apos;s backlinks.</FieldDescription>
              {draft.relations.length > 0 && <ul className="flex flex-col gap-2">{draft.relations.map((relation, index) => <li key={`${relation.targetId}:${relation.kind}`} className="document-relationship-row"><span className="min-w-0 text-sm leading-6"><span className="text-muted-foreground">{RELATIONSHIP_KINDS.find((kind) => kind.id === relation.kind)?.label}{" "}</span>{listing.documents.find((row) => row.id === relation.targetId)?.title || "Linked document"}</span>{document.canEdit && <Button type="button" variant="ghost" size="icon" aria-label={`Remove relationship ${index + 1}`} disabled={busy} onClick={() => setDraft({ ...draft, relations: draft.relations.filter((_, i) => i !== index) })}><X aria-hidden="true" /></Button>}</li>)}</ul>}
              {document.canEdit && <FieldGroup><Field><FieldLabel htmlFor="doc-relation-kind">Relationship</FieldLabel><select id="doc-relation-kind" className="document-select" value={relationKind} onChange={(event) => setRelationKind(event.target.value as RelationshipKind)} disabled={busy}>{RELATIONSHIP_KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}</select></Field><Field><FieldLabel htmlFor="doc-relation-target">Related Document</FieldLabel><select id="doc-relation-target" className="document-select" value={target} onChange={(event) => setTarget(event.target.value)} disabled={busy}><option value="">Choose a Document</option>{listing.documents.filter((row) => row.id !== document.id).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></Field><Button type="button" variant="outline" disabled={busy || !target || draft.relations.length >= DOCUMENT_LIMITS.relations} onClick={addRelation}><Plus data-icon="inline-start" aria-hidden="true" />Add Relationship</Button></FieldGroup>}
            </FieldSet>
            <FieldSet><FieldLegend>Agent Permissions</FieldLegend><FieldDescription>Assignment does not grant automatic trust. Documents must also be verified and approved.</FieldDescription><label className="document-checkbox-label"><input type="checkbox" checked={draft.canUseToAnswer} onChange={(event) => setDraft({ ...draft, canUseToAnswer: event.target.checked })} disabled={!editable} />Enable Answer Permission</label><label className="document-checkbox-label"><input type="checkbox" checked={draft.canUseToAct} onChange={(event) => setDraft({ ...draft, canUseToAct: event.target.checked })} disabled={!editable} />Enable Action Permission</label><FieldDescription>Assigned agents</FieldDescription>{listing.agents.length ? listing.agents.map((agent) => <label key={agent.id} className="document-checkbox-label"><input type="checkbox" checked={draft.allowedAgentIds.includes(agent.id)} disabled={!editable} onChange={(event) => setDraft({ ...draft, allowedAgentIds: event.target.checked ? [...draft.allowedAgentIds, agent.id] : draft.allowedAgentIds.filter((id) => id !== agent.id) })} />{agent.name}</label>) : <p className="text-sm text-muted-foreground">No agents in this workspace.</p>}</FieldSet>
          </FieldGroup>
          {error && <FieldError>{error}</FieldError>}
          {revision !== document.metadataRevision && <div className="flex flex-col gap-3"><p role="status" className="text-sm text-muted-foreground">Properties changed in another session. Reload before saving to avoid overwriting them.</p><Button type="button" variant="outline" onClick={reload}>Reload Latest Properties</Button></div>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>Close</Button>{document.canEdit && <Button type="submit" disabled={busy || revision !== document.metadataRevision}>{busy ? "Saving…" : "Save Properties"}</Button>}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
