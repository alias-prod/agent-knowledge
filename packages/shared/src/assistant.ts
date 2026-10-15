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
  | { name: "open.document"; args: { id: string } };

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

export type AssistantDiscoveryItem = {
  kind: "document" | "agent";
  id: string;
  title: string;
  href: string;
};

export type AssistantReadResult =
  | { kind: "navigation"; href: string; title: string; status: "pending-client" }
  | { kind: "discovery"; items: AssistantDiscoveryItem[]; hasMore: boolean; scope: "metadata-only" };
