import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { documentGraphHref, documentHref } from "@agent-knowledge/shared";
import type { DocumentSummary } from "../../apps/web/lib/documents";
import { documentError, documentTree } from "../../apps/web/lib/documents";
import { DocumentPreview } from "../../apps/web/components/documents/DocumentPreview";

function summary(id: string, title: string, parentId?: string): DocumentSummary {
  return { id: id as DocumentSummary["id"], title, parentId: parentId as DocumentSummary["parentId"], category: "General", status: "draft", documentType: "document", excerpt: "", updatedAt: 1, relationCount: 0 };
}

describe("connected document presentation", () => {
  test("orders document hierarchies without dropping orphaned or cyclic legacy records", () => {
    const documents = [summary("child", "Child", "parent"), summary("parent", "Parent"), summary("orphan", "Orphan", "missing"), summary("a", "Cycle A", "b"), summary("b", "Cycle B", "a")];
    const rows = documentTree(documents);
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.document.id)).size).toBe(5);
    expect(rows.find((row) => row.document.id === "child")?.depth).toBe(1);
    expect(rows.find((row) => row.document.id === "orphan")?.depth).toBe(0);
    expect(rows.findIndex((row) => row.document.id === "parent")).toBeLessThan(rows.findIndex((row) => row.document.id === "child"));
  });

  test("encodes document destinations and selects the canonical knowledge graph node", () => {
    expect(documentHref("record/a")).toBe("/documents?doc=record%2Fa");
    const graph = new URL(documentGraphHref("record/a"), "https://example.com");
    expect(graph.searchParams.get("node")).toBe("knowledge:record/a");
    expect(graph.searchParams.get("lens")).toBe("knowledge");
    expect(graph.searchParams.get("view")).toBe("list");
  });

  test("presents useful Convex errors without exposing a stack trace", () => {
    expect(documentError(new Error("[CONVEX]\nUncaught Error: Reload properties before saving.\n    at handler"))).toBe("Reload properties before saving.");
    expect(documentError(null)).toBe("Check your connection and try again.");
  });

  test("renders Markdown headings, lists, and tables", () => {
    render(<DocumentPreview content={"## Access policy\n\n- Request review\n\n| Role | Access |\n| --- | --- |\n| Owner | Review |"} />);
    expect(screen.getByRole("heading", { name: "Access policy" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("Request review");
    expect(screen.getByRole("table")).toHaveTextContent("Owner");
  });

  test("blocks raw HTML and script URLs and never loads untrusted embedded images", () => {
    const view = render(<DocumentPreview content={'<script>alert("x")</script>\n\n[Unsafe](javascript:alert%281%29)\n\n![Architecture](https://example.com/tracking.png)'} />);
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.querySelector('[href^="javascript:"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Architecture" })).toHaveAttribute("href", "https://example.com/tracking.png");
  });

  test("shows an intentional empty preview", () => {
    render(<DocumentPreview content="   " />);
    expect(screen.getByLabelText("Document preview")).toHaveTextContent("This document is empty.");
  });
});
