import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildMessage, createParser, parseMessage } from "@openuidev/lang-core";
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { AssistantResult, assistantLibrary } from "../../apps/web/components/assistant/AssistantResult";
import { answerMessage, specification, safeAssistantHref } from "../../apps/web/lib/assistant/presentation";

describe("assistant OpenUI presentation boundary", () => {
  test("completed Open Documents renders an accessible actionable destination", async () => {
    render(<AssistantResult message={answerMessage("Ready to open Documents. Select the link below.", [{ kind: "navigation", title: "Documents", href: "/documents", status: "pending-client" }])} fallback="Ready to open Documents. Select the link below." />);
    expect(await screen.findByRole("link", { name: /Documents/ })).toHaveAttribute("href", "/documents");
  });
  test("every registered component survives schema export with no parser errors", () => {
    for (const name of Object.keys(assistantLibrary.components)) expect(specification.toJSONSchema().$defs).toHaveProperty(name);
    const message = answerMessage("Ready", [{ kind: "navigation", title: "Documents", href: "/documents", status: "pending-client" }]);
    expect(createParser(specification.toJSONSchema()).parse(parseMessage(message).content).meta.errors).toEqual([]);
  });
  test("search cards render document and agent links with native focus and click semantics", async () => {
    render(<AssistantResult message={answerMessage("Matching titles", [{ kind: "discovery", scope: "metadata-only", hasMore: false, items: [
      { kind: "document", id: "policy", title: "Policy", href: "/documents?doc=policy" },
      { kind: "agent", id: "agent1", title: "Policy Agent", href: "/agents/agent1" },
    ] }])} fallback="Matching titles" />);
    const link = await screen.findByRole("link", { name: /Policy[\s\S]*document/ });
    expect(link).toHaveAttribute("href", "/documents?doc=policy");
    expect(screen.getByRole("link", { name: /Policy Agent/ })).toHaveAttribute("href", "/agents/agent1");
    link.focus(); expect(link).toHaveFocus();
    const clicked = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener("click", clicked); fireEvent.click(link); expect(clicked).toHaveBeenCalledOnce();
  });
  test("empty discovery renders an explicit empty state rather than disappearing", async () => {
    render(<AssistantResult message={answerMessage("Search finished", [{ kind: "discovery", scope: "metadata-only", hasMore: false, items: [] }])} fallback="Search finished" />);
    expect(await screen.findByText("No matching workspace titles.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  test("graph selection remains actionable alongside the document component", async () => {
    render(<AssistantResult message={answerMessage("Ready", [{ kind: "navigation", title: "Ontology", href: "/graph?lens=ontology&view=list", status: "pending-client" }])} fallback="Ready" />);
    expect(await screen.findByRole("link", { name: /Ontology/ })).toHaveAttribute("href", "/graph?lens=ontology&view=list");
  });
  test("generated draft and confirmation render read-only and cannot authorize writes", async () => {
    const message = buildMessage({ content: 'root = AssistantStack([draft, confirm])\ndraft = DraftPreview("Decision", "Proposed text")\nconfirm = ConfirmationSlot("Save now")', attributes: { library: "alias-assistant-1" }, end: true });
    render(<AssistantResult message={message} fallback="Could not render proposal" />);
    expect(await screen.findByRole("heading", { name: "Preview: Decision" })).toBeInTheDocument();
    expect(screen.getByText("Proposed text")).toBeInTheDocument();
    expect(screen.getByText(/Use the separate Review Before Saving card/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  test.each(["https://evil.test", "//evil.test", "/api/auth/sign-out", "/documents\\evil"]) ("unsafe card destination %s never becomes an anchor", href => {
    render(<AssistantResult message={answerMessage("Ready", [{ kind: "navigation", title: "Unsafe", href, status: "pending-client" }])} fallback="Ready" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  test("invalid programs show fallback text without actions", async () => {
    render(<AssistantResult message={buildMessage({ content: 'root = UnknownCard("save")', attributes: { library: "alias-assistant-1" }, end: true })} fallback="Could not display result. Try again." />);
    expect(await screen.findByText("Could not display result. Try again.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  test("server and client schemas have identical prompt specifications", () => {
    expect(assistantLibrary.toSpec()).toEqual(specification.toSpec());
  });
  test("renders safely encoded text rather than executing embedded programs or HTML", () => {
    const text = '<script>alert("no")</script> Mutation("delete")';
    render(<AssistantResult message={answerMessage(text)} fallback={text} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
  test("stores a completed, versioned message with parseable content", () => {
    const parsed = parseMessage(answerMessage("Verified answer [1]"));
    expect(parsed.attributes.library).toBe("alias-assistant-1");
    expect(parsed.end).toBe(true);
    expect(parsed.content).toContain("Verified answer [1]");
  });
  test.each(["https://evil.test", "//evil.test", "javascript:alert(1)", "/api/auth/sign-out", "/documents\\evil", "/unknown"]) ("rejects unsafe or unsupported destination %s", href => {
    expect(safeAssistantHref(href)).toBeNull();
  });
  test("accepts real document and graph deep links", () => {
    expect(safeAssistantHref("/documents?doc=abc")).toBe("/documents?doc=abc");
    expect(safeAssistantHref("/graph?lens=ontology&view=list")).toBe("/graph?lens=ontology&view=list");
  });
  test("old library versions fall back to text without executing historical actions", () => {
    render(<AssistantResult message={'<<<content library="old">>>\nroot = Mutation("delete")'} fallback="Ask again to revalidate." />);
    expect(screen.getByText("Ask again to revalidate.")).toBeInTheDocument();
  });
});
