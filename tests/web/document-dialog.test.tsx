import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NewDocumentDialog } from "../../apps/web/components/documents/NewDocumentDialog";

const createDocument = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useMutation: () => createDocument }));

function Creator({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open document creator</button><NewDocumentDialog open={open} onOpenChange={setOpen} organizationId="org-a" documents={[]} onCreated={onCreated} /></>;
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
});
