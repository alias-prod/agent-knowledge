import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseMessage } from "@openuidev/lang-core";
import { AssistantResult, assistantLibrary } from "../../apps/web/components/assistant/AssistantResult";
import { answerMessage, specification, safeAssistantHref } from "../../apps/web/lib/assistant/presentation";

describe("assistant OpenUI presentation boundary", () => {
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
