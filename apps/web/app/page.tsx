import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  FileCheck2,
  FileText,
  Fingerprint,
  GitPullRequestArrow,
  KeyRound,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";

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
    title: "Markdown import and exports",
    description:
      "Move portable knowledge in and out without locking your team into a silo.",
    icon: FileText,
  },
  {
    title: "Team roles and invitations",
    description:
      "Bring in teammates with clear responsibilities and workspace permissions.",
    icon: UsersRound,
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
    title: "Import knowledge",
    description:
      "Bring policies, playbooks, product context, and operating knowledge into one workspace.",
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
    title: "WorkOS authentication",
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
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <nav className="relative z-50 border-b border-neutral-800/80 bg-[#050505]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-semibold tracking-tight text-white"
          >
            <span className="flex size-8 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            Agent Knowledge
          </Link>

          <div className="hidden items-center gap-8 text-sm text-neutral-400 md:flex">
            <Link href="#features" className="transition hover:text-white">
              Features
            </Link>
            <Link href="#workflow" className="transition hover:text-white">
              Workflow
            </Link>
            <Link href="#security" className="transition hover:text-white">
              Security
            </Link>
          </div>

          <Button
            asChild
            size="sm"
            className="border border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-200"
          >
            <Link href="/login" prefetch={false}>
              Sign in
            </Link>
          </Button>
        </div>
      </nav>

      <section className="relative isolate border-b border-neutral-800/80">
        <Particles
          className="opacity-35 [mask-image:linear-gradient(to_bottom,black_20%,transparent_90%)]"
          quantity={70}
          staticity={80}
          ease={80}
          size={0.5}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_5%,rgba(255,255,255,0.08),transparent_34%)]"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-5 pb-18 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/80 px-3 py-1.5 text-xs font-medium text-neutral-300 shadow-sm">
              <span className="size-1.5 rounded-full bg-neutral-400" />
              Trusted knowledge for AI agents
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
              Company knowledge your AI agents can trust
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-400 sm:text-xl">
              Store, govern, retrieve, and audit the knowledge agents use to
              answer and act.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 w-full bg-white px-5 text-neutral-950 hover:bg-neutral-200 sm:w-auto"
              >
                <Link href="/login" prefetch={false}>
                  Get started
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 w-full border-neutral-700 bg-neutral-950/70 px-5 text-white hover:border-neutral-600 hover:bg-neutral-900 hover:text-white sm:w-auto"
              >
                <Link href="/ontology" prefetch={false}>Explore the brain</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-3 border-t border-neutral-800/80 pt-5 text-sm text-neutral-500 sm:grid-cols-3 sm:gap-5">
              {[
                "Verified sources",
                "Agent-scoped answers",
                "Audit-ready workflows",
              ].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check
                    className="size-3.5 shrink-0 text-neutral-300"
                    aria-hidden="true"
                  />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mx-0">
            <div
              className="absolute -inset-10 -z-10 bg-[radial-gradient(circle,rgba(255,255,255,0.07),transparent_65%)]"
              aria-hidden="true"
            />
            <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#090909] shadow-2xl shadow-black">
              <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-neutral-700" />
                  <span className="size-2 rounded-full bg-neutral-700" />
                  <span className="size-2 rounded-full bg-neutral-700" />
                </div>
                <span className="text-xs font-medium text-neutral-500">
                  Knowledge retrieval
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600">
                    Agent question
                  </p>
                  <p className="mt-3 text-sm leading-6 text-neutral-200">
                    What is our approval policy for production access?
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-neutral-800 bg-[#0d0d0d] p-5">
                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
                    <span className="flex size-6 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900">
                      <LockKeyhole className="size-3" aria-hidden="true" />
                    </span>
                    Grounded answer
                  </div>
                  <p className="mt-4 text-sm leading-7 text-neutral-300">
                    Production access requires approval from an engineering
                    owner and a security reviewer before credentials are issued.
                  </p>

                  <div className="mt-5 border-t border-neutral-800 pt-4">
                    <p className="text-xs font-medium text-neutral-500">
                      Sources used
                    </p>
                    <div className="mt-3 grid gap-2">
                      {[
                        "Production Access Policy",
                        "Security Review Playbook",
                      ].map((source, index) => (
                        <div
                          key={source}
                          className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5"
                        >
                          <span className="flex items-center gap-2 text-xs text-neutral-300">
                            <FileText
                              className="size-3.5 text-neutral-500"
                              aria-hidden="true"
                            />
                            {source}
                          </span>
                          <span className="text-[11px] text-neutral-600">
                            0{index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 py-18 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-neutral-500">
              Built for dependable agents
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              One governed layer for company knowledge
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-400">
              Turn scattered context into a trusted system your team can manage
              and your agents can safely use.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="group rounded-2xl border border-neutral-800 bg-[#0b0b0b] p-6 transition duration-300 hover:border-neutral-700 hover:bg-neutral-900/60"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-300">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-medium text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-20 border-y border-neutral-800 bg-[#080808] py-18 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                A clear operating loop
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                From trusted source to traceable answer
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-neutral-400">
                Give teams a repeatable workflow for getting the right knowledge
                into every agent interaction.
              </p>
            </div>

            <div className="grid border-t border-neutral-800 sm:grid-cols-2">
              {workflow.map((step, index) => (
                <article
                  key={step.number}
                  className={`border-b border-neutral-800 py-7 sm:p-7 ${index % 2 === 0 ? "sm:border-r" : ""
                    }`}
                >
                  <span className="font-mono text-xs text-neutral-600">
                    {step.number}
                  </span>
                  <h3 className="mt-5 text-lg font-medium text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
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
          <div className="rounded-3xl border border-neutral-800 bg-[#0b0b0b] p-6 sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
              <div>
                <span className="flex size-11 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-950">
                  <LockKeyhole className="size-5 text-neutral-300" aria-hidden="true" />
                </span>
                <p className="mt-6 text-sm font-medium text-neutral-500">
                  Trust and control
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Governance that stays in the workflow
                </h2>
                <p className="mt-4 text-base leading-7 text-neutral-400">
                  Secure access, grounded retrieval, and visible activity help
                  teams move quickly without losing oversight.
                </p>
              </div>

              <div className="grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2">
                {trustPoints.map(({ title, description, icon: Icon }) => (
                  <article key={title} className="bg-neutral-950 p-6">
                    <Icon className="size-5 text-neutral-400" aria-hidden="true" />
                    <h3 className="mt-5 text-sm font-medium text-white">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      {description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-800">
        <div className="mx-auto max-w-7xl px-5 py-18 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#0b0b0b] px-6 py-12 text-center shadow-2xl shadow-black/30 sm:px-12 sm:py-16">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_45%)]"
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Start building your agent knowledge layer
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-neutral-300">
                Give every agent a trusted, governed foundation for answering
                and acting.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-7 h-11 min-w-40 bg-white px-6 text-neutral-950 shadow-sm hover:bg-neutral-200"
              >
                <Link href="/login" prefetch={false}>
                  Get started
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-sm font-medium text-neutral-200">
              Agent Knowledge
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Trusted company knowledge for AI agents.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-neutral-500">
            <Link
              href="/dashboard"
              prefetch={false}
              className="transition hover:text-white"
            >
              Dashboard
            </Link>
            <Link href="#features" className="transition hover:text-white">
              Features
            </Link>
            <Link href="#workflow" className="transition hover:text-white">
              Workflow
            </Link>
            <Link href="#security" className="transition hover:text-white">
              Security
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
