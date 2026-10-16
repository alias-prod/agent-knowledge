import { createLibrary, defineComponent, buildMessage } from "@openuidev/lang-core";
import { z } from "zod";
import { NAV_COMMANDS, type AssistantReadResult } from "@agent-knowledge/shared";

export const ASSISTANT_LIBRARY_VERSION = "alias-assistant-1";
export const answerProps = z.object({ text: z.string().max(16000) });
export const resultProps = z.object({ title: z.string().max(200), href: z.string().max(400), detail: z.string().max(300) });
const define = <T extends z.ZodObject>(name: string, description: string, props: T) => defineComponent({ name, description, props, component: null });
export const answerComponent = define("AnswerWithSources", "Grounded response; citations are separate authoritative links.", answerProps);
export const documentComponent = define("DocumentCard", "Validated workspace record or destination.", resultProps);
export const searchComponent = define("SearchResults", "Metadata-only discovery results. Titles do not authorize using source contents.", z.object({ items: z.array(resultProps).max(10) }));
export const graphComponent = define("GraphSelection", "A validated graph destination. Opening the link is distinct from preparing it.", resultProps);
export const clarificationComponent = define("ClarificationOptions", "Two to four canonical record links to resolve ambiguous names without guessing.", z.object({ options: z.array(resultProps).min(2).max(4) }));
export const draftComponent = define("DraftPreview", "Read-only proposed text. Never an authoritative confirmation or success receipt.", z.object({ title: z.string().max(200), content: z.string().max(20_000) }));
export const operationComponent = define("OperationStatus", "Read the server-owned operation status for this actor and session; never accept a model-supplied success state.", z.object({ requestId: z.string().uuid() }));
export const confirmationComponent = define("ConfirmationSlot", "A reminder to use the trusted approval UI. Generated content cannot approve operations.", z.object({ text: z.string().max(300) }));
export const stackComponent = define("AssistantStack", "Bounded vertical composition of assistant results.", z.object({ children: z.array(z.union([answerComponent.ref, documentComponent.ref, searchComponent.ref, graphComponent.ref, clarificationComponent.ref, draftComponent.ref, operationComponent.ref, confirmationComponent.ref])).max(15) }));
export const presentationComponents = [answerComponent, documentComponent, searchComponent, graphComponent, clarificationComponent, draftComponent, operationComponent, confirmationComponent, stackComponent];
export const specification = createLibrary({ id: ASSISTANT_LIBRARY_VERSION, components: presentationComponents });
export function answerMessage(text: string, results: AssistantReadResult[] = []) {
  const statements = [`answer = AnswerWithSources(${JSON.stringify(text.slice(0, 16000))})`];
  const children = ["answer"];
  results.slice(0, 8).forEach((result, index) => {
    const name = `result${index}`;
    if (result.kind === "navigation") statements.push(`${name} = ${result.href.startsWith("/graph?") ? "GraphSelection" : "DocumentCard"}(${JSON.stringify(result.title)}, ${JSON.stringify(result.href)}, "Select to open; not yet navigated.")`);
    else statements.push(`${name} = SearchResults(${JSON.stringify(result.items.map(item => ({ title: item.title, href: item.href, detail: `${item.kind} · metadata only` })))})`);
    children.push(name);
  });
  statements.push(`root = AssistantStack([${children.join(", ")}])`);
  return buildMessage({ content: statements.join("\n"), attributes: { library: ASSISTANT_LIBRARY_VERSION }, end: true });
}
export function safeAssistantHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000-\u001f]/.test(href)) return null;
  const parsed = new URL(href, "https://alias.invalid");
  return [...NAV_COMMANDS.map(command => command.href), "/account"].some(path => parsed.pathname === path || (path === "/agents" && /^\/agents\/[a-zA-Z0-9_-]+$/.test(parsed.pathname))) ? href : null;
}
