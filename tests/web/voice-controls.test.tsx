import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ audio: { start: vi.fn(), play: vi.fn(), stopInput: vi.fn(), dispose: vi.fn() }, session: { start: vi.fn(), dispose: vi.fn(), stop: vi.fn() }, update: null as null | ((update: { state: "listening" | "closed"; message?: string; seconds?: number; usageConfirmed?: boolean }) => void) }));
vi.mock("@/lib/assistant/live-audio", () => ({ createLiveAudio: () => mocks.audio }));
vi.mock("@/lib/assistant/live-session", () => ({ LIVE_MODEL: "openai/gpt-live-1.1", NativeLiveSession: vi.fn(function (_audio, update) { mocks.update = update; return mocks.session; }) }));
import { VoiceControls } from "../../apps/web/components/assistant/VoiceControls";
beforeEach(() => { mocks.update = null; vi.stubGlobal("AudioContext", class {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
test("missing exact model never requests a token or microphone and disposes unlocked playback", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ available: false, model: "openai/gpt-live-1.1", reason: "Exact model is unavailable." }));
  vi.stubGlobal("fetch", fetcher);
  render(<VoiceControls workspace="isolated" active />);
  fireEvent.click(screen.getByRole("button", { name: "Start Voice" }));
  expect(await screen.findByText("Exact model is unavailable.")).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(mocks.audio.start).not.toHaveBeenCalled(); expect(mocks.audio.dispose).toHaveBeenCalled();
  expect(mocks.session.start).not.toHaveBeenCalled();
});
test("closing during availability prevents stale startup and disposes audio", async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(done => { resolve = done; })));
  const view = render(<VoiceControls workspace="isolated" active />);
  fireEvent.click(screen.getByRole("button", { name: "Start Voice" }));
  view.unmount();
  await act(async () => resolve(Response.json({ available: true, model: "openai/gpt-live-1.1" })));
  expect(mocks.session.start).not.toHaveBeenCalled(); expect(mocks.audio.dispose).toHaveBeenCalled();
});
test("hypothetical exact-model credentials use native transport; workspace change disposes it", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ available: true, model: "openai/gpt-live-1.1" }))
    .mockResolvedValueOnce(Response.json({ model: "openai/gpt-live-1.1", token: "single-use", expiresAt: Date.now() / 1000 + 60 })));
  const view = render(<VoiceControls workspace="isolated" active />);
  fireEvent.click(screen.getByRole("button", { name: "Start Voice" }));
  await waitFor(() => expect(mocks.session.start).toHaveBeenCalledOnce());
  view.rerender(<VoiceControls workspace="different" active />);
  expect(mocks.session.dispose).toHaveBeenCalled();
});
test("a hidden page aborts pending startup and enables a new explicit attempt", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
  render(<VoiceControls workspace="isolated" active />);
  fireEvent.click(screen.getByRole("button", { name: "Start Voice" }));
  fireEvent(window, new Event("pagehide"));
  expect(screen.getByRole("button", { name: "Start Voice" })).toBeEnabled();
  expect(screen.getByRole("status")).toHaveTextContent("Voice startup canceled");
  expect(screen.getByRole("status")).not.toHaveTextContent("usage");
  expect(mocks.session.start).not.toHaveBeenCalled();
});

test("idle pagehide and visibility changes create no voice or usage warning", () => {
  render(<VoiceControls workspace="isolated" active />);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(window, new Event("pagehide"));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(mocks.session.dispose).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

test("blocked exact-model status survives repeated visibility and pagehide events", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ available: false, reason: "Exact model unavailable. Your microphone has not been accessed." })));
  render(<VoiceControls workspace="isolated" active />);
  fireEvent.click(screen.getByRole("button", { name: "Start Voice" }));
  await screen.findByText("Exact model unavailable. Your microphone has not been accessed.");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(window, new Event("pagehide"));
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("status")).toHaveTextContent("Exact model unavailable. Your microphone has not been accessed.");
  expect(screen.getByRole("status")).not.toHaveTextContent("usage");
  expect(mocks.audio.start).not.toHaveBeenCalled(); expect(mocks.session.start).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

async function startHypotheticalSession() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ available: true, model: "openai/gpt-live-1.1" }))
    .mockResolvedValueOnce(Response.json({ model: "openai/gpt-live-1.1", token: "single-use", expiresAt: Date.now() / 1000 + 60 })));
  render(<VoiceControls workspace="isolated" active />);
  fireEvent.click(screen.getByRole("button", { name: "Start Voice" }));
  await waitFor(() => expect(mocks.session.start).toHaveBeenCalledOnce());
}

test("an actual session reference is disposed on hide and retains the interruption warning", async () => {
  await startHypotheticalSession();
  act(() => mocks.update?.({ state: "listening" }));
  fireEvent(window, new Event("pagehide"));
  expect(mocks.session.dispose).toHaveBeenCalledOnce();
  expect(screen.getByRole("status")).toHaveTextContent("Voice stopped because the page was hidden. Final provider usage may be unconfirmed.");
  fireEvent(window, new Event("pagehide"));
  expect(mocks.session.dispose).toHaveBeenCalledOnce();
});

test("a finalized session keeps its confirmed usage after pagehide", async () => {
  await startHypotheticalSession();
  act(() => mocks.update?.({ state: "closed", message: "Session ended.", seconds: 12, usageConfirmed: true }));
  fireEvent(window, new Event("pagehide"));
  expect(screen.getByRole("status")).toHaveTextContent("Session ended.");
  expect(screen.getByText(/Final usage confirmed/)).toBeInTheDocument();
  expect(mocks.session.dispose).not.toHaveBeenCalled();
});
