import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  FileCheck2,
  FileText,
  Fingerprint,
  GitPullRequestArrow,
  KeyRound,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
  Network,
  UserRoundCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/BrandLockup";
import { ContextEngineHero } from "@/components/ContextEngineHero";
import { PRODUCT_NAME } from "@/lib/brand";

const features = [
  {
    title: "Knowledge governance",
    description:
      "Keep company knowledge verified, reviewable, and ready for controlled use.",
    icon: ShieldCheck,
  },
  {
    title: "Agent-scoped retrieval",
    description:
      "Give every agent access to the sources it needs—and nothing it does not.",
    icon: SearchCheck,
  },
  {
    title: "Audit-ready workflows",
    description:
      "Track retrievals, changes, decisions, and the sources behind every answer.",
    icon: FileCheck2,
  },
  {
    title: "Collaborative documents",
    description:
      "Write together, import Markdown, and keep version history on the same governed knowledge records.",
    icon: FileText,
  },
  {
    title: "Ontology exploration",
    description:
      "Inspect entity types, follow document relationships, and see how knowledge connects to agents.",
    icon: Network,
  },
  {
    title: "Review and approval flows",
    description:
      "Route important changes through human review before agents can use them.",
    icon: GitPullRequestArrow,
  },
];

const workflow = [
  {
    number: "01",
    title: "Create and connect",
    description:
      "Write or import documents. Classify them and link the policies, playbooks, and decisions they depend on.",
  },
  {
    number: "02",
    title: "Assign to agents",
    description:
      "Define which trusted sources each agent can retrieve for its specific role.",
  },
  {
    number: "03",
    title: "Ask with citations",
    description:
      "Retrieve grounded answers that show exactly which company sources were used.",
  },
  {
    number: "04",
    title: "Review activity",
    description:
      "Inspect usage, approvals, and audit events to keep knowledge dependable.",
  },
];

const trustPoints = [
  {
    title: "Verified workspace access",
    description: "Enterprise-ready identity and secure session management.",
    icon: KeyRound,
  },
  {
    title: "Role-based permissions",
    description: "Control who can create, review, approve, and administer.",
    icon: UserRoundCog,
  },
  {
    title: "Source-grounded answers",
    description: "Keep agent responses connected to trusted company sources.",
    icon: BookOpenCheck,
  },
  {
    title: "Audit logs",
    description: "Maintain a clear record of knowledge and retrieval activity.",
    icon: Fingerprint,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh overflow-hidden bg-background text-foreground font-sans">
      <a href="#engine-title" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to the Context Engine</a>
      <nav className="relative z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label={`${PRODUCT_NAME} home`}
            className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <BrandLockup compact />
          </Link>

          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <Link href="#features" className="transition hover:text-foreground">
              Features
            </Link>
            <Link href="#workflow" className="transition hover:text-foreground">
              Workflow
            </Link>
            <Link href="#security" className="transition hover:text-foreground">
              Security
            </Link>
          </div>

          <Button
            asChild
            size="sm"
            className="min-h-10"
          >
            <Link href="/login" prefetch={false}>
              Sign in
            </Link>
          </Button>
        </div>
      </nav>

      <ContextEngineHero />

      <section id="features" className="scroll-mt-20 py-18 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-muted-foreground">
              Built for dependable agents
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-wide sm:text-4xl">
              Documents, context, and ontology. Connected.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Turn scattered context into a trusted system your team can manage
              and your agents can safely use.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="group rounded-2xl border border-border bg-card p-6 transition duration-300 hover:border-input hover:bg-secondary"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-medium text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-20 border-y border-border bg-card py-18 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                A clear operating loop
              </p>
              <h2 className="mt-3 font-display text-3xl leading-tight tracking-wide sm:text-4xl">
                From trusted source to traceable answer
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
                Give teams a repeatable workflow for getting the right knowledge
                into every agent interaction.
              </p>
            </div>

            <div className="grid border-t border-border sm:grid-cols-2">
              {workflow.map((step, index) => (
                <article
                  key={step.number}
                  className={`border-b border-border py-7 sm:p-7 ${index % 2 === 0 ? "sm:border-r" : ""
                    }`}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {step.number}
                  </span>
                  <h3 className="mt-5 text-lg font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="scroll-mt-20 py-18 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
              <div>
                <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-background">
                  <LockKeyhole className="size-5 text-foreground" aria-hidden="true" />
                </span>
                <p className="mt-6 text-sm font-medium text-muted-foreground">
                  Trust and control
                </p>
                <h2 className="mt-3 font-display text-3xl leading-tight tracking-wide sm:text-4xl">
                  Governance that stays in the workflow
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Secure access, grounded retrieval, and visible activity help
                  teams move quickly without losing oversight.
                </p>
              </div>

              <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
                {trustPoints.map(({ title, description, icon: Icon }) => (
                  <article key={title} className="bg-background p-6">
                    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    <h3 className="mt-5 text-sm font-medium text-foreground">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-18 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-center  sm:px-12 sm:py-16">
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-3xl leading-tight tracking-wide text-balance sm:text-4xl">
                Bring your knowledge into context
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-foreground">
                Write together, connect sources, and give agents context that
                your team can inspect and govern.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-7 min-h-11 min-w-40"
              >
                <Link href="/login" prefetch={false}>
                  Open Workspace
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <BrandLockup stacked />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Connected knowledge. Governed context.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <Link
              href="/dashboard"
              prefetch={false}
              className="transition hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link href="#features" className="transition hover:text-foreground">
              Features
            </Link>
            <Link href="#workflow" className="transition hover:text-foreground">
              Workflow
            </Link>
            <Link href="#security" className="transition hover:text-foreground">
              Security
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
