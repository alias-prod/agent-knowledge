import { describe, expect, test, vi } from "vitest";
import { classifyInferenceError, logInferenceError } from "../../apps/web/lib/assistant/inference-error";

describe("safe assistant inference error classification", () => {
  test("recognizes the verified Gateway access-tier rejection through bounded nesting", () => {
    const error = { response: { status: 403, responseBody: { error: { message: "Free tier users do not have access to this model" } } } };
    expect(classifyInferenceError(error)).toMatchObject({ category: "access", code: "assistant_inference_access_denied", status: 403 });
  });

  test("handles cyclic unknown values and returns a stable transient failure", () => {
    const error: Record<string, unknown> = { message: "provider diagnostic secret=do-not-disclose" };
    error.cause = { responseBody: error };
    const result = classifyInferenceError(error);
    expect(result).toEqual(expect.objectContaining({ category: "transient", code: "assistant_inference_failed", status: 502 }));
    expect(result.message).not.toContain("secret=do-not-disclose");
  });

  test("logs fixed metadata only, with a request id only for a trusted generated id", () => {
    const secret = "prompt=do-not-log responseBody=do-not-log authorization=do-not-log";
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = logInferenceError({ message: secret, headers: { authorization: secret }, responseBody: secret }, { route: "ask-answer", trustedRequestId: "generated-request-id" });
    expect(result.message).not.toContain(secret);
    expect(logger).toHaveBeenCalledWith({ class: "assistant-inference-error", category: "transient", status: 502, route: "ask-answer", requestId: "generated-request-id" });
    expect(JSON.stringify(logger.mock.calls)).not.toContain(secret);
    logger.mockRestore();
  });

  test("does not log the caller-provided companion request id", () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logInferenceError(new Error("temporary provider failure"), { route: "assistant" });
    expect(logger).toHaveBeenCalledWith({ class: "assistant-inference-error", category: "transient", status: 502, route: "assistant" });
    logger.mockRestore();
  });
});
