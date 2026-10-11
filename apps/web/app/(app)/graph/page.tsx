import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceGraph } from "@/components/graph/WorkspaceGraph";

export const metadata: Metadata = {
  title: "Ontology Explorer",
  description: "Explore your workspace's knowledge graph, agent context, and ontology in 3D.",
  robots: { index: false, follow: false },
};

export default function GraphPage() {
  return <Suspense fallback={<p className="graph-scene-message" role="status">Loading your unified context…</p>}><WorkspaceGraph /></Suspense>;
}
