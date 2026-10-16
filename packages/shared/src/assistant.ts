import { NAV_COMMANDS } from "./navigation";

export const ASSISTANT_LIMITS = { query: 120, results: 10, recordId: 64, label: 200 } as const;

const stringField = (minLength: number, maxLength: number) => ({ type: "string" as const, minLength, maxLength });
const objectSchema = (properties: Record<string, StringSchema>) => ({
  type: "object" as const, properties, required: Object.keys(properties), additionalProperties: false as const,
});
type StringSchema = { type: "string"; minLength?: number; maxLength?: number; enum?: readonly string[] };
const policy = { requiredCapability: "workspace.read", minimumRole: "member", risk: "read", confirmation: "none" } as const;

export const ASSISTANT_COMMANDS = {
  navigate: {
    ...policy, execution: "client", result: "navigation-intent",
    description: "Prepare navigation to an allowlisted workspace page; success requires a client mount acknowledgment.",
    inputSchema: objectSchema({ route: { type: "string", enum: NAV_COMMANDS.map(({ href }) => href) } }),
  },
  "graph.view": {
    ...policy, execution: "server", result: "navigation-intent",
    description: "Prepare a graph view with validated lens, search, status, and view. A document ID may select or focus an accessible knowledge node.",
    inputSchema: objectSchema({ lens: { type: "string", enum: ["knowledge", "context", "ontology"] }, query: stringField(0, ASSISTANT_LIMITS.query), status: { type: "string", enum: ["all", "draft", "verified"] }, view: { type: "string", enum: ["list", "3d"] }, documentId: stringField(0, ASSISTANT_LIMITS.recordId), focus: { type: "string", enum: ["yes", "no"] } }),
  },
  search: {
    ...policy, execution: "server", result: "discovery-metadata",
    description: "Find workspace document titles or active agent names. Results are metadata, not authorized answer sources.",
    inputSchema: objectSchema({ query: stringField(1, ASSISTANT_LIMITS.query), entity: { type: "string", enum: ["document", "agent", "all"] } }),
  },
  "open.document": {
    ...policy, execution: "server", result: "navigation-intent",
    description: "Resolve an accessible document ID into a navigation intent without returning its contents.",
    inputSchema: objectSchema({ id: stringField(1, ASSISTANT_LIMITS.recordId) }),
  },
} as const;

export type AssistantCommand =
  | { name: "navigate"; args: { route: string } }
  | { name: "search"; args: { query: string; entity: "document" | "agent" | "all" } }
  | { name: "open.document"; args: { id: string } }
  | { name: "graph.view"; args: { lens: "knowledge" | "context" | "ontology"; query: string; status: "all" | "draft" | "verified"; view: "list" | "3d"; documentId: string; focus: "yes" | "no" } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAssistantCommand(value: unknown): AssistantCommand {
  const invalid = () => { throw new Error("Invalid assistant command"); };
  if (!isRecord(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, "name") || !Object.hasOwn(value, "args")) return invalid();
  if (typeof value.name !== "string" || !Object.hasOwn(ASSISTANT_COMMANDS, value.name) || !isRecord(value.args)) return invalid();
  const definition = ASSISTANT_COMMANDS[value.name as keyof typeof ASSISTANT_COMMANDS];
  const fields = definition.inputSchema.properties;
  if (Object.keys(value.args).length !== definition.inputSchema.required.length) return invalid();
  for (const [key, field] of Object.entries(fields)) {
    const argument = value.args[key];
    if (!Object.hasOwn(value.args, key) || typeof argument !== "string" || argument !== argument.trim() || /[\u0000-\u001f\u007f]/.test(argument)) return invalid();
    if (field.minLength !== undefined && argument.length < field.minLength) return invalid();
    if (field.maxLength !== undefined && argument.length > field.maxLength) return invalid();
    if (field.enum && !field.enum.includes(argument)) return invalid();
  }
  return value as AssistantCommand;
}

export function assistantShortcut(question: string): AssistantCommand | null {
  const text = question.trim();
  const open = /^open (.+)$/i.exec(text);
  if (open) {
    const route = NAV_COMMANDS.find(command => command.label.toLowerCase() === open[1]!.toLowerCase() || command.href === open[1]);
    if (route) return { name: "navigate", args: { route: route.href } };
  }
  const find = /^find (.+)$/i.exec(text);
  if (find && find[1]!.length <= ASSISTANT_LIMITS.query && !/[\u0000-\u001f\u007f]/.test(find[1]!)) return { name: "search", args: { query: find[1]!, entity: "all" } };
  const graph = /^show (knowledge|context|ontology) graph$/i.exec(text);
  if (graph) return { name: "graph.view", args: { lens: graph[1]!.toLowerCase() as "knowledge" | "context" | "ontology", query: "", status: "all", view: "list", documentId: "", focus: "no" } };
  return null;
}

export type AssistantDiscoveryItem = {
  kind: "document" | "agent";
  id: string;
  title: string;
  href: string;
};

export type AssistantReadResult =
  | { kind: "navigation"; href: string; title: string; status: "pending-client" }
  | { kind: "discovery"; items: AssistantDiscoveryItem[]; hasMore: boolean; scope: "metadata-only" };
