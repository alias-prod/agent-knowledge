import { useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NewDocumentDialog } from "../../apps/web/components/documents/NewDocumentDialog";
import { ConfirmDialog } from "../../apps/web/app/components/ConfirmDialog";

const createDocument = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useMutation: () => createDocument }));

function Creator({ onCreated, replaceTrigger = false }: { onCreated: (id: string) => void; replaceTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const fallbackFocusRef = useRef<HTMLButtonElement>(null);
  return <>
    {(!replaceTrigger || !created) && <button onClick={() => setOpen(true)}>Open document creator</button>}
    <button ref={fallbackFocusRef}>Workspace documents</button>
    <NewDocumentDialog open={open} onOpenChange={setOpen} organizationId="org-a" documents={[]} fallbackFocusRef={fallbackFocusRef} onCreated={(id) => { setCreated(true); onCreated(id); }} />
  </>;
}

function Confirmation({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Review deletion</button>
    <ConfirmDialog open={open} title="Delete Document?" description="The document will be permanently removed." confirmLabel="Delete Document" tone="danger" onCancel={() => setOpen(false)} onConfirm={async () => { await onConfirm(); setOpen(false); }} />
  </>;
}

beforeEach(() => {
  createDocument.mockReset();
  createDocument.mockResolvedValue("created-record");
});

describe("document creation dialog", () => {
  test("creates typed workspace knowledge and returns focus to the opening control", async () => {
    const onCreated = vi.fn();
    render(<Creator onCreated={onCreated} />);
    const trigger = screen.getByRole("button", { name: "Open document creator" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "New Document" });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Access policy" } });
    fireEvent.change(screen.getByLabelText("Knowledge Type"), { target: { value: "policy" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Document" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("created-record"));
    expect(createDocument).toHaveBeenCalledWith({ organizationId: "org-a", title: "Access policy", documentType: "policy", content: "", parentId: undefined });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test("shows a useful error without closing the draft or losing the entered title", async () => {
    createDocument.mockRejectedValue(new Error("[CONVEX]\nUncaught Error: Try creating the document again.\n    at handler"));
    render(<Creator onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open document creator" }));
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Draft policy" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Document" }));
    expect(await screen.findByText("Try creating the document again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Draft policy");
    expect(screen.getByRole("dialog", { name: "New Document" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Document" })).toBeEnabled();
  });

  test("imports Markdown content and derives a title before creating the record", async () => {
    render(<Creator onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open document creator" }));
    const file = new File(["## Context\n\nSource text"], "source.md", { type: "text/markdown" });
    Object.defineProperty(file, "text", { value: async () => "## Context\n\nSource text" });
    fireEvent.change(await screen.findByLabelText("Import Markdown file"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("source"));
    fireEvent.click(screen.getByRole("button", { name: "Create Document" }));
    await waitFor(() => expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({ title: "source", content: "## Context\n\nSource text", documentType: "document", organizationId: "org-a" })));
  });

  test("restores focus to a workspace control when creation removes the opening control", async () => {
    render(<Creator onCreated={vi.fn()} replaceTrigger />);
    const trigger = screen.getByRole("button", { name: "Open document creator" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "New document" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Document" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Workspace documents" })).toHaveFocus());
  });
});

describe("workspace confirmation dialog", () => {
  test("focuses Cancel and restores the opening control after Escape without confirming", async () => {
    const onConfirm = vi.fn();
    render(<Confirmation onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Review deletion" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Delete Document?" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("keeps pending confirmation open and prevents duplicate actions", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const onConfirm = vi.fn(() => pending);
    render(<Confirmation onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Review deletion" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Document" }));
    const working = await screen.findByRole("button", { name: "Working…" });
    expect(working).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(working);
    expect(screen.getByRole("dialog", { name: "Delete Document?" })).toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
