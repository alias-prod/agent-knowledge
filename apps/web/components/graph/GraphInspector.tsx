"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink, Focus, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExplorerNode, GraphModel } from "@/lib/graph";

export function GraphInspector({ node, model, onSelect, onFocus }: { node?: ExplorerNode; model: GraphModel; onSelect: (id: string) => void; onFocus: (id: string) => void }) {
  const [edgeLimit, setEdgeLimit] = useState(8);
  const edges = node?.entityId ? model.edges.filter((edge) => edge.source === node.entityId || edge.target === node.entityId) : [];

  return (
    <section id="graph-inspector" tabIndex={-1} className="graph-panel scroll-mt-6" aria-labelledby="graph-inspector-title" aria-live="polite">
      <div className="graph-panel-heading">
        <h2 id="graph-inspector-title" className="text-base font-medium">Node Inspector</h2>
        {node && <span className="text-sm capitalize text-muted-foreground">{node.kind}</span>}
      </div>
      {!node ? (
        <div className="graph-inspector-empty">
          <MousePointer2 className="size-6 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-medium text-foreground">Follow a connection</h3>
          <p className="max-w-sm text-pretty text-center text-sm leading-6 text-muted-foreground">Select a region in the brain or a node in the list to inspect its attributes and recorded relationships.</p>
        </div>
      ) : (
        <div className="graph-inspector-content">
          <div>
            <p className="mb-2 break-words text-sm leading-6 text-muted-foreground">{model.index.get(node.id)?.path.slice(0, -1).flatMap((id) => { const ancestor = model.index.get(id)?.node; return ancestor && !ancestor.layoutOnly ? [ancestor.title] : []; }).join(" / ")}</p>
            <h3 className="break-words font-display text-3xl leading-tight tracking-wide text-balance">{node.title}</h3>
            {node.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{node.description}</p>}
          </div>
          {node.facts && (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {node.facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                  <dd className="mt-1 break-words text-sm leading-6">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onFocus(node.id)}><Focus data-icon="inline-start" aria-hidden="true" />Focus Node</Button>
            {node.documentHref && <Button asChild><Link href={node.documentHref} prefetch={false}>Open Document<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button>}
            {node.href && <Button asChild variant={node.documentHref ? "outline" : "default"}><Link href={node.href} prefetch={false}>{node.documentHref ? "Governance Record" : "Open Record"}<ArrowRight data-icon="inline-end" aria-hidden="true" /></Link></Button>}
            {node.sourceUrl && <Button asChild variant="outline"><a href={node.sourceUrl} target="_blank" rel="noopener noreferrer">Original Source<ExternalLink data-icon="inline-end" aria-hidden="true" /></a></Button>}
          </div>
          <div>
            <h4 className="text-sm font-medium">{node.kind === "type" ? "Schema Relationships" : "Recorded Relationships"} <span className="text-muted-foreground">({edges.length})</span></h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Connections use the full loaded snapshot, including nodes outside the current filters.</p>
            {edges.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {edges.slice(0, edgeLimit).map((edge) => {
                  const targetId = edge.source === node.entityId ? edge.target : edge.source;
                  const source = model.index.get(edge.source)?.node;
                  const target = model.index.get(edge.target)?.node;
                  if (!source || !target) return null;
                  return (
                    <li key={`${edge.source}:${edge.label}:${edge.target}`}>
                      <button type="button" className="graph-relationship" onClick={() => onSelect(targetId)}>
                        <span className="break-words text-sm leading-6">{source.title} <span className="text-primary">{`→ ${edge.label} →`}</span> {target.title}</span>
                        <span className="block text-sm leading-6 text-muted-foreground">{edge.description}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-2 text-sm leading-6 text-muted-foreground">{node.children?.length ? "Open a child node to inspect its relationships." : "No recorded relationships in this view. The brain mesh does not imply a data connection."}</p>}
            {edges.length > edgeLimit && <Button variant="ghost" onClick={() => setEdgeLimit((limit) => limit + 20)}>Show More Relationships</Button>}
          </div>
        </div>
      )}
    </section>
  );
}
