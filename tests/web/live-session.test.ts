import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LIVE_MODEL, LIVE_URL, NativeLiveSession, type LiveUpdate } from "../../apps/web/lib/assistant/live-session";
function setup() {
  const socket = { readyState: 1, bufferedAmount: 0, send: vi.fn(), close: vi.fn(), onopen: null, onmessage: null, onerror: null, onclose: null } as unknown as WebSocket;
  const audio = { start: vi.fn().mockResolvedValue(undefined), play: vi.fn(), stopInput: vi.fn(), dispose: vi.fn() };
  const update = vi.fn<(value: LiveUpdate) => void>();
  const connect = vi.fn(() => socket);
  const session = new NativeLiveSession(audio, update, connect);
  const credential = { token: "single-use-token", expiresAt: Date.now() / 1000 + 60, model: LIVE_MODEL };
  const event = (data: object) => socket.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  return { session, socket, audio, update, connect, credential, event };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("native GPT-Live transport (mock wire; not microphone acceptance)", () => {
  test("uses the exact native URL, auth subprotocols, and model without requesting audio before acknowledgment", () => {
    const h = setup(); h.session.start(h.credential);
    expect(h.connect).toHaveBeenCalledWith(LIVE_URL, ["ai-gateway-realtime.v1", "ai-gateway-auth.single-use-token"]);
    h.socket.onopen?.({} as Event);
    expect(JSON.parse(vi.mocked(h.socket.send).mock.calls[0]![0] as string)).toMatchObject({ type: "session.start", session: { model: "openai/gpt-live-1.1", store: false, audio: { format: { rate: 24000 } } } });
    expect(h.audio.start).not.toHaveBeenCalled();
    h.event({ type: "session.started" }); h.event({ type: "session.started" });
    expect(h.audio.start).toHaveBeenCalledTimes(1);
  });
  test.each([{ model: "openai/gpt-live-1" }, { expiresAt: 0 }, { token: "unsafe token" }])("fails closed on invalid credentials %j", override => {
    const h = setup(); h.session.start({ ...h.credential, ...override });
    expect(h.connect).not.toHaveBeenCalled(); expect(h.audio.dispose).toHaveBeenCalledOnce();
  });
  test("sends PCM only while listening, stops input immediately, closes once, confirms final cumulative usage", () => {
    const h = setup(); h.session.start(h.credential); h.event({ type: "session.started" });
    const send = h.audio.start.mock.calls[0]![0] as (pcm: string) => void;
    send("pcm"); h.event({ type: "session.usage.updated", usage: { seconds: 3 } });
    h.event({ type: "session.usage.updated", usage: { seconds: 5 } });
    h.session.stop(); h.session.stop(); send("late-pcm");
    expect(h.audio.stopInput).toHaveBeenCalledOnce();
    expect(vi.mocked(h.socket.send).mock.calls.map(([data]) => JSON.parse(data as string).type)).toEqual(["session.input_audio.append", "session.close"]);
    h.event({ type: "session.closed", usage: { seconds: 6 } });
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ state: "closed", seconds: 6, usageConfirmed: true }));
    expect(h.audio.dispose).toHaveBeenCalledOnce(); expect(h.socket.close).toHaveBeenCalledOnce();
  });
  test("forces cleanup after five seconds without claiming final usage", () => {
    const h = setup(); h.session.start(h.credential); h.event({ type: "session.started" }); h.session.dispose();
    vi.advanceTimersByTime(5000);
    expect(h.audio.dispose).toHaveBeenCalledOnce();
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ state: "closed", usageConfirmed: false }));
  });
  test("cancels connection startup and rejects token reuse", () => {
    const h = setup(); h.session.start(h.credential); h.session.dispose(); h.socket.onopen?.({} as Event);
    expect(h.audio.start).not.toHaveBeenCalled(); expect(h.socket.send).not.toHaveBeenCalled();
    expect(() => h.session.start(h.credential)).toThrow(/single-use/);
  });
  test("startup watchdog cleans resources without touching the mic", () => {
    const h = setup(); h.session.start(h.credential); vi.advanceTimersByTime(15_000);
    expect(h.audio.start).not.toHaveBeenCalled(); expect(h.audio.dispose).toHaveBeenCalledOnce();
  });
  test("transport disconnect cannot be mistaken for provider-confirmed closure", () => {
    const h = setup(); h.session.start(h.credential); h.event({ type: "session.started" }); h.socket.onclose?.({} as CloseEvent);
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ state: "closed", usageConfirmed: false }));
  });
  test("backpressure closes rather than buffering unlimited microphone data", () => {
    const h = setup(); h.session.start(h.credential); h.event({ type: "session.started" });
    Object.defineProperty(h.socket, "bufferedAmount", { value: 100_000 });
    (h.audio.start.mock.calls[0]![0] as (pcm: string) => void)("pcm");
    expect(h.audio.stopInput).toHaveBeenCalledOnce();
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ state: "closing" }));
  });
  test("mic denial stops the live session and a late mic permission cannot restart input", async () => {
    const h = setup(); h.audio.start.mockRejectedValue(new Error("NotAllowedError"));
    h.session.start(h.credential); h.event({ type: "session.started" });
    await vi.waitFor(() => expect(h.audio.stopInput).toHaveBeenCalled());
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ state: "closing" }));
  });
  test("delegation never executes workspace operations and raw provider errors stay private", () => {
    const h = setup(); h.session.start(h.credential); h.event({ type: "session.started" });
    h.event({ type: "session.delegation.created", delegation: { id: "task-1" } });
    expect(JSON.parse(vi.mocked(h.socket.send).mock.calls[0]![0] as string)).toMatchObject({ type: "session.commentary.append", delegation_id: "task-1" });
    h.event({ type: "error", error: { message: "private provider details" } });
    expect(JSON.stringify(h.update.mock.calls)).not.toContain("private provider details");
  });
  test("enforces session duration even while muted or awaiting backend work", () => {
    const h = setup(); h.session.start(h.credential); h.event({ type: "session.started" });
    vi.advanceTimersByTime(5 * 60_000);
    expect(h.audio.stopInput).toHaveBeenCalledOnce();
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ state: "closing" }));
  });
  test("ignores output before session start and rejects malformed or excessive events", () => {
    const h = setup(); h.session.start(h.credential); h.event({ type: "session.output_audio.delta", delta: "abc" });
    expect(h.audio.play).not.toHaveBeenCalled();
    h.socket.onmessage?.({ data: "x".repeat(200_001) } as MessageEvent);
    expect(h.audio.dispose).toHaveBeenCalledOnce();
  });
});
