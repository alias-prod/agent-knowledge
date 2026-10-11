"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useMutation, } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { getCurrentOrgId } from "@/lib/org";
import { canManageKnowledge } from "@/lib/role";
import { useCurrentRole } from "@/lib/useCurrentRole";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useToast } from "../../components/ToastProvider";
import { useEffect, useState } from "react";

export default function ApprovalsPage() {
    const auth = useAuth();
    const { user } = auth;
    const { isAuthenticated } = useConvexAuth();
    const organization = "organizationId" in auth ? auth.organizationId : undefined;
    const organizationId = getCurrentOrgId(typeof organization === "string" ? organization : undefined);
    const { showToast } = useToast();
    const [rejectingKnowledgeId, setRejectingKnowledgeId] =
        useState<Id<"knowledge"> | null>(null);
    const [rejectionNote, setRejectionNote] = useState("");
    const [rejectionError, setRejectionError] = useState("");
    const approvalItems = useQuery(api.knowledge.listApprovalQueue, isAuthenticated ? {
        organizationId,
    } : "skip");
    const approveKnowledge = useMutation(api.knowledge.approveKnowledge);
    const currentRole = useCurrentRole();
    const canManage = canManageKnowledge(currentRole);
    const rejectKnowledge = useMutation(api.knowledge.rejectKnowledge);

    useEffect(() => {
        if (!rejectingKnowledgeId) return;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeRejectDialog();
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [rejectingKnowledgeId]);

    async function handleApproveKnowledge(id: Id<"knowledge">) {
        try {
            await approveKnowledge({
                id,
                actorEmail: user?.email ?? "unknown-user",
                organizationId,
                workosUserId: user?.id ?? "",
            });

            showToast({
                type: "success",
                title: "Knowledge approved",
                description: "The item can now be used by agents.",
            });
        } catch (error) {
            showToast({
                type: "error",
                title: "Approval failed",
                description:
                    error instanceof Error
                        ? error.message
                        : "Could not approve the knowledge item.",
            });
        }
    }

    function openRejectDialog(id: Id<"knowledge">) {
        setRejectingKnowledgeId(id);
        setRejectionNote("");
        setRejectionError("");
    }

    function closeRejectDialog() {
        setRejectingKnowledgeId(null);
        setRejectionNote("");
        setRejectionError("");
    }

    async function handleRejectKnowledge() {
        if (!rejectingKnowledgeId) return;

        setRejectionError("");

        await rejectKnowledge({
            id: rejectingKnowledgeId,
            organizationId,
            workosUserId: user?.id ?? "",
            actorEmail: user?.email ?? "unknown-user",
            reviewNote: rejectionNote,
        });

        closeRejectDialog();
        showToast({
            type: "success",
            title: "Knowledge rejected",
            description: "The item was removed from the approval queue.",
        });
    }

    return (
        <div className="ak-page">
            <header className="border-b border-neutral-800/80 pb-6">
                <p className="ak-header-eyebrow">Governance</p>
                <h1 className="ak-header-title">Approval Queue</h1>
                <p className="ak-header-description">
                    Review knowledge records that require approval before agents can act.
                </p>
            </header>

            <section className="space-y-4">
                <div>
                    <p className="ak-header-eyebrow">Review queue</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                        Pending decisions
                    </h2>
                </div>
                {approvalItems === undefined ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="ak-card">
                                <div className="h-5 w-1/3 rounded bg-neutral-800" />
                                <div className="mt-4 h-4 w-full rounded bg-neutral-800" />
                                <div className="mt-2 h-4 w-2/3 rounded bg-neutral-800" />
                            </div>
                        ))}
                    </div>
                ) : approvalItems.length === 0 ? (
                    <div className="ak-card">
                        <p className="text-neutral-300">No approval items right now.</p>
                        <p className="mt-1 text-sm text-neutral-500">
                            Knowledge records marked “Requires approval” will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {approvalItems.map((item) => (
                            <article
                                key={item._id}
                                className="ak-card-hover"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-sm text-neutral-400">
                                            {item.category}
                                        </p>
                                        <h2 className="mt-1 break-words text-xl font-semibold">
                                            {item.title}
                                        </h2>
                                    </div>

                                    <span className="ak-status-warning w-fit shrink-0">
                                        Approval required
                                    </span>
                                </div>

                                <p className="mt-4 line-clamp-3 text-neutral-300">
                                    {item.content}
                                </p>

                                <div className="mt-5 flex flex-wrap gap-2">
                                    <span className={item.status === "verified" ? "ak-status-success" : "ak-status-warning"}>
                                        {item.status}
                                    </span>

                                    {item.canUseToAct && (
                                        <span className="ak-status-neutral">
                                            Can act
                                        </span>
                                    )}

                                    <Link
                                        href={`/knowledge/${item._id}`}
                                        className="ak-button-secondary px-3 py-1 text-xs"
                                    >
                                        Open
                                    </Link>

                                    {canManage && (

                                        <button
                                            type="button"
                                            onClick={() => handleApproveKnowledge(item._id)}
                                            className="ak-button-primary px-3 py-1 text-xs"
                                        >
                                            Mark as approved
                                        </button>

                                    )}

                                    <button
                                        type="button"
                                        onClick={() => openRejectDialog(item._id)}
                                        className="ak-button-danger"
                                    >
                                        Reject
                                    </button>

                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {rejectingKnowledgeId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeRejectDialog();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reject-knowledge-title"
                        aria-describedby="reject-knowledge-description"
                        className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-[#0b0b0b] p-6 text-white shadow-2xl shadow-black/50"
                    >
                        <div className="mb-5 h-1 w-14 rounded-full bg-red-400/80" />

                        <h2
                            id="reject-knowledge-title"
                            className="text-lg font-semibold tracking-tight text-white"
                        >
                            Reject knowledge
                        </h2>
                        <p
                            id="reject-knowledge-description"
                            className="mt-3 text-sm leading-6 text-neutral-400"
                        >
                            Add a reviewer note explaining why this knowledge item is being rejected.
                        </p>

                        <div className="mt-5">
                            <label className="ak-label">Reviewer note</label>
                            <textarea
                                value={rejectionNote}
                                onChange={(event) => setRejectionNote(event.target.value)}
                                className="ak-textarea mt-2 min-h-32"
                                placeholder="Explain what needs to change before approval."
                            />
                        </div>

                        {rejectionError && (
                            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                                <p className="text-sm text-red-300">{rejectionError}</p>
                            </div>
                        )}

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeRejectDialog}
                                className="ak-button-secondary justify-center"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleRejectKnowledge().catch((error) => {
                                        setRejectionError(
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to reject knowledge."
                                        );
                                    });
                                }}
                                className="ak-button-danger justify-center"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
