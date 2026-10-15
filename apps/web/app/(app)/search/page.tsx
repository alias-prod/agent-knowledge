"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentOrganization } from "@/lib/auth-context";

export default function SearchPage() {
  const organizationId = useCurrentOrganization();
  const [search, setSearch] = useState("");

  const results = useQuery(
    api.search.globalSearch,
    search.trim().length >= 2
      ? {
          organizationId: organizationId,
          search,
        }
      : "skip"
  );

  return (
    <div className="ak-page">
      <header className="border-b border-neutral-800/80 pb-6">
        <p className="ak-header-eyebrow">Workspace</p>
        <h1 className="ak-header-title">Global Search</h1>
        <p className="ak-header-description">
          Search knowledge, agents, retrieval history, and audit activity.
        </p>
      </header>

      <section className="ak-card space-y-5">
        <div>
          <p className="ak-header-eyebrow">Search index</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Find anything in the workspace
          </h2>
        </div>
        <div>
          <label className="ak-label">Search workspace</label>
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="ak-input mt-2"
            placeholder="Search refund, support, agent, member, audit..."
          />
        </div>

        {search.trim().length < 2 ? (
          <div className="ak-panel">
            <p className="font-medium text-white">Start typing to search.</p>
            <p className="mt-2 text-sm text-neutral-500">
              Enter at least 2 characters to search across your workspace.
            </p>
          </div>
        ) : results === undefined ? (
          <div className="ak-panel">
            <p className="ak-muted">Searching workspace...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="ak-panel">
            <p className="font-medium text-white">No results found.</p>
            <p className="mt-2 text-sm text-neutral-500">
              Try searching for a knowledge title, agent name, source, or user.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result, index) => (
              <Link
                key={`${result.type}-${result.title}-${index}`}
                href={result.href}
                className="ak-card-hover block p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ak-status-neutral">{result.type}</span>
                      <span className="text-xs text-neutral-500">
                        {result.meta}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-white">
                      {result.title}
                    </h2>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-400">
                      {result.description}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm text-neutral-500">
                    {new Date(result.createdAt).toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
