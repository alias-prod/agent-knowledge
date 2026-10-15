"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useConvexAuth, useQuery } from "convex/react";
import { FilePlus2, FileText, FolderTree, Library, Network, Search, ShieldCheck } from "lucide-react";
import { KNOWLEDGE_TYPES, documentHref } from "@agent-knowledge/shared";
import { api } from "../../../../convex/_generated/api";
import { getCurrentOrgId } from "@/lib/org";
import { cn } from "@/lib/utils";
import { documentTree, updateDocumentParams, type DocumentListing } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from "@/components/ui/empty";
import { NewDocumentDialog } from "./NewDocumentDialog";
import { DocumentDetail } from "./DocumentDetail";

export function DocumentWorkspace() {
  const auth = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const organization = "organizationId" in auth ? auth.organizationId : undefined;
  const organizationId = getCurrentOrgId(typeof organization === "string" ? organization : undefined);
  const listing = useQuery(api.knowledge.listDocuments, isAuthenticated ? { organizationId } : "skip");
  if (!isLoading && !isAuthenticated) return (
    <Empty><EmptyHeader><EmptyMedia variant="icon"><ShieldCheck aria-hidden="true" /></EmptyMedia><EmptyTitle>Sign In to Your Documents</EmptyTitle><EmptyDescription>Documents use the same workspace membership and permissions as your company knowledge.</EmptyDescription></EmptyHeader><EmptyContent><Button asChild><Link href="/login" prefetch={false}>Sign In</Link></Button></EmptyContent></Empty>
  );
  if (!listing) return <div className="flex flex-col gap-6" role="status" aria-label="Loading documents"><Skeleton className="h-10 w-52" /><Skeleton className="h-8 w-full" /><Skeleton className="h-96 w-full" /></div>;
  return <WorkspaceContent key={organizationId} organizationId={organizationId} listing={listing} />;
}

function WorkspaceContent({ organizationId, listing }: { organizationId: string; listing: DocumentListing }) {
  const params = useSearchParams();
  const selectedId = params.get("doc");
  const search = params.get("q") ?? "";
  const type = params.get("type") ?? "all";
  const deferredSearch = useDeferredValue(search.toLocaleLowerCase());
  const [newOpen, setNewOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const newDocumentControl = useRef<HTMLButtonElement>(null);
  const filtered = useMemo(() => listing.documents.filter((doc) => (type === "all" || doc.documentType === type) &&
    [doc.title, doc.category, doc.excerpt].join(" ").toLocaleLowerCase().includes(deferredSearch)), [listing.documents, deferredSearch, type]);
  const rows = useMemo(() => documentTree(filtered), [filtered]);

  return (
    <div className="document-workspace font-sans" data-documents-ready="true">
      <header className="document-page-header">
        <div><p className="text-sm uppercase tracking-widest text-muted-foreground">{listing.organizationName} / Workspace</p><h1 className="mt-2 font-display text-4xl tracking-wide text-balance">Documents</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Collaborative documents, connected to your knowledge graph and ontology.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline"><Link href="/graph" prefetch={false}><Network data-icon="inline-start" aria-hidden="true" />Ontology Explorer</Link></Button>
          {listing.canEdit && <Button ref={newDocumentControl} onClick={() => setNewOpen(true)}><FilePlus2 data-icon="inline-start" aria-hidden="true" />New Document</Button>}
        </div>
      </header>
      <div className="document-workbench">
        <aside className="document-library" aria-label="Document library">
          <div className="document-library-heading"><span className="flex items-center gap-2"><FolderTree className="size-4" aria-hidden="true" />All Documents<span className="tabular-nums text-muted-foreground">{listing.documents.length}</span></span><Button variant="ghost" size="icon" className="lg:hidden" aria-label={treeOpen ? "Collapse document list" : "Expand document list"} aria-expanded={treeOpen} aria-controls="document-library-content" onClick={() => setTreeOpen(!treeOpen)}><Library aria-hidden="true" /></Button></div>
          <div id="document-library-content" className={cn("document-library-content", !treeOpen && selectedId && "hidden lg:flex")}>
            <div className="document-library-filters">
              <label className="sr-only" htmlFor="document-search">Search loaded documents</label>
              <div className="flex items-center gap-2"><Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><Input id="document-search" type="search" value={search} maxLength={200} placeholder="Search documents…" onChange={(event) => updateDocumentParams({ q: event.target.value || null })} /></div>
              <label className="sr-only" htmlFor="document-type-filter">Filter document type</label>
              <select id="document-type-filter" className="document-select" value={type} onChange={(event) => updateDocumentParams({ type: event.target.value === "all" ? null : event.target.value })}><option value="all">All Knowledge Types</option>{KNOWLEDGE_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
            </div>
            <nav className="document-tree" aria-label="Documents">
              {rows.map(({ document, depth }) => <Link key={document.id} href={documentHref(document.id)} prefetch={false} scroll={false} className={cn("document-tree-item", selectedId === document.id && "is-selected")} aria-current={selectedId === document.id ? "page" : undefined} style={{ paddingInlineStart: `${12 + Math.min(depth, 5) * 12}px` }} onClick={() => setTreeOpen(false)}><FileText className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0"><span className="block truncate">{document.title}</span><span className="block truncate text-sm text-muted-foreground">{document.documentType} · {document.status}</span></span></Link>)}
              {!rows.length && <p className="p-4 text-sm leading-6 text-muted-foreground">{listing.documents.length ? "No matching documents. Try another search or type." : "Your documents will appear here."}</p>}
            </nav>
            <footer className="document-library-footer"><p>{listing.truncated ? "Showing the 200 newest documents. Search applies to these records." : "Search matches titles, categories, and content excerpts."}</p><Link href="/knowledge" prefetch={false} className="document-text-link">Open Knowledge Library</Link></footer>
          </div>
        </aside>
        <section className="document-detail" aria-label="Selected document">
          {selectedId ? <DocumentDetail key={`${organizationId}:${selectedId}`} id={selectedId} organizationId={organizationId} listing={listing} /> : (
            <Empty className="min-h-96"><EmptyHeader><EmptyMedia variant="icon"><FileText aria-hidden="true" /></EmptyMedia><EmptyTitle>{listing.documents.length ? "Your Knowledge, Ready to Work On" : "Start With a Document"}</EmptyTitle><EmptyDescription>{listing.documents.length ? "Choose a document from the library to write, connect related knowledge, and follow its graph relationships." : "Create a document or import Markdown. It becomes a real knowledge record, with the same review process and agent permissions."}</EmptyDescription></EmptyHeader><EmptyContent>{listing.canEdit && <Button onClick={() => setNewOpen(true)}><FilePlus2 data-icon="inline-start" aria-hidden="true" />Create a Document</Button>}<Link href="/graph?lens=ontology&view=list" prefetch={false} className="document-text-link">Explore the Knowledge Ontology</Link></EmptyContent></Empty>
          )}
        </section>
      </div>
      <footer className="document-workspace-footer"><span className="flex items-center gap-2"><ShieldCheck className="size-4" aria-hidden="true" />One workspace. The same knowledge, permissions, and audit trail.</span><a href="https://github.com/DataRohit/Stash" target="_blank" rel="noopener noreferrer" className="document-text-link">Adapted from Stash</a></footer>
      <NewDocumentDialog open={newOpen} onOpenChange={setNewOpen} organizationId={organizationId} documents={listing.documents} fallbackFocusRef={newDocumentControl} onCreated={(id) => { updateDocumentParams({ doc: id, q: null, type: null }, true); setTreeOpen(false); }} />
    </div>
  );
}
