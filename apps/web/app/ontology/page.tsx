import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Network } from "lucide-react";
import { GraphExplorer } from "@/components/graph/GraphExplorer";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Ontology Explorer | Agent Knowledge",
  description: "Explore the entity types, attributes, and relationships in the Agent Knowledge company brain using an interactive 3D hierarchy.",
};

export default function OntologyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#ontology-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to ontology explorer</a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-sm font-medium"><Network className="size-5 text-primary" aria-hidden="true" />Agent Knowledge</Link>
          <Button asChild variant="ghost"><Link href="/"><ArrowLeft data-icon="inline-start" aria-hidden="true" />Back to Home</Link></Button>
        </div>
      </header>
      <main id="ontology-content" className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8 sm:py-12">
        <Suspense fallback={<p className="graph-scene-message" role="status">Loading the ontology explorer…</p>}><GraphExplorer /></Suspense>
      </main>
    </div>
  );
}
