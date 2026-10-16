"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { Renderer, createLibrary, defineComponent } from "@openuidev/react-lang";
import { parseMessage } from "@openuidev/lang-core";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { presentationComponents, safeAssistantHref, ASSISTANT_LIBRARY_VERSION } from "@/lib/assistant/presentation";

function ResultLink({ title, href, detail }: { title: string; href: string; detail: string }) {
  const destination = safeAssistantHref(href);
  return destination ? <Link href={destination} className="flex min-h-11 flex-col gap-1 rounded-md border border-border p-3 focus-visible:outline-2 focus-visible:outline-ring"><span className="break-words text-sm font-medium">{title}</span><span className="text-sm text-muted-foreground">{detail}</span></Link> : null;
}
function CanonicalOperation({ requestId }: { requestId: string }) {
  const { organizationId } = useAuth();
  const operations = useQuery(api.assistantOperations.listOperations, { organizationId, requestId });
  return <p className="text-sm text-muted-foreground">{operations === undefined ? "Checking operation status…" : operations.length ? operations.map(operation => operation.status === "committed" ? "Draft saved" : operation.status === "cancelled" ? "Proposal cancelled" : "Awaiting your explicit confirmation").join(". ") : "No current operation for this session."}</p>;
}
const [answer, documentCard, search, graph, clarification, draft, operation, confirmation, stack] = presentationComponents;
export const assistantLibrary = createLibrary({ id: ASSISTANT_LIBRARY_VERSION, components: [
  defineComponent({ ...answer!, component: ({ props }) => <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{props.text}</p> }),
  defineComponent({ ...documentCard!, component: ({ props }) => <ResultLink {...props} /> }),
  defineComponent({ ...search!, component: ({ props }) => <div className="flex flex-col gap-2">{props.items.length ? props.items.map((item, index) => <ResultLink key={index} {...item} />) : <p className="text-sm text-muted-foreground">No matching workspace titles.</p>}</div> }),
  defineComponent({ ...graph!, component: ({ props }) => <ResultLink {...props} /> }),
  defineComponent({ ...clarification!, component: ({ props }) => <nav aria-label="Clarify destination" className="flex flex-col gap-2">{props.options.map((item, index) => <ResultLink key={index} {...item} />)}</nav> }),
  defineComponent({ ...draft!, component: ({ props }) => <section className="flex flex-col gap-2"><h4 className="text-sm font-medium">Preview: {props.title}</h4><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{props.content}</p><p className="text-sm text-muted-foreground">Not saved. Only the separate trusted review card can authorize a change.</p></section> }),
  defineComponent({ ...operation!, component: ({ props }) => <CanonicalOperation requestId={props.requestId} /> }),
  defineComponent({ ...confirmation!, component: () => <p className="text-sm text-muted-foreground">Use the separate Review Before Saving card. Generated content cannot approve a change.</p> }),
  defineComponent({ ...stack!, component: ({ props, renderNode }) => <div className="flex flex-col gap-4">{renderNode(props.children)}</div> }),
] });
export function AssistantResult({ message, fallback }: { message: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  const parsed = parseMessage(message);
  if (failed || parsed.attributes.library !== ASSISTANT_LIBRARY_VERSION || parsed.content.length > 30_000 || /\b(?:Query|Mutation)\s*\(/.test(parsed.content)) return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{fallback}</p>;
  return <Renderer library={assistantLibrary} response={message} isStreaming={false} publishObservability={false} toolProvider={null} onError={errors => { if (errors.some(error => error.severity !== "warning")) setFailed(true); }} />;
}
