export type InferenceErrorCategory = "access" | "transient";

export type InferenceError = {
  category: InferenceErrorCategory;
  code: "assistant_inference_access_denied" | "assistant_inference_failed";
  message: string;
  status: 403 | 502;
};

export type InferenceErrorLogContext =
  | { route: "ask-answer"; trustedRequestId: string }
  | { route: "assistant" };

const ACCESS_MESSAGE = "AI Gateway rejected access to openai/gpt-6-luna for this request. Ask your team administrator to review the Gateway request details and credential entitlement. Direct commands such as Open Documents, Find onboarding, and Show ontology graph still work. No changes were automatically saved.";
const FAILURE_MESSAGE = "The assistant could not complete this request. No changes were automatically saved. Retry, or use workspace search.";
const MAX_NODES = 24;
const MAX_DEPTH = 4;
const MAX_TEXT = 400;
const NESTED_FIELDS = ["cause", "error", "errors", "data", "body", "response", "responseBody"] as const;
const TEXT_FIELDS = ["message", "detail", "error_description"] as const;

function ownValue(value: object, field: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function accessTierText(value: string) {
  const text = value.slice(0, MAX_TEXT).replaceAll(/\s+/g, " ").toLowerCase();
  return /\bfree tier users? do not have access\b/.test(text) || (/\b(access tier|credential entitlement)\b/.test(text) && /\b(?:denied|rejected|do not have access)\b/.test(text));
}

/** Classifies only a small, fixed subset of an untrusted SDK error. */
export function classifyInferenceError(error: unknown): InferenceError {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];
  const seen = new Set<object>();
  let inspected = 0;
  let accessTierRejected = false;

  while (pending.length && inspected < MAX_NODES && !accessTierRejected) {
    const current = pending.shift()!;
    if (typeof current.value === "string") {
      accessTierRejected = accessTierText(current.value);
      continue;
    }
    if (!current.value || typeof current.value !== "object" || current.depth > MAX_DEPTH || seen.has(current.value)) continue;
    seen.add(current.value);
    inspected++;
    for (const field of TEXT_FIELDS) {
      const value = ownValue(current.value, field);
      if (typeof value === "string" && accessTierText(value)) { accessTierRejected = true; break; }
    }
    if (accessTierRejected || current.depth === MAX_DEPTH) continue;
    for (const field of NESTED_FIELDS) {
      const value = ownValue(current.value, field);
      if (value !== undefined) pending.push({ value, depth: current.depth + 1 });
    }
    if (Array.isArray(current.value)) {
      for (const value of current.value.slice(0, 8)) pending.push({ value, depth: current.depth + 1 });
    }
  }

  return accessTierRejected
    ? { category: "access", code: "assistant_inference_access_denied", message: ACCESS_MESSAGE, status: 403 }
    : { category: "transient", code: "assistant_inference_failed", message: FAILURE_MESSAGE, status: 502 };
}

/** Logs fixed metadata only. Never log an SDK error object or its properties. */
export function logInferenceError(error: unknown, context: InferenceErrorLogContext) {
  const classified = classifyInferenceError(error);
  const metadata: Record<string, string | number> = {
    class: "assistant-inference-error",
    category: classified.category,
    status: classified.status,
    route: context.route,
  };
  if (context.route === "ask-answer") metadata.requestId = context.trustedRequestId;
  console.error(metadata);
  return classified;
}
