import Link from "next/link";
import { ArrowRight, Check, FileText, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContextEngineHero() {
  return (
    <section className="border-b border-border" aria-labelledby="engine-title">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
        <div className="flex min-w-0 flex-col items-start gap-6">
          <p className="text-sm tracking-widest text-muted-foreground">
            ALIAS / CONNECTED KNOWLEDGE
          </p>
          <h1 id="engine-title" tabIndex={-1} className="max-w-3xl font-display text-4xl leading-tight tracking-wide text-balance sm:text-6xl">
            Unified Context Engine{" "}
            <span className="block text-primary">&amp; Ontology Explorer</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            One workspace for collaborative documents, governed agent context,
            and the relationships that connect your knowledge.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="min-h-11">
              <Link href="/login" prefetch={false}>
                Open Workspace
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-h-11">
              <Link href="/ontology" prefetch={false}>Explore the Ontology</Link>
            </Button>
          </div>
          <ul className="flex w-full flex-wrap gap-x-5 gap-y-3 border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
            {["Connected documents", "Agent-scoped context", "Traceable relationships"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <aside className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground" aria-label="Illustrative governed context example">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <span className="text-sm font-medium">ALIAS UCE / Context</span>
            <span className="text-sm text-muted-foreground">Illustrative example</span>
          </header>
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 text-foreground">
              <p className="text-sm tracking-widest text-muted-foreground">AGENT QUESTION</p>
              <p className="text-sm leading-6">What is our approval policy for production access?</p>
            </div>
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-5 text-foreground">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <LockKeyhole className="size-4" aria-hidden="true" />
                Governed answer
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Production access requires approval from an engineering owner
                and a security reviewer before credentials are issued.
              </p>
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground">Connected sources</p>
                {[
                  { title: "Production Access Policy", type: "Policy" },
                  { title: "Security Review Playbook", type: "Playbook" },
                ].map((source) => (
                  <div key={source.title} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm leading-6">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {source.title}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">{source.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
