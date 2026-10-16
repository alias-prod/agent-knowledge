import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ audio: { start: vi.fn(), play: vi.fn(), stopInput: vi.fn(), dispose: vi.fn() }, session: { start: vi.fn(), dispose: vi.fn(), stop: vi.fn() } }));
vi.mock("@/lib/assistant/live-audio", () => ({ createLiveAudio: () => mocks.audio }));
vi.mock("@/lib/assistant/live-session", () => ({ LIVE_MODEL: "openai/gpt-live-1.1", NativeLiveSession: vi.fn(function () { return mocks.session; }) }));
import { VoiceControls } from "../../apps/web/components/assistant/VoiceControls";
beforeEach(() => { vi.stubGlobal("AudioContext", class {}); });
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
  expect(screen.getByRole("status")).toHaveTextContent("Voice stopped");
});
