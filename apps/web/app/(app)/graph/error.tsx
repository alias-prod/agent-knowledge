"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GraphError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="graph-panel" aria-labelledby="graph-error-title">
      <div className="graph-inspector-content">
        <h1 id="graph-error-title" className="font-display text-3xl text-balance">The workspace graph could not load</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">Check your workspace membership and connection, then try again. Your data has not been changed.</p>
        <div className="flex flex-wrap gap-3"><Button onClick={reset}>Try Again</Button><Button asChild variant="outline"><Link href="/ontology">Explore the Schema</Link></Button></div>
      </div>
    </section>
  );
}
