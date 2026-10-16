import { createRoot } from "react-dom/client";
import type { AssistantReadResult } from "@agent-knowledge/shared";
import { AssistantCompanion } from "../../apps/web/components/assistant/AssistantCompanion";
import { answerMessage } from "../../apps/web/lib/assistant/presentation";
import "../../apps/web/app/globals.css";

// This Vite-only fixture never imports the real auth provider or contacts a backend.
window.fetch = async (_input, options) => {
  const { question } = JSON.parse(String(options?.body ?? "{}"));
  const result: AssistantReadResult = question === "Open Documents"
    ? { kind: "navigation", title: "Documents", href: "/documents", status: "pending-client" }
    : { kind: "discovery", scope: "metadata-only", hasMore: false, items: [{ kind: "document", id: "fixture-policy", title: "Fixture onboarding policy", href: "/documents?doc=fixture-policy" }] };
  const text = result.kind === "navigation" ? "Ready to open Documents. Select the link below." : "Fixture matching workspace titles.";
  return new Response([JSON.stringify({ type: "text", delta: text }), JSON.stringify({ type: "complete", message: answerMessage(text, [result]), discoveries: [result], sources: [] }), ""].join("\n"));
};
createRoot(document.getElementById("root")!).render(<main className="p-5 font-sans"><h1>Assistant component fixture</h1><p>No real account, session, backend, models, or writes. Not signed-in acceptance.</p><AssistantCompanion /></main>);
