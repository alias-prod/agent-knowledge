import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AssistantCompanion } from "../../apps/web/components/assistant/AssistantCompanion";
import { answerMessage } from "../../apps/web/lib/assistant/presentation";
const state = vi.hoisted(() => ({ cancel: vi.fn(), deleteHistory: vi.fn() }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ organizationId: "workspace-a", authOrganizationId: "auth-workspace-a" }) }));
vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => state.cancel }));
vi.mock("../../apps/web/components/assistant/DraftApproval", () => ({ DraftApproval: () => null }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.clearAllMocks();
  state.cancel.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());
describe("workspace assistant interaction", () => {
  test("opens as an accessible sheet, renders grounded results, and keeps history opt-in", async () => {
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "text", delta: "Verified response [1]" }) + "\n" + JSON.stringify({ type: "complete", message: answerMessage("Verified response [1]"), sources: [{ id: "policy", title: "Approved Policy", href: "/documents?doc=policy" }], discoveries: [] }) + "\n")); controller.close(); } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<AssistantCompanion />);
    fireEvent.click(screen.getByRole("button", { name: "Open Ask ALIAS companion" }));
    expect(screen.getByRole("dialog", { name: "Ask ALIAS" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Ask ALIAS" }), { target: { value: "What is the policy?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Question" }));
    await waitFor(() => expect(screen.getByText("Verified response [1]")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "[1] Approved Policy" })).toHaveAttribute("href", "/documents?doc=policy");
    const payload = JSON.parse(fetcher.mock.calls[0]![1]!.body as string);
    expect(payload.historyEnabled).toBe(false); expect(payload).not.toHaveProperty("sources");
    fireEvent.click(screen.getByRole("button", { name: "Collapse Ask ALIAS" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  test("voice release failure never accesses a microphone", async () => {
    const microphone = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: microphone } });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ available: false, reason: "GPT-Live 1.1 is not available. Your microphone has not been accessed." })));
    render(<AssistantCompanion />);
    fireEvent.click(screen.getByRole("button", { name: "Open Ask ALIAS companion" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Voice" }));
    await waitFor(() => expect(screen.getByText(/GPT-Live 1.1 is not available/)).toBeInTheDocument());
    expect(microphone).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Open Workspace in New Tab" })).toHaveAttribute("target", "_blank");
  });
  test("cancel aborts streaming and invalidates server proposals", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, options) => { signal = options.signal; return new Promise((_resolve, reject) => { signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))); }); }));
    render(<AssistantCompanion />);
    fireEvent.click(screen.getByRole("button", { name: "Open Ask ALIAS companion" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Ask ALIAS" }), { target: { value: "Find policy" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Question" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel Task" })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel Task" })); });
    expect(signal?.aborted).toBe(true);
    expect(state.cancel).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "workspace-a" }));
  });
});
