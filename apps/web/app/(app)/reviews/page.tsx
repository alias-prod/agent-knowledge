"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useCurrentOrganization } from "@/lib/auth-context";
import { useToast } from "../../components/ToastProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useState } from "react";
import { SkeletonList } from "../../components/Skeleton";

export default function ReviewsPage() {
  const organizationId = useCurrentOrganization();
  const { showToast } = useToast();
  const { user } = useAuth({ ensureSignedIn: true });
  const [reviewTargetId, setReviewTargetId] = useState<Id<"knowledge"> | null>(
    null
  );

  const reviewItems = useQuery(api.knowledge.listKnowledgeDueForReview, {
    organizationId: organizationId,
    reviewAfterDays: 90,
  });

  const markReviewed = useMutation(api.knowledge.markKnowledgeReviewed);

  async function handleMarkReviewed(id: Id<"knowledge">) {
    try {
      await markReviewed({
        id: id as never,
        organizationId: organizationId,
        workosUserId: user?.id ?? "",
        actorEmail: user?.email ?? "unknown-user"
      });

      showToast({
        type: "success",
        title: "Marked reviewed",
        description: "The knowledge item review date was updated.",
      });

      setReviewTargetId(null);
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not mark reviewed",
        description:
          error instanceof Error
            ? error.message
            : "The review date was not updated.",
      });
    }
  }

  return (
    <div className="ak-page">
      <header className="border-b border-neutral-800/80 pb-6">
        <p className="ak-header-eyebrow">Governance</p>
        <h1 className="ak-header-title">Knowledge Reviews</h1>
        <p className="ak-header-description">
          Review knowledge that has not been checked recently.
        </p>
      </header>

      <section className="ak-card">
        <div className="mb-5 border-b border-neutral-800/80 pb-5">
          <p className="ak-header-eyebrow">Review queue</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Knowledge due for review
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Reconfirm older records so agents continue using current guidance.
          </p>
        </div>

        {reviewItems === undefined ? (
          <SkeletonList count={3} lines={3} />
        ) : reviewItems.length === 0 ? (
          <div className="ak-panel">
            <p className="font-medium text-white">Everything is up to date.</p>
            <p className="mt-2 text-sm text-neutral-500">
              No knowledge items currently need review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewItems.map((item) => (
              <article
                key={item._id}
                className="ak-panel p-5 transition hover:border-neutral-700 hover:bg-white/[0.025]"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          item.status === "verified"
                            ? "ak-status-success"
                            : "ak-status-warning"
                        }
                      >
                        {item.status}
                      </span>
                      <span className="ak-status-warning">Needs review</span>
                    </div>

                    <h2 className="mt-4 text-lg font-semibold text-white">
                      {item.title}
                    </h2>

                    <p className="mt-2 text-sm text-neutral-500">
                      {item.category}
                    </p>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-300">
                      {item.content}
                    </p>

                    <p className="mt-4 text-sm text-neutral-500">
                      Last reviewed:{" "}
                      {item.lastReviewedAt
                        ? new Date(item.lastReviewedAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/knowledge/${item._id}`}
                      className="ak-button-secondary"
                    >
                      Open
                    </Link>

                    <button
                      type="button"
                      onClick={() => setReviewTargetId(item._id)}
                      className="ak-button-primary"
                    >
                      Mark reviewed
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={reviewTargetId !== null}
        title="Mark as reviewed?"
        description="This updates the knowledge item review date to today."
        confirmLabel="Mark reviewed"
        tone="default"
        onConfirm={() => {
          if (!reviewTargetId) return;
          return handleMarkReviewed(reviewTargetId);
        }}
        onCancel={() => setReviewTargetId(null)}
      />
    </div>
  );
}
