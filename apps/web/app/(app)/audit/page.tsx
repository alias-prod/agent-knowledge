"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentOrganization } from "@/lib/auth-context";
import { SkeletonList } from "../../components/Skeleton";

export default function AuditPage() {
  const organizationId = useCurrentOrganization();
    const auditLogs = useQuery(api.agents.listAuditLogs, {
        organizationId: organizationId,
    });

    function getAuditDescription(log: {
        action: string;
        actorEmail?: string;
        actorId?: string;
        actorUserId?: string;
    }) {
        const actor =
            log.actorEmail ?? log.actorId ?? log.actorUserId ?? "Unknown user";

        if (log.action === "seed.demo_created") {
            return `${actor} created this knowledge item`;
        }

        if (log.action === "agent.created") {
            return `${actor} created this agent`;
        }

        if (log.action === "agent.updated") {
            return `${actor} updated this agent`;
        }

        if (log.action === "agent.deleted") {
            return `${actor} deleted this agent`;
        }

        if (log.action === "member_role_updated") {
            return `${actor} changed a member role`;
        }

        if (log.action === "member_removed") {
            return `${actor} removed a member`;
        }

        if (log.action === "member_invited") {
            return `${actor} added a member`;
        }

        return `${actor} ${log.action} this knowledge item`;
    }

    return (
        <div className="ak-page">
            <header className="border-b border-neutral-800/80 pb-6">
                <p className="ak-header-eyebrow">
                    Governance
                </p>
                <h1 className="ak-header-title">Audit Logs</h1>
                <p className="ak-header-description">
                    Track knowledge changes made inside the workspace.
                </p>
            </header>

            <section className="ak-card">
                <div className="mb-5 border-b border-neutral-800/80 pb-5">
                    <p className="ak-header-eyebrow">Activity stream</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                        Workspace events
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">
                        A chronological record of governed changes across the workspace.
                    </p>
                </div>

                {auditLogs === undefined ? (
                    <SkeletonList count={4} lines={2} />
                ) : auditLogs.length === 0 ? (
                    <div className="ak-panel">
                        <p className="font-medium text-neutral-200">No audit logs yet.</p>
                        <p className="mt-1 text-sm text-neutral-500">
                            Changes to knowledge, agents, and members will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {auditLogs.map((log) => (
                            <div
                                key={log._id}
                                className="ak-panel flex flex-col gap-3 transition hover:border-neutral-700 hover:bg-white/[0.025] md:flex-row md:items-center md:justify-between"
                            >
                                <div>
                                    <p className="font-medium">
                                        {log.knowledgeTitle ??
                                            log.agentName ??
                                            log.metadata?.title ??
                                            "Unknown item"}
                                    </p>
                                    <p className="text-sm text-neutral-400">
                                        {getAuditDescription(log)}
                                    </p>
                                </div>

                                <div className="text-sm text-neutral-400">
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
