export const LIVE_MODEL = "openai/gpt-live-1.1";
export const LIVE_URL = "wss://ai-gateway.vercel.sh/v1/live/sessions";
export type LiveState = "connecting" | "listening" | "closing" | "closed";
export type LiveUpdate = { state: LiveState; message?: string; seconds?: number; usageConfirmed?: boolean };
export type LiveAudio = {
  start: (send: (pcm: string) => void, interrupted: () => void) => Promise<void>;
  play: (pcm: string) => void;
  stopInput: () => void;
  dispose: () => void;
};
type Credential = { token: string; expiresAt: number; model: string };

export class NativeLiveSession {
  private socket: WebSocket | null = null;
  private state: LiveState = "connecting";
  private started = false;
  private used = false;
  private finalized = false;
  private seconds: number | undefined;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private startupTimer?: ReturnType<typeof setTimeout>;
  private message?: string;
  constructor(private readonly audio: LiveAudio, private readonly update: (update: LiveUpdate) => void,
    private readonly connect: (url: string, protocols: string[]) => WebSocket = (url, protocols) => new WebSocket(url, protocols)) {}

  start(credential: Credential) {
    if (this.used) throw new Error("Create a new session and single-use token for each attempt.");
    this.used = true;
    if (credential.model !== LIVE_MODEL || !credential.token || !/^[A-Za-z0-9._~-]+$/.test(credential.token) || !Number.isFinite(credential.expiresAt) || credential.expiresAt * 1000 <= Date.now()) {
      this.finish(false, "Voice credentials are expired or do not match the requested model.");
      return;
    }
    try {
      this.update({ state: "connecting" });
      const socket = this.connect(LIVE_URL, ["ai-gateway-realtime.v1", `ai-gateway-auth.${credential.token}`]);
      this.socket = socket;
      this.startupTimer = this.later(() => this.stop("Voice startup timed out. Final provider usage is unconfirmed."), 15_000);
      this.later(() => this.stop("Voice session time limit reached."), 5 * 60_000);
      socket.onopen = () => {
        if (this.state !== "connecting") return;
        this.send({ type: "session.start", session: { model: LIVE_MODEL, store: false,
          delegation: { type: "client" }, audio: { format: { type: "audio/pcm", rate: 24000 } },
          instructions: "Keep replies brief. You have no access to workspace facts or actions in this voice session. Direct workspace questions and changes to the text companion. Never claim to run tools, retrieve sources, or save changes." } });
      };
      socket.onmessage = event => this.receive(event.data);
      socket.onerror = () => this.stop("Voice transport failed. Final provider usage may be unconfirmed.");
      socket.onclose = () => this.finish(false, this.message ?? "Voice disconnected. Final provider usage is unconfirmed.");
    } catch { this.finish(false, "Voice could not connect. No alternative model was used."); }
  }

  private later(run: () => void, delay: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); run(); }, delay);
    this.timers.add(timer);
    return timer;
  }
  private send(event: object) {
    if (this.socket?.readyState !== 1) return false;
    try { this.socket.send(JSON.stringify(event)); return true; }
    catch { this.finish(false, "Voice transport failed. Final provider usage is unconfirmed."); return false; }
  }
  private receive(raw: unknown) {
    if (this.finalized) return;
    try {
      if (typeof raw !== "string" || raw.length > 200_000) throw new Error();
      const event = JSON.parse(raw);
      if (!event || typeof event.type !== "string") throw new Error();
      if (event.type === "session.started" && this.state === "connecting" && !this.started) {
        this.started = true;
        clearTimeout(this.startupTimer);
        this.state = "listening";
        this.update({ state: "listening" });
        void this.audio.start(pcm => {
          if (this.state !== "listening") return;
          if (!this.socket || this.socket.bufferedAmount > 96_000) { this.stop("Voice network is too slow. Session stopped."); return; }
          this.send({ type: "session.input_audio.append", audio: pcm });
        }, () => this.stop("Microphone capture ended. Voice stopped.")).then(() => {
          if (this.state !== "listening") this.audio.stopInput();
        }).catch(() => this.stop("Microphone is unavailable or permission was denied. Voice stopped."));
      } else if (event.type === "session.output_audio.delta" && this.started && typeof event.delta === "string") {
        this.audio.play(event.delta);
      } else if (event.type === "session.delegation.created" && this.state === "listening") {
        if (typeof event.delegation?.id !== "string" || event.delegation.id.length > 200) throw new Error();
        this.send({ type: "session.commentary.append", delegation_id: event.delegation.id,
          content: "Workspace tools are not connected to this voice session. Please use the text companion for grounded workspace answers and approval-based changes." });
      } else if (event.type === "session.usage.updated" || event.type === "session.closed") {
        const seconds = event.usage?.seconds;
        if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0 || (this.seconds !== undefined && seconds < this.seconds)) throw new Error();
        this.seconds = seconds;
        if (event.type === "session.closed") this.finish(true, this.message);
        else this.update({ state: this.state, seconds, usageConfirmed: false });
      } else if (event.type === "error") this.stop("The requested voice model rejected or failed this session. No substitute was used.");
    } catch { this.stop("Voice returned an invalid event. Session stopped; final usage may be unconfirmed."); }
  }

  stop(message?: string) {
    if (this.finalized || this.state === "closing") return;
    this.message = message;
    this.state = "closing";
    this.audio.stopInput();
    this.update({ state: "closing", message, seconds: this.seconds, usageConfirmed: false });
    if (!this.started || !this.send({ type: "session.close" })) { this.finish(false, message); return; }
    this.later(() => this.finish(false, "Voice stopped without final provider acknowledgment. Final usage is unconfirmed."), 5000);
  }
  dispose() {
    this.stop("Voice ended because the page, workspace, or companion changed.");
  }
  private finish(confirmed: boolean, message?: string) {
    if (this.finalized) return;
    this.finalized = true;
    this.state = "closed";
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.audio.dispose();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      if (socket.readyState < 2) socket.close();
    }
    this.update({ state: "closed", message, seconds: this.seconds, usageConfirmed: confirmed });
  }
}
