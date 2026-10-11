"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DocumentError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6 text-card-foreground">
      <h1 className="font-display text-3xl text-balance">Documents Could Not Load</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Check your workspace membership and connection, then try again. No saved documents have been changed.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Try Again</Button>
        <Button asChild variant="outline"><Link href="/login" prefetch={false}>Sign In Again</Link></Button>
      </div>
    </section>
  );
}
