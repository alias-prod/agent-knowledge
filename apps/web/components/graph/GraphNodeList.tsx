"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExplorerNode } from "@/lib/graph";

const PAGE_SIZE = 16;

export function GraphNodeList({ nodes, selectedId, onSelect }: { nodes: ExplorerNode[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(nodes.length / PAGE_SIZE) - 1));
  const visible = nodes.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section className="graph-panel" aria-labelledby="graph-nodes-title">
      <div className="graph-panel-heading">
        <h2 id="graph-nodes-title" className="text-base font-medium">Browse Nodes</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{nodes.length} in this view</span>
      </div>
      <ul className="graph-node-list" aria-label="Graph nodes">
        {visible.map((node) => (
          <li key={node.id}>
            <button type="button" className="graph-node-row" aria-pressed={selectedId === node.id} onClick={() => onSelect(node.id)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{node.title}</span>
                <span className="block truncate text-sm text-muted-foreground">{node.kind}{node.value ? ` · ${node.value}` : ""}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {nodes.length === 0 && <p className="graph-panel-empty">No matching nodes. Try a different search or clear the filters.</p>}
      {nodes.length > PAGE_SIZE && (
        <div className="graph-pagination">
          <Button variant="ghost" size="icon" aria-label="Previous node page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft aria-hidden="true" /></Button>
          <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, nodes.length)} of {nodes.length}</p>
          <Button variant="ghost" size="icon" aria-label="Next node page" disabled={(currentPage + 1) * PAGE_SIZE >= nodes.length} onClick={() => setPage(currentPage + 1)}><ArrowRight aria-hidden="true" /></Button>
        </div>
      )}
    </section>
  );
}
