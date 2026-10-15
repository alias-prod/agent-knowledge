"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentOrganization } from "@/lib/auth-context";
import { SkeletonCard, SkeletonList } from "../../components/Skeleton";

export default function DashboardPage() {
  const organizationId = useCurrentOrganization();
  const metrics = useQuery(api.dashboard.getDashboardMetrics, {
    organizationId: organizationId,
  });

  const setupItems = metrics
    ? [
      {
        label: "Create your first agent",
        description: "Agents define who can use which knowledge.",
        complete: metrics.totalAgents > 0,
        href: "/agents",
        action: "Create agent",
      },
      {
        label: "Add trusted knowledge",
        description: "Create or import company knowledge for agents.",
        complete: metrics.totalKnowledge > 0,
        href: "/knowledge",
        action: "Add knowledge",
      },
      {
        label: "Verify answerable sources",
        description: "Verified knowledge can be used in agent answers.",
        complete: metrics.verifiedKnowledge > 0,
        href: "/knowledge",
        action: "Review knowledge",
      },
      {
        label: "Ask your first question",
        description: "Test retrieval with a source-grounded answer.",
        complete: metrics.totalRetrievals > 0,
        href: "/ask",
        action: "Ask agent",
      },
      {
        label: "Invite your team",
        description: "Add members to collaborate on the workspace.",
        complete: metrics.totalMembers > 1,
        href: "/members",
        action: "Invite member",
      },
    ]
    : [];

  const completedSetupItems = setupItems.filter((item) => item.complete).length;
  const setupProgress =
    setupItems.length > 0
      ? Math.round((completedSetupItems / setupItems.length) * 100)
      : 0;

  const statCards = metrics
    ? [
      {
        label: "Knowledge items",
        value: metrics.totalKnowledge,
        detail: `${metrics.verifiedKnowledge} verified · ${metrics.draftKnowledge} draft`,
        href: "/knowledge",
      },
      {
        label: "Answerable sources",
        value: metrics.answerableKnowledge,
        detail: "Allowed for agent answers",
        href: "/knowledge",
      },
      {
        label: "Agents",
        value: metrics.totalAgents,
        detail: `${metrics.activeAgents} active`,
        href: "/agents",
      },
      {
        label: "Members",
        value: metrics.totalMembers,
        detail: "Workspace users",
        href: "/members",
      },
      {
        label: "Retrievals",
        value: metrics.totalRetrievals,
        detail: `${metrics.retrievalsLast7Days} in the last 7 days`,
        href: "/retrieval-history",
      },
      {
        label: "Audit events",
        value: metrics.totalAuditEvents,
        detail: "Governance activity",
        href: "/audit",
      },
    ]
    : [];

  return (
    <div className="ak-page-wide">
      <header className="flex flex-col gap-5 border-b border-neutral-800/80 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ak-header-eyebrow">Workspace overview</p>
          <h1 className="ak-header-title">Dashboard</h1>
          <p className="ak-header-description">
            Monitor knowledge coverage, agent activity, retrieval usage, and governance signals.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/knowledge" className="ak-button-primary">
            Add knowledge
          </Link>
          <Link href="/ask" className="ak-button-secondary">
            Ask agent
          </Link>
        </div>
      </header>

      {metrics === undefined ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="ak-card">
              <SkeletonList count={3} lines={2} />
            </div>
            <div className="ak-card">
              <SkeletonList count={3} lines={2} />
            </div>
          </section>
        </>
      ) : (
        <>

          <section className="ak-card overflow-hidden">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="ak-header-eyebrow">Setup checklist</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Make your workspace agent-ready
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                  Complete these steps to prepare trusted knowledge for your agents.
                </p>
              </div>

              <div className="ak-panel min-w-32 text-left md:text-right">
                <p className="text-2xl font-semibold tracking-tight text-white">{setupProgress}%</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {completedSetupItems} of {setupItems.length} complete
                </p>
              </div>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-neutral-900">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${setupProgress}%` }}
              />
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {setupItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="ak-panel transition hover:border-neutral-700 hover:bg-white/[0.025]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={
                        item.complete
                          ? "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/8 text-sm text-emerald-300/90 ring-1 ring-emerald-500/20"
                          : "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm text-neutral-500 ring-1 ring-white/8"
                      }
                    >
                      {item.complete ? "✓" : "○"}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-neutral-500">
                        {item.description}
                      </span>
                      <span className="mt-3 inline-flex text-xs font-medium text-neutral-400">
                        {item.complete ? "Completed" : item.action}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>


          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {statCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="ak-card-hover block"
              >
                <p className="ak-header-eyebrow">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {card.value}
                </p>
                <p className="mt-2 text-sm text-neutral-500">{card.detail}</p>
              </Link>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="ak-card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="ak-header-eyebrow">Recent retrievals</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Agent questions
                  </h2>
                </div>

                <Link href="/retrieval-history" className="ak-button-ghost">
                  View all
                </Link>
              </div>

              {metrics.recentRetrievalLogs.length === 0 ? (
                <div className="ak-panel mt-5">
                  <p className="text-sm text-neutral-400">
                    No retrieval searches yet. Use the Ask page to start building history.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {metrics.recentRetrievalLogs.map((log) => (
                    <article
                      key={log._id}
                      className="ak-panel"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="ak-status-neutral">
                          {log.agentName ?? "Unknown agent"}
                        </span>
                        <span
                          className={
                            log.resultCount > 0
                              ? "ak-status-success"
                              : "ak-status-warning"
                          }
                        >
                          {log.resultCount} result
                          {log.resultCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      <p className="mt-3 font-medium text-white">
                        {log.question}
                      </p>
                      <p className="mt-2 text-sm text-neutral-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div className="ak-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="ak-header-eyebrow">Retrieval activity</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Last 7 days
                    </h2>
                  </div>

                  <span className="ak-status-neutral">
                    {metrics.retrievalsLast7Days} searches
                  </span>
                </div>

                <div className="mt-6 flex h-48 items-end gap-3">
                  {metrics.retrievalsByDay.map((day) => {
                    const maxCount = Math.max(
                      1,
                      ...metrics.retrievalsByDay.map((item) => item.count)
                    );

                    const height = Math.max(8, Math.round((day.count / maxCount) * 160));

                    return (
                      <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-40 w-full items-end rounded-xl border border-neutral-800/80 bg-[#080808] p-1">
                          <div
                            className="w-full rounded-lg bg-white transition-all"
                            style={{ height }}
                          />
                        </div>

                        <p className="text-xs text-neutral-500">{day.label}</p>
                        <p className="text-xs font-medium text-neutral-300">{day.count}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ak-card">
                <p className="ak-header-eyebrow">Knowledge health</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Workspace quality
                </h2>

                <div className="ak-panel mt-6 p-5">
                  <p className="text-4xl font-semibold tracking-tight text-white">
                    {metrics.knowledgeHealthScore}%
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">
                    Based on verified, answerable, and recently reviewed knowledge.
                  </p>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-900">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${metrics.knowledgeHealthScore}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="ak-panel flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Verified</span>
                    <span className="text-sm font-medium text-white">
                      {metrics.verifiedKnowledge}
                    </span>
                  </div>

                  <div className="ak-panel flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Draft / approval</span>
                    <span className="text-sm font-medium text-white">
                      {metrics.pendingApprovals}
                    </span>
                  </div>

                  <div className="ak-panel flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Review due</span>
                    <span className="text-sm font-medium text-white">
                      {metrics.reviewDueCount}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className="ak-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="ak-header-eyebrow">Search intelligence</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Top questions
                    </h2>
                  </div>

                  <Link href="/retrieval-history" className="ak-button-ghost">
                    View history
                  </Link>
                </div>

                {metrics.topQuestions.length === 0 ? (
                  <div className="ak-panel mt-5">
                    <p className="text-sm text-neutral-400">
                      No repeated questions yet.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {metrics.topQuestions.map((item, index) => (
                      <div
                        key={`${item.question}-${index}`}
                        className="ak-panel"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm font-medium text-white">{item.question}</p>
                          <span className="ak-status-neutral">{item.count}x</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ak-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="ak-header-eyebrow">Source usage</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Top retrieved sources
                    </h2>
                  </div>

                  <Link href="/knowledge" className="ak-button-ghost">
                    View knowledge
                  </Link>
                </div>

                {metrics.topSources.length === 0 ? (
                  <div className="ak-panel mt-5">
                    <p className="text-sm text-neutral-400">
                      No source usage yet.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {metrics.topSources.map((item, index) => (
                      <div
                        key={`${item.title}-${index}`}
                        className="ak-panel"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm font-medium text-white">{item.title}</p>
                          <span className="ak-status-neutral">{item.count}x</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="ak-card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="ak-header-eyebrow">Recent audit activity</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Governance events
                  </h2>
                </div>

                <Link href="/audit" className="ak-button-ghost">
                  View all
                </Link>
              </div>

              {metrics.recentAuditLogs.length === 0 ? (
                <div className="ak-panel mt-5">
                  <p className="text-sm text-neutral-400">
                    No audit activity yet.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {metrics.recentAuditLogs.map((log) => (
                    <article
                      key={log._id}
                      className="ak-panel"
                    >
                      <p className="font-medium text-white">
                        {log.knowledgeTitle ??
                          log.agentName ??
                          log.metadata?.title ??
                          "Workspace event"}
                      </p>

                      <p className="mt-2 text-sm text-neutral-500">
                        {log.actorEmail ?? log.actorId ?? "Unknown user"} ·{" "}
                        {log.action}
                      </p>

                      <p className="mt-2 text-sm text-neutral-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
