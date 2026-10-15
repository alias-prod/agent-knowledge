"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentOrganization } from "@/lib/auth-context";
import { useMemo, useState } from "react";
import { SkeletonList } from "../../components/Skeleton";

export default function RetrievalHistoryPage() {
  const organizationId = useCurrentOrganization();
    const logs = useQuery(api.knowledge.listRetrievalLogs, {
        organizationId: organizationId,

    });

    const [search, setSearch] = useState("");
    const [agentFilter, setAgentFilter] = useState("all");
    const [resultFilter, setResultFilter] = useState<"all" | "with-results" | "no-results">("all");

    const agentOptions = useMemo(() => {
        if (!logs) return [];

        return Array.from(
            new Set(logs.map((log) => log.agentName ?? "Unknown agent"))
        ).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        if (!logs) return [];

        const normalizedSearch = search.trim().toLowerCase();

        return logs.filter((log) => {
            const sourceText = log.sourceTitles.join(" ").toLowerCase();

            const matchesSearch =
                !normalizedSearch ||
                log.question.toLowerCase().includes(normalizedSearch) ||
                sourceText.includes(normalizedSearch) ||
                (log.actorEmail ?? "").toLowerCase().includes(normalizedSearch) ||
                (log.agentName ?? "").toLowerCase().includes(normalizedSearch);

            const logAgentName = log.agentName ?? "Unknown agent";

            const matchesAgent =
                agentFilter === "all" || logAgentName === agentFilter;

            const matchesResultFilter =
                resultFilter === "all" ||
                (resultFilter === "with-results" && log.resultCount > 0) ||
                (resultFilter === "no-results" && log.resultCount === 0);

            return matchesSearch && matchesAgent && matchesResultFilter;
        });
    }, [logs, search, agentFilter, resultFilter]);

    return (
        <div className="ak-page">
            <header className="border-b border-neutral-800/80 pb-6">
                <p className="ak-header-eyebrow">Agent Retrieval</p>
                <h1 className="ak-header-title">Retrieval History</h1>
                <p className="ak-header-description">
                    Review recent questions asked through agents and the sources that were retrieved.
                </p>
            </header>

            <section className="ak-card space-y-5">
                <div>
                    <p className="ak-header-eyebrow">Filters</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                        Review retrieval activity
                    </h2>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
                    <div>
                        <label className="ak-label">Search history</label>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="ak-input mt-2"
                            placeholder="Search question, source, user, or agent..."
                        />
                    </div>

                    <div>
                        <label className="ak-label">Agent</label>
                        <select
                            value={agentFilter}
                            onChange={(e) => setAgentFilter(e.target.value)}
                            className="ak-select mt-2"
                        >
                            <option value="all">All agents</option>
                            {agentOptions.map((agentName) => (
                                <option key={agentName} value={agentName}>
                                    {agentName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="ak-label">Results</label>
                        <select
                            value={resultFilter}
                            onChange={(e) =>
                                setResultFilter(
                                    e.target.value as "all" | "with-results" | "no-results"
                                )
                            }
                            className="ak-select mt-2"
                        >
                            <option value="all">All results</option>
                            <option value="with-results">With results</option>
                            <option value="no-results">No results</option>
                        </select>
                    </div>
                </div>

                {logs === undefined ? (
                    <SkeletonList count={4} lines={3} />
                ) : logs.length === 0 ? (
                    <div className="ak-panel">
                        <p className="font-medium text-white">No retrieval history yet.</p>
                        <p className="mt-2 text-sm text-neutral-500">
                            Searches from the Ask page will appear here after agents retrieve knowledge.
                        </p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="ak-panel">
                        <p className="font-medium text-white">No matching retrievals.</p>
                        <p className="mt-2 text-sm text-neutral-500">
                            Try changing the search text, agent filter, or result filter.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredLogs.map((log) => (
                            <article
                                key={log._id}
                                className="ak-panel p-5"
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
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
                                                {log.resultCount} result{log.resultCount === 1 ? "" : "s"}
                                            </span>
                                        </div>

                                        <h2 className="mt-4 text-lg font-semibold text-white">
                                            {log.question}
                                        </h2>

                                        <p className="mt-2 text-sm text-neutral-500">
                                            Asked by {log.actorEmail ?? "Unknown user"}
                                        </p>

                                        {log.sourceTitles.length > 0 && (
                                            <div className="mt-4">
                                                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                                    Sources
                                                </p>

                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {Array.from(new Set(log.sourceTitles)).map((title, index) => (
                                                        <span
                                                            key={`${title}-${index}`}
                                                            className="ak-status-neutral"
                                                        >
                                                            {title}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <p className="shrink-0 text-sm text-neutral-500">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
