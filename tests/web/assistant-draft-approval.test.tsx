import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { DraftApproval } from "../../apps/web/components/assistant/DraftApproval";
const state = vi.hoisted(() => ({ operations: [] as Record<string, unknown>[], commit: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ organizationId: "workspace-a" }) }));
vi.mock("convex/react", () => ({ useQuery: () => state.operations, useMutation: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference).endsWith("commitDraft") ? state.commit : state.cancel }));
beforeEach(() => {
  vi.clearAllMocks(); state.commit.mockResolvedValue(null); state.cancel.mockResolvedValue(null);
  state.operations = [{ _id: "proposal", kind: "create", status: "pending", title: "Decision", content: "Proposed text" }];
});
test("trusted pending draft remains visible and only explicit confirmation calls the scoped mutation", async () => {
  render(<DraftApproval requestId="request-a" />);
  expect(screen.getByRole("region", { name: "Document change approval" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Review Before Saving" })).toBeInTheDocument();
  expect(screen.getByText("Proposed text")).toBeInTheDocument(); expect(state.commit).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", { name: "Confirm & Save Draft" }); confirm.focus(); expect(confirm).toHaveFocus(); fireEvent.click(confirm);
  await waitFor(() => expect(state.commit).toHaveBeenCalledWith({ organizationId: "workspace-a", operationId: "proposal" }));
});
test("failed save renders actionable error without a success link", async () => {
  state.commit.mockRejectedValue(new Error("expired")); render(<DraftApproval requestId="request-a" />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm & Save Draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save.");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
test("committed server operation exposes accessible saved-draft deep link with no replay button", () => {
  state.operations = [{ _id: "proposal", status: "committed", resultId: "doc123" }];
  render(<DraftApproval requestId="request-a" />);
  expect(screen.getByRole("link", { name: "Open Saved Draft" })).toHaveAttribute("href", "/documents?doc=doc123");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("cancelled and absent operations never show confirmation", () => {
  state.operations = [{ _id: "proposal", status: "cancelled" }]; const view = render(<DraftApproval requestId="request-a" />);
  expect(screen.getByText("Proposal cancelled. Nothing was saved.")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  state.operations = []; view.rerender(<DraftApproval requestId="request-a" />);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
