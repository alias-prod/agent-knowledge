import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/BrandLockup";
import { PRODUCT_NAME } from "@/lib/brand";
import { GraphExplorer } from "@/components/graph/GraphExplorer";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Ontology Explorer",
  description: "Explore ALIAS Unified Context Engine entity types, document relationships, and agent context through an interactive ontology.",
};

export default function OntologyPage() {
  return (
    <div className="ontology-shell min-h-dvh bg-background text-foreground">
      <a href="#ontology-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to ontology explorer</a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/" aria-label={`${PRODUCT_NAME} home`} className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><BrandLockup compact /></Link>
          <Button asChild variant="ghost"><Link href="/"><ArrowLeft data-icon="inline-start" aria-hidden="true" />Back to Home</Link></Button>
        </div>
      </header>
      <main id="ontology-content" className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8 sm:py-12">
        <Suspense fallback={<p className="graph-scene-message" role="status">Loading the ontology explorer…</p>}><GraphExplorer /></Suspense>
      </main>
    </div>
  );
}
