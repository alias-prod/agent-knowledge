import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { ShieldCheck } from "lucide-react";

export function AuthFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="min-h-svh bg-background text-foreground font-sans">
    <header className="flex items-center justify-between border-b border-border px-6 py-5 md:px-10"><Link href="/" aria-label="ALIAS UCE home"><BrandLockup /></Link><Link href="/ontology" className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Explore the Ontology</Link></header>
    <div className="mx-auto flex min-h-[calc(100svh-100px)] max-w-6xl items-center justify-center gap-20 px-6 py-12 lg:justify-between lg:px-10">
      <aside className="hidden max-w-sm flex-col gap-6 lg:flex"><p className="text-sm uppercase tracking-widest text-muted-foreground">ALIAS / Unified Context Engine</p><h2 className="font-display text-5xl leading-tight tracking-wide text-balance">Your knowledge.<br />The right context.<br />Under your control.</h2><p className="text-base leading-relaxed text-muted-foreground">One workspace for connected documents, governed knowledge, and the agents that use it.</p><div className="flex items-start gap-3 border-t border-border pt-6"><ShieldCheck className="size-5 shrink-0" aria-hidden="true" /><p className="text-sm leading-relaxed text-muted-foreground">Verified identities. Workspace-scoped permissions. An accountable audit trail.</p></div></aside>
      <section className="flex w-full max-w-md flex-col gap-8 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm md:p-8" aria-labelledby="auth-title"><header className="flex flex-col gap-3"><p className="text-sm uppercase tracking-widest text-muted-foreground">Workspace Access</p><h1 id="auth-title" className="font-display text-4xl tracking-wide text-balance">{title}</h1><p className="text-sm leading-relaxed text-muted-foreground">{description}</p></header>{children}</section>
    </div>
  </main>;
}
