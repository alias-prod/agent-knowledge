"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, Box, Database, ListTree, LockKeyhole, Network, Pause, RotateCcw, RotateCw, Search, Waypoints } from "lucide-react";
import { GRAPH_LIMITS, type GraphSnapshot } from "@agent-knowledge/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brainForLens, buildGraphModel, filterGraphTree, graphViewSummary, GRAPH_LENSES, isGraphLens, listGraphNodes, type GraphLens, type GraphStatus } from "@/lib/graph";
import { GraphInspector } from "./GraphInspector";
import { GraphNodeList } from "./GraphNodeList";
import { GraphViewport } from "./GraphViewport";
import { GraphVoiceControls } from "./GraphVoiceControls";
import { useReducedMotion } from "./use-graph-preferences";

function setGraphParams(updates: Record<string, string | null>, push = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history[push ? "pushState" : "replaceState"](null, "", `${url.pathname}${url.search}${url.hash}`);
}

const lensIcons = { knowledge: Database, context: Waypoints, ontology: Network };

export function GraphExplorer({ snapshot }: { snapshot?: GraphSnapshot }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const live = Boolean(snapshot);
  const requestedLens = params.get("lens");
  const lens: GraphLens = isGraphLens(requestedLens) && (live || requestedLens === "ontology") ? requestedLens : live ? "knowledge" : "ontology";
  const status: GraphStatus = lens !== "ontology" && (params.get("status") === "verified" || params.get("status") === "draft") ? params.get("status") as GraphStatus : "all";
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const reducedMotion = useReducedMotion();
  const listView = params.get("view") === "list" || reducedMotion;
  const [rotate, setRotate] = useState(false);
  const [revision, setRevision] = useState(0);
  const model = useMemo(() => buildGraphModel(snapshot), [snapshot]);
  const selected = model.index.get(params.get("node") ?? "");
  const selectedNode = selected?.lens === lens ? selected.node : undefined;
  const focus = model.index.get(params.get("focus") ?? "");
  const focusedNode = focus?.lens === lens ? focus.node : undefined;
  const root = useMemo(() => {
    const lensRoot = model.lenses[lens];
    const focusedRoot = focusedNode ? { ...lensRoot, title: focusedNode.title, children: focusedNode.children?.length ? focusedNode.children : [focusedNode] } : lensRoot;
    return filterGraphTree(focusedRoot, deferredQuery, status);
  }, [model, lens, focusedNode, deferredQuery, status]);
  const nodes = useMemo(() => listGraphNodes(root), [root]);
  const brain = useMemo(() => brainForLens(model, root), [model, root]);
  const lensInfo = GRAPH_LENSES.find((item) => item.id === lens)!;
  const schemaEdges = model.edges.filter((edge) => edge.source.startsWith("type:")).length;
  const schemaTypes = [...model.index.values()].filter((entry) => entry.node.kind === "type").length;
  const summary = useMemo(() => graphViewSummary(nodes, model.edges), [nodes, model.edges]);
  const readout = selectedNode ? [selectedNode.title, selectedNode.description, ...(selectedNode.facts?.map((fact) => `${fact.label}: ${fact.value}`) ?? [])].filter(Boolean).join(". ") : undefined;
  const updateSearch = useCallback((value: string) => setGraphParams({ q: value || null, node: null }), []);
  const limited = snapshot && Object.values(snapshot.truncated).some(Boolean);

  const selectNode = useCallback((id: string) => {
    const entry = model.index.get(id);
    if (!entry) return;
    const outsideView = entry.lens !== lens || (!entry.node.layoutOnly && !nodes.some((node) => node.id === id));
    setGraphParams({ node: id, lens: entry.lens, ...(outsideView ? { focus: null, q: null, status: null } : {}) });
  }, [model, lens, nodes]);
  const selectBrainNode = useCallback((node: { id: string }) => selectNode(node.id), [selectNode]);
  const useListView = useCallback(() => setGraphParams({ view: "list" }), []);

  function resetView() {
    setGraphParams({ node: null, focus: null, q: null, status: null });
    setRotate(false);
    setRevision((value) => value + 1);
  }

  function viewHref(view: string) {
    const next = new URLSearchParams(params.toString());
    next.set("view", view);
    return `${pathname}?${next}`;
  }

  return (
    <div className="graph-explorer font-sans" data-graph-ready="true">
      <header className="graph-page-header">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">ALIAS / Unified Context Engine</p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-wide text-balance sm:text-5xl">Ontology Explorer</h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Explore connected documents, follow agent context, and inspect the ontology that defines your knowledge.</p>
        </div>
        <div className="graph-source-label"><span className="size-2 rounded-full bg-graph-secondary" aria-hidden="true" />{live ? "Live workspace" : "Application schema"}</div>
      </header>

      {!live && (
        <div className="graph-schema-note">
          <div className="min-w-0"><p className="text-sm font-medium">You&apos;re exploring the application ontology.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">These are real schema definitions, not sample company records. Sign in to explore your workspace&apos;s knowledge and context.</p></div>
          <Button asChild variant="outline"><Link href="/graph" prefetch={false}>Open Workspace<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button>
        </div>
      )}

      <div className="graph-lens-bar">
        <nav className="graph-lenses" aria-label="Graph lenses">
          {GRAPH_LENSES.map((item) => {
            const Icon = lensIcons[item.id];
            const isWorkspaceLens = !live && item.id !== "ontology";
            return <Link key={item.id} href={`${isWorkspaceLens ? "/graph" : pathname}?lens=${item.id}`} scroll={false} prefetch={false} className={cn("graph-lens", lens === item.id && "graph-lens-active")} aria-current={lens === item.id ? "page" : undefined} aria-label={isWorkspaceLens ? `${item.label} (workspace sign-in required)` : undefined}><Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />{item.label}{isWorkspaceLens && <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />}</Link>;
          })}
        </nav>
        <p className="text-sm tabular-nums text-muted-foreground">{live ? `${snapshot!.knowledge.length} records · ${snapshot!.agents.length} agents` : `${schemaTypes} entity types · ${schemaEdges} relationships`}</p>
      </div>

      <div className="graph-controls">
        <div className="graph-filter-bar" role="search" aria-label="Filter graph">
          <div className="graph-search"><Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><label htmlFor="graph-search" className="sr-only">Search graph nodes</label><input id="graph-search" type="search" value={query} maxLength={200} aria-describedby="graph-result-summary" placeholder="Search nodes, attributes, or context…" onChange={(event) => updateSearch(event.target.value)} /></div>
          {live && lens !== "ontology" && <div className="graph-status-filter"><label htmlFor="graph-status">Knowledge status</label><select id="graph-status" value={status} onChange={(event) => setGraphParams({ status: event.target.value === "all" ? null : event.target.value, node: null })}><option value="all">All statuses</option><option value="verified">Verified</option><option value="draft">Draft</option></select></div>}
          {(query || status !== "all") && <Button variant="ghost" onClick={() => setGraphParams({ q: null, status: null, node: null })}>Clear Filters</Button>}
        </div>
        <p id="graph-result-summary" className="text-sm leading-6 tabular-nums text-muted-foreground" role="status" aria-atomic="true">{query !== deferredQuery ? "Updating results…" : `${summary.entities} unique ${summary.entities === 1 ? "entity" : "entities"} · ${summary.attributes} ${summary.attributes === 1 ? "attribute" : "attributes"} · ${summary.relationships} ${summary.relationships === 1 ? "relationship" : "relationships"} between visible entities`}</p>
        <GraphVoiceControls key={`${lens}:${selectedNode?.id ?? "none"}`} onSearch={updateSearch} readout={readout} />
      </div>

      <section className="graph-stage-panel" aria-labelledby="graph-view-title">
        <div className="graph-toolbar">
          <div className="min-w-0"><h2 id="graph-view-title" className="truncate text-sm font-medium">{model.title} <span className="text-muted-foreground">/ {focusedNode?.title ?? lensInfo.label}</span></h2><p className="mt-1 text-sm text-muted-foreground">{lensInfo.description}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="graph-view-switch" aria-label="Visualization mode">
              {!reducedMotion && <Link href={viewHref("3d")} prefetch={false} scroll={false} aria-current={!listView ? "page" : undefined}><Box className="size-4" aria-hidden="true" />3D</Link>}
              <Link href={viewHref("list")} prefetch={false} scroll={false} aria-current={listView ? "page" : undefined}><ListTree className="size-4" aria-hidden="true" />List</Link>
            </nav>
            {!listView && <Button variant="ghost" size="icon" aria-label={rotate ? "Pause brain rotation" : "Rotate brain"} aria-pressed={rotate} onClick={() => setRotate((value) => !value)}>{rotate ? <Pause aria-hidden="true" /> : <RotateCw aria-hidden="true" />}</Button>}
            <Button variant="ghost" size="icon" aria-label="Reset graph view" onClick={resetView}><RotateCcw aria-hidden="true" /></Button>
          </div>
        </div>
        {focusedNode && <div className="graph-focus-trail"><Button variant="link" onClick={() => setGraphParams({ focus: null, node: null })}>All {lensInfo.label}</Button><span className="truncate text-sm text-muted-foreground">/ {focusedNode.title}</span></div>}
        {reducedMotion && <p className="graph-motion-note">List view is enabled to respect your reduced-motion preference.</p>}
        {!listView && (nodes.length ? (
          <GraphViewport key={`${lens}:${focusedNode?.id ?? ""}:${deferredQuery}:${status}:${revision}`} data={brain} rotate={rotate} onSelect={selectBrainNode} onListView={useListView} />
        ) : (
          <div className="graph-scene-message"><Network className="size-6 text-primary" aria-hidden="true" /><h3 className="text-lg font-medium text-foreground">{query || status !== "all" ? "No matching knowledge" : "Your graph starts with knowledge"}</h3><p className="max-w-sm text-center text-sm leading-6">{query || status !== "all" ? "Clear your search or filters to see more nodes." : "Add knowledge and assign it to agents. The graph will update automatically."}</p>{query || status !== "all" ? <Button variant="outline" onClick={resetView}>Clear Filters</Button> : <Button asChild><Link href="/knowledge" prefetch={false}>Add Knowledge<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button>}</div>
        ))}
        <div className="graph-stage-caption"><p>{listView ? "Select a node below to inspect its attributes." : "Drag to orbit, or use Browse Nodes below without dragging. Scroll to move down the page."}</p>{!listView && <p className="graph-compact-hint">Scroll the entity cards sideways to explore more regions.</p>}<p>Mesh lines illustrate the hierarchy—not stored relationships. Size and color do not measure importance.</p>{selectedNode && <a href="#graph-inspector" className="graph-inspect-link">Inspect {selectedNode.title}<ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>}</div>
      </section>

      <div className="graph-details-grid">
        <GraphNodeList key={`${lens}:${focusedNode?.id ?? ""}:${deferredQuery}:${status}:${selectedNode?.id ?? ""}`} nodes={nodes} selectedId={selectedNode?.id} onSelect={selectNode} />
        <GraphInspector key={selectedNode?.id ?? "none"} node={selectedNode} model={model} onSelect={selectNode} onFocus={(id) => { setGraphParams({ focus: id, q: null, node: id }); document.getElementById("graph-view-title")?.scrollIntoView({ behavior: "instant", block: "start" }); }} />
      </div>
      <footer className="graph-footer">
        <p>{live ? `${limited ? "Limited snapshot. " : ""}Loads up to ${GRAPH_LIMITS.knowledge} recent knowledge records, ${GRAPH_LIMITS.agents} agents, and ${GRAPH_LIMITS.retrievals} retrievals. Search and connections apply to the loaded snapshot.` : "Schema view is read-only. No workspace records or personal data are loaded."}</p>
        <a href="https://github.com/kobimantzur/company-brain-3d" target="_blank" rel="noopener noreferrer">Built with Company Brain 3D<ArrowRight className="size-4" aria-hidden="true" /></a>
      </footer>
    </div>
  );
}
