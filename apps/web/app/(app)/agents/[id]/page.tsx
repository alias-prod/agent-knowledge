"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { getCurrentOrgId } from "@/lib/org";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Breadcrumbs } from "../../../components/Breadcrumbs";


export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as Id<"agents">;

  const agent = useQuery(api.agents.getAgent, { id });
  const auth = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const organization = "organizationId" in auth ? auth.organizationId : undefined;
  const organizationId = getCurrentOrgId(typeof organization === "string" ? organization : undefined);
  const knowledgeItems = useQuery(api.knowledge.listKnowledgeForAgent, isAuthenticated ? {
    agentId: id,
    organizationId,
  } : "skip");

  const auditLogs = useQuery(api.agents.listAuditLogsForAgent, {
    agentId: id,
    organizationId,
  });

  return (
    <div className="ak-page">
      <Breadcrumbs
        items={[
          { label: "Agents", href: "/agents" },
          { label: agent && agent !== null ? agent.name : "Agent" },
        ]}
      />

      <div className="border-b border-neutral-800/80 pb-4">
        <Link
          href="/agents"
          className="ak-button-ghost px-0"
        >
          ← Back to Agents
        </Link>
      </div>

      {agent === undefined ? (
        <div className="ak-card">
          <div className="h-6 w-1/3 rounded bg-neutral-800" />
          <div className="mt-4 h-4 w-2/3 rounded bg-neutral-800" />
        </div>
      ) : agent === null ? (
        <div className="ak-card">
          <p className="text-neutral-300">Agent not found.</p>
        </div>
      ) : (
        <>
          <header className="border-b border-neutral-800/80 pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="ak-header-eyebrow">
                  {agent.role ?? "Support Agent"}
                </p>
                <h1 className="ak-header-title break-words">{agent.name}</h1>
                <p className="ak-header-description">
                  {agent.description}
                </p>
              </div>

              <span className={`${agent.status === "active" ? "ak-status-success" : "ak-status-neutral"} w-fit shrink-0`}>
                {agent.status}
              </span>
            </div>
          </header>

          <section className="ak-card">
            <p className="ak-header-eyebrow">Access</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Knowledge this agent can access
            </h2>

            {knowledgeItems === undefined ? (
              <p className="mt-3 text-neutral-400">Loading knowledge...</p>
            ) : knowledgeItems.length === 0 ? (
              <p className="mt-3 text-neutral-400">
                This agent has no assigned knowledge yet.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {knowledgeItems.map((item) => (
                  <Link
                    key={item._id}
                    href={`/knowledge/${item._id}`}
                    className="ak-panel block transition hover:border-neutral-700 hover:bg-white/[0.025]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-medium">{item.title}</h3>
                        <p className="mt-1 text-sm text-neutral-400">
                          {item.category}
                        </p>
                      </div>

                      <span className={`${item.status === "verified" ? "ak-status-success" : "ak-status-warning"} w-fit shrink-0`}>
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm text-neutral-300">
                      {item.content}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="ak-card">
            <p className="ak-header-eyebrow">Governance</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Audit history
            </h2>

            {auditLogs === undefined ? (
              <p className="mt-3 text-neutral-400">Loading audit history...</p>
            ) : auditLogs.length === 0 ? (
              <p className="mt-3 text-neutral-400">
                No audit history found for this agent.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log._id}
                    className="ak-panel"
                  >
                    <p className="font-medium">
                      {log.action === "agent.created"
                        ? "Created agent"
                        : log.action === "agent.updated"
                          ? "Updated agent"
                          : log.action === "agent.deleted"
                            ? "Deleted agent"
                            : log.action}
                    </p>

                    <p className="mt-1 text-sm text-neutral-400">
                      {log.actorEmail ?? log.actorId ?? "demo-user"}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
