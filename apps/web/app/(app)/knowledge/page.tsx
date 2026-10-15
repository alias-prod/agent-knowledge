"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { documentHref, documentGraphHref } from "@agent-knowledge/shared";
import { useAuth } from "@/lib/auth-context";
import { getCurrentOrgId } from "@/lib/org";
import { canManageKnowledge } from "@/lib/role";
import { useCurrentRole } from "@/lib/useCurrentRole";
import { useToast } from "../../components/ToastProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SkeletonLine, SkeletonList } from "../../components/Skeleton";

export default function KnowledgePage() {
  const auth = useAuth();
  const { user } = auth;
  const { isAuthenticated } = useConvexAuth();
  const organization = "organizationId" in auth ? auth.organizationId : undefined;
  const organizationId = getCurrentOrgId(typeof organization === "string" ? organization : undefined);
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "verified">(
    "all"
  );
  const [categoryFilter, setCategoryFilter] = useState("all");

  const knowledgeItems = useQuery(api.knowledge.listKnowledge, isAuthenticated ? {
    organizationId,
    search,
    status: statusFilter,
    category: categoryFilter,
  } : "skip");
  const agents = useQuery(api.agents.listAgents, {
    organizationId,
  });

  const organizationSettings = useQuery(
    api.organizations.getOrganizationSettings,
    {
      organizationId,
    }
  );

  const defaultKnowledgeCategory =
    organizationSettings?.defaultKnowledgeCategory ?? "Company Policy";

  const defaultKnowledgeStatus =
    organizationSettings?.defaultKnowledgeStatus ?? "draft";

  const defaultCanUseToAnswer =
    organizationSettings?.defaultCanUseToAnswer ?? true;

  const defaultCanUseToAct =
    organizationSettings?.defaultCanUseToAct ?? false;

  const createKnowledge = useMutation(api.knowledge.createKnowledge);

  const deleteKnowledge = useMutation(api.knowledge.deleteKnowledge);
  const updateKnowledge = useMutation(api.knowledge.updateKnowledge);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"draft" | "verified" | "">("");
  const [editingId, setEditingId] = useState<Id<"knowledge"> | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<Id<"knowledge"> | null>(
    null
  );

  const [canUseToAnswer, setCanUseToAnswer] = useState<boolean | null>(null);
  const [canUseToAct, setCanUseToAct] = useState<boolean | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const effectiveCategory = category || defaultKnowledgeCategory;
  const effectiveStatus = status || defaultKnowledgeStatus;
  const effectiveCanUseToAnswer = canUseToAnswer ?? defaultCanUseToAnswer;
  const effectiveCanUseToAct = canUseToAct ?? defaultCanUseToAct;

  const [sourceUrl, setSourceUrl] = useState("");
  const [lastReviewedAt, setLastReviewedAt] = useState("");
  const [allowedAgentIds, setAllowedAgentIds] = useState<Id<"agents">[]>([]);

  const currentRole = useCurrentRole();
  const canManage = canManageKnowledge(currentRole);

  const [importText, setImportText] = useState("");
  const [importCategory, setImportCategory] = useState("");
  const [importStatus, setImportStatus] = useState<"draft" | "verified" | "">("");

  const effectiveImportCategory =
    importCategory || defaultKnowledgeCategory;

  const effectiveImportStatus =
    importStatus || defaultKnowledgeStatus;

  const [importError, setImportError] = useState("");

  const [importAllowedAgentIds, setImportAllowedAgentIds] = useState<Id<"agents">[]>([]);

  function downloadTextFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function escapeCsvValue(value: string) {
    const escaped = value.replaceAll('"', '""');
    return `"${escaped}"`;
  }

  function exportKnowledgeMarkdown() {
    if (!knowledgeItems || knowledgeItems.length === 0) return;

    const content = knowledgeItems
      .map((item) => {
        return [
          `# ${item.title}`,
          "",
          `Category: ${item.category}`,
          `Status: ${item.status}`,
          `Can answer: ${item.canUseToAnswer ? "Yes" : "No"}`,
          `Can act: ${item.canUseToAct ? "Yes" : "No"}`,
          "",
          item.content,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    downloadTextFile(
      "alias-context-engine-export.md",
      content,
      "text/markdown;charset=utf-8"
    );

    showToast({
      type: "success",
      title: "Markdown exported",
      description: `${knowledgeItems.length} knowledge item${knowledgeItems.length === 1 ? "" : "s"} downloaded.`,
    });
  }

  function exportKnowledgeCsv() {
    if (!knowledgeItems || knowledgeItems.length === 0) return;

    const rows = [
      [
        "Title",
        "Category",
        "Status",
        "Can answer",
        "Can act",
        "Requires approval",
        "Source URL",
        "Content",
      ],
      ...knowledgeItems.map((item) => [
        item.title,
        item.category,
        item.status,
        item.canUseToAnswer ? "Yes" : "No",
        item.canUseToAct ? "Yes" : "No",
        item.requiresApproval ? "Yes" : "No",
        item.sourceUrl ?? "",
        item.content,
      ]),
    ];

    const content = rows
      .map((row) => row.map((value) => escapeCsvValue(String(value))).join(","))
      .join("\n");

    downloadTextFile(
      "alias-context-engine-export.csv",
      content,
      "text/csv;charset=utf-8"
    );

    showToast({
      type: "success",
      title: "CSV exported",
      description: `${knowledgeItems.length} knowledge item${knowledgeItems.length === 1 ? "" : "s"} downloaded.`,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !content.trim()) return;

    const payload = {
      title,
      content,
      category: effectiveImportCategory,
      status: effectiveStatus,
      canUseToAnswer: effectiveCanUseToAnswer,
      canUseToAct: effectiveCanUseToAct,
      requiresApproval: effectiveStatus === "draft",
      sourceUrl: sourceUrl.trim() || undefined,
      lastReviewedAt: lastReviewedAt
        ? new Date(lastReviewedAt).getTime()
        : undefined,
      allowedAgentIds,
      actorEmail: user?.email ?? "unknown-user",
      ownerEmail: user?.email ?? "unknown-user",
      organizationId,
      workosUserId: user?.id ?? "",
    };


    try {
      if (editingId) {
        await updateKnowledge({
          id: editingId,
          title,
          content,
          category: effectiveCategory,
          status: effectiveStatus,
          canUseToAnswer: effectiveCanUseToAnswer,
          canUseToAct: effectiveCanUseToAct,
          requiresApproval: effectiveStatus === "draft" || requiresApproval,
          sourceUrl: sourceUrl || undefined,
          lastReviewedAt: undefined,
          allowedAgentIds,
          organizationId,
          workosUserId: user?.id ?? "",
          actorEmail: user?.email ?? "unknown-user",
        });

        showToast({
          type: "success",
          title: "Knowledge updated",
          description: "The knowledge item was saved.",
        });

      } else {
        await createKnowledge(payload);

        showToast({
          type: "success",
          title: "Knowledge created",
          description: "The knowledge item was added.",
        });
      }

      resetForm();
    } catch (error) {
      showToast({
        type: "error",
        title: editingId ? "Update failed" : "Creation failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not save the knowledge item.",
      });
    }
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setCategory("");
    setStatus("");
    setCanUseToAnswer(null);
    setCanUseToAct(null);
    setRequiresApproval(false);
    setSourceUrl("");
    setLastReviewedAt("");
    setAllowedAgentIds([]);
  }

  function handleEdit(item: {
    _id: Id<"knowledge">;
    title: string;
    content: string;
    category: string;
    status: "draft" | "verified";
    canUseToAnswer?: boolean;
    canUseToAct?: boolean;
    requiresApproval?: boolean;
    sourceUrl?: string;
    lastReviewedAt?: number;
    allowedAgentIds?: Id<"agents">[];
  }) {
    setEditingId(item._id);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category);
    setStatus(item.status);
    setCanUseToAnswer(item.canUseToAnswer ?? true);
    setCanUseToAct(item.canUseToAct ?? false);
    setRequiresApproval(item.requiresApproval ?? false);
    setSourceUrl(item.sourceUrl ?? "");
    setLastReviewedAt(
      item.lastReviewedAt
        ? new Date(item.lastReviewedAt).toISOString().split("T")[0]
        : ""
    );
    setAllowedAgentIds(item.allowedAgentIds ?? []);
  }

  function splitImportedKnowledge(rawText: string) {
    const text = rawText.trim();

    if (!text) return [];

    const sections = text
      .split(/\n(?=#{1,3}\s+)/g)
      .map((section) => section.trim())
      .filter(Boolean);

    if (sections.length === 0) {
      return [];
    }

    return sections.map((section, index) => {
      const lines = section.split("\n");
      const firstLine = lines[0]?.trim() ?? "";

      const headingMatch = firstLine.match(/^#{1,3}\s+(.+)$/);

      const firstNonEmptyLine =
        lines.find((line) => line.trim().length > 0)?.trim() ?? "";

      const title = headingMatch
        ? headingMatch[1].trim()
        : firstNonEmptyLine.length <= 80
          ? firstNonEmptyLine
          : `Imported Knowledge ${index + 1}`;

      const content = headingMatch
        ? lines.slice(1).join("\n").trim()
        : section;

      return {
        title,
        content: content || section,
      };
    });
  }

  const importPreview = splitImportedKnowledge(importText);

  function toggleImportAgent(agentId: Id<"agents">) {
    setImportAllowedAgentIds((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId]
    );
  }

  async function handleImportKnowledge(e: React.FormEvent) {
    e.preventDefault();

    setImportError("");

    const items = importPreview;

    if (items.length === 0) {
      setImportError("Paste some Markdown or text to import.");
      return;
    }

    try {
      for (const item of items) {
        await createKnowledge({
          title: item.title,
          content: item.content,
          category: effectiveImportCategory,
          status: effectiveImportStatus,
          canUseToAnswer: defaultCanUseToAnswer,
          canUseToAct: defaultCanUseToAct,
          requiresApproval: effectiveStatus === "draft" || requiresApproval,
          sourceUrl: "",
          lastReviewedAt: undefined,
          allowedAgentIds: importAllowedAgentIds,
          organizationId,
          workosUserId: user?.id ?? "",
          actorEmail: user?.email ?? "unknown-user",
        });
      }

      showToast({
        type: "success",
        title: "Knowledge imported",
        description: `${items.length} item${items.length === 1 ? "" : "s"} added to the knowledge base.`,
      });
      setImportAllowedAgentIds([]);
      setImportText("");
      setImportCategory("");
      setImportStatus("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to import knowledge."
      );
    }
  }

  async function handleDeleteKnowledge(id: Id<"knowledge">) {
    try {
      await deleteKnowledge({
        id,
        actorEmail: user?.email ?? "unknown-user",
        organizationId,
        workosUserId: user?.id ?? "",
      });

      showToast({
        type: "success",
        title: "Knowledge deleted",
        description: "The knowledge item was removed.",
      });

      setDeleteTargetId(null);
    } catch (error) {
      showToast({
        type: "error",
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not delete the knowledge item.",
      });
    }
  }


  return (
    <div className="ak-page">
      <header className="flex flex-col gap-5 border-b border-neutral-800/80 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ak-header-eyebrow">Knowledge</p>
          <h1 className="ak-header-title">Knowledge base</h1>
          <p className="ak-header-description">
            Manage trusted knowledge your agents can retrieve and use.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/documents" prefetch={false} className="ak-button-secondary">Document Workspace</Link>
          <button
            type="button"
            onClick={exportKnowledgeMarkdown}
            disabled={!knowledgeItems || knowledgeItems.length === 0}
            className="ak-button-secondary"
          >
            Export Markdown
          </button>

          <button
            type="button"
            onClick={exportKnowledgeCsv}
            disabled={!knowledgeItems || knowledgeItems.length === 0}
            className="ak-button-secondary"
          >
            Export CSV
          </button>
        </div>
      </header>

      {canManage && (
        <section className="ak-card overflow-hidden">
          <div className="border-b border-neutral-800/80 pb-5">
            <p className="ak-header-eyebrow">Import</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Import knowledge from Markdown
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Paste Markdown or plain text. Headings become separate knowledge items.
            </p>
          </div>

          <form onSubmit={handleImportKnowledge} className="mt-6 space-y-5">
            <div>
              <label className="ak-label">Markdown or text</label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="ak-textarea mt-2 min-h-48"
                placeholder={`# Refund Policy\nCustomers can request a refund within 7 days.\n\n# Email Rules\nAgents may draft emails for review.`}
              />

              {importText.trim() && (
                <div className="ak-panel mt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">Import preview</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {importPreview.length} item{importPreview.length === 1 ? "" : "s"} will be created.
                      </p>
                    </div>

                    <span className="ak-status-neutral">
                      Preview only
                    </span>
                  </div>

                  {importPreview.length === 0 ? (
                    <p className="mt-4 text-sm text-neutral-500">
                      No valid knowledge items found yet.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {importPreview.map((item, index) => (
                        <div
                          key={`${item.title}-${index}`}
                          className="ak-panel"
                        >
                          <p className="text-sm font-medium text-white">
                            {index + 1}. {item.title}
                          </p>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-400">
                            {item.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="ak-label">Category</label>
                <input
                  value={effectiveImportCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  className="ak-input mt-2"
                  placeholder="Company Policy"
                />
              </div>

              <div>
                <label className="ak-label">Status</label>
                <select
                  value={effectiveImportStatus}
                  onChange={(e) =>
                    setImportStatus(e.target.value as "draft" | "verified")
                  }
                  className="ak-select mt-2"
                >
                  <option value="draft">Draft</option>
                  <option value="verified">Verified</option>
                </select>
              </div>

              <div>
                <label className="ak-label">Assign to agents</label>

                <div className="ak-panel mt-2">
                  {agents === undefined ? (
                    <div className="space-y-3">
                      <SkeletonLine className="h-5 w-1/3" />
                      <SkeletonLine className="h-10 w-full" />
                    </div>
                  ) : agents.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No agents yet. Create an agent before importing assigned knowledge.
                    </p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {agents.map((agent) => (
                        <label
                          key={agent._id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-800 bg-[#080808] p-3 text-sm text-neutral-300 transition hover:border-neutral-700 hover:bg-white/[0.025]"
                        >
                          <input
                            type="checkbox"
                            checked={importAllowedAgentIds.includes(agent._id)}
                            onChange={() => toggleImportAgent(agent._id)}
                            className="h-4 w-4 rounded border-neutral-700 bg-neutral-950"
                          />
                          <span>
                            <span className="block font-medium text-white">{agent.name}</span>
                            <span className="block text-xs text-neutral-500">{agent.role}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <p className="mt-2 text-sm text-neutral-500">
                  Imported items will be assigned to {importAllowedAgentIds.length} agent
                  {importAllowedAgentIds.length === 1 ? "" : "s"}.
                </p>
              </div>

            </div>

            {importError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-300">{importError}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={importPreview.length === 0}
                className="ak-button-primary"
              >
                Import {importPreview.length > 0 ? importPreview.length : ""} knowledge item
                {importPreview.length === 1 ? "" : "s"}
              </button>
            </div>
          </form>
        </section>
      )}

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="ak-card flex flex-col gap-5"
        >
          <div className="border-b border-neutral-800/80 pb-5">
            <p className="ak-header-eyebrow">
              {editingId ? "Edit record" : "Create"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {editingId ? "Update knowledge" : "Create knowledge"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Define the source, governance rules, and agents allowed to use this record.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="ak-label">
              Title
            </label>
            <input
              className="ak-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Refund policy"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="ak-label">
              Content
            </label>
            <textarea
              className="ak-textarea min-h-32"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the knowledge agents should use..."
            />
          </div>


          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="ak-label">
                Category
              </label>
              <select
                className="ak-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>Company Policy</option>
                <option>Product Documentation</option>
                <option>Runbook</option>
                <option>Agent Instruction</option>
                <option>Tool Usage Rule</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="ak-label">
                Status
              </label>
              <select
                className="ak-select"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "draft" | "verified")
                }
              >
                <option value="draft">Draft</option>
                <option value="verified">Verified</option>
              </select>
            </div>
          </div>

          <div className="ak-panel">
            <p className="text-sm font-medium text-neutral-300">
              Agent usage rules
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={effectiveCanUseToAnswer}
                  onChange={(e) => setCanUseToAnswer(e.target.checked)}
                  value={effectiveCategory}
                />
                Can use to answer
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={effectiveCanUseToAct}
                  onChange={(e) => setCanUseToAct(e.target.checked)}
                  value={effectiveStatus}
                />
                Can use to take action
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={requiresApproval || effectiveStatus === "draft"}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                />
                Requires approval
              </label>
            </div>
          </div>

          <div className="ak-panel">
            <p className="text-sm font-medium text-neutral-300">
              Allowed agents
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Choose which agents can use this knowledge record.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {agents === undefined ? (
                <div className="space-y-3 md:col-span-2">
                  <SkeletonLine className="h-5 w-1/3" />
                  <SkeletonLine className="h-10 w-full" />
                </div>
              ) : agents.length === 0 ? (
                <p className="text-sm text-neutral-400">
                  No agents yet. Create agents first.
                </p>
              ) : (
                agents.map((agent) => (
                  <label
                    key={agent._id}
                    className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#080808] px-3 py-2.5 text-sm text-neutral-300 transition hover:border-neutral-700 hover:bg-white/[0.025]"
                  >
                    <input
                      type="checkbox"
                      checked={allowedAgentIds.includes(agent._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedAgentIds([...allowedAgentIds, agent._id]);
                        } else {
                          setAllowedAgentIds(
                            allowedAgentIds.filter((id) => id !== agent._id)
                          );
                        }
                      }}
                    />
                    {agent.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="ak-label">
                Source URL
              </label>
              <input
                className="ak-input"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://company.com/policy"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="ak-label">
                Last reviewed date
              </label>
              <input
                type="date"
                className="ak-input"
                value={lastReviewedAt}
                onChange={(e) => setLastReviewedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="ak-button-primary w-fit"
            >
              {editingId ? "Update Knowledge" : "Create Knowledge"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  resetForm();
                }}
                className="ak-button-secondary w-fit"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      )}

      <section className="space-y-4">
        <div className="ak-card flex flex-col gap-5">
          <div>
            <p className="ak-header-eyebrow">Library</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Knowledge items
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Filter and manage the trusted records available in this workspace.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px]">
            <input
              className="ak-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or content..."
            />

            <select
              className="ak-select"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "draft" | "verified"
                )
              }
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="verified">Verified</option>
            </select>

            <select
              className="ak-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              <option>Company Policy</option>
              <option>Product Documentation</option>
              <option>Runbook</option>
              <option>Agent Instruction</option>
              <option>Tool Usage Rule</option>
            </select>
          </div>
        </div>

        {knowledgeItems === undefined ? (
          <SkeletonList count={3} lines={3} />
        ) : knowledgeItems.length === 0 ? (
          <div className="ak-card">
            <p className="font-medium text-neutral-200">
              No matching knowledge found.
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Try changing your search, status, or category filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {knowledgeItems.map((item) => (
              <article
                key={item._id}
                className="ak-card-hover"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="min-w-0 break-words text-lg font-semibold">{item.title}</h3>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={
                        item.status === "verified"
                          ? "ak-status-success"
                          : "ak-status-warning"
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-neutral-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Status
                    </span>

                    <span
                      className={
                        item.status === "verified"
                          ? "ak-status-success"
                          : "ak-status-warning"
                      }
                    >
                      <span
                        className={
                          item.status === "verified"
                            ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300"
                            : "mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-300"
                        }
                      />
                      {item.status === "verified" ? "Verified" : "Draft"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <Link
                      href={`/knowledge/${item._id}`}
                      className="ak-button-primary col-span-2 px-3.5 py-2 sm:col-span-1"
                    >
                      Governance
                    </Link>
                    <Link href={documentHref(item._id)} prefetch={false} className="ak-button-secondary px-3.5 py-2">Document</Link>
                    <Link href={documentGraphHref(item._id)} prefetch={false} className="ak-button-secondary px-3.5 py-2">Graph</Link>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="ak-button-secondary px-3.5 py-2"
                      >
                        Edit
                      </button>
                    )}

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(item._id)}
                        className="ak-button-danger px-3.5 py-2"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-1 text-sm text-neutral-400">
                  {item.category}
                </p>

                <p className="mt-4 text-neutral-200">{item.content}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.canUseToAnswer && (
                    <span className="ak-status-neutral">
                      Can answer
                    </span>
                  )}

                  {item.canUseToAct && (
                    <span className="ak-status-neutral">
                      Can act
                    </span>
                  )}

                  {item.requiresApproval && (
                    <span className="ak-status-warning">
                      Approval required
                    </span>
                  )}
                </div>

                {item.sourceUrl && (
                  <p className="mt-4 text-sm text-neutral-400">
                    Source:{" "}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-200 underline"
                    >
                      {item.sourceUrl}
                    </a>
                  </p>
                )}

                {item.lastReviewedAt && (
                  <p className="mt-1 text-sm text-neutral-400">
                    Last reviewed:{" "}
                    {new Date(item.lastReviewedAt).toLocaleDateString()}
                  </p>
                )}

                {item.allowedAgentIds && item.allowedAgentIds.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-neutral-400">
                      Allowed agents:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.allowedAgentIds.map((agentId) => {
                        const agent = agents?.find((a) => a._id === agentId);

                        return (
                          <span
                            key={agentId}
                            className="ak-status-neutral"
                          >
                            {agent?.name ?? "Unknown agent"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Delete knowledge?"
        description="This removes the knowledge item from the workspace. This action cannot be undone."
        confirmLabel="Delete knowledge"
        tone="danger"
        onConfirm={() => {
          if (!deleteTargetId) return;
          return handleDeleteKnowledge(deleteTargetId);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
