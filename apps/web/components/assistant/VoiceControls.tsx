"use client";
import { useEffect, useRef, useState } from "react";
import { LIVE_MODEL, NativeLiveSession, type LiveUpdate } from "@/lib/assistant/live-session";
import { createLiveAudio } from "@/lib/assistant/live-audio";
import { Button } from "@/components/ui/button";

export function VoiceControls({ workspace, active }: { workspace: string; active: boolean }) {
  const [status, setStatus] = useState<LiveUpdate | null>(null);
  const [checking, setChecking] = useState(false);
  const session = useRef<NativeLiveSession | null>(null);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    function stop() {
      generation.current++;
      request.current?.abort();
      request.current = null;
      session.current?.dispose();
      session.current = null;
    }
    const interrupt = () => { stop(); setChecking(false); setStatus({ state: "closed", message: "Voice stopped because the page was hidden. Final provider usage may be unconfirmed." }); };
    const hide = () => { if (document.visibilityState === "hidden") interrupt(); };
    window.addEventListener("pagehide", interrupt);
    document.addEventListener("visibilitychange", hide);
    if (!active) stop();
    return () => { stop(); window.removeEventListener("pagehide", interrupt); document.removeEventListener("visibilitychange", hide); };
  }, [workspace, active]);

  async function start() {
    if (checking || (session.current && status?.state !== "closed")) return;
    const attempt = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    let audio: ReturnType<typeof createLiveAudio> | undefined;
    try {
      // Unlock playback in the click gesture; this creates no microphone stream.
      if (typeof AudioContext !== "undefined") audio = createLiveAudio();
      const response = await fetch("/api/assistant/voice", { cache: "no-store", signal: controller.signal });
      const availability = await response.json();
      if (attempt !== generation.current) return;
      if (!response.ok || availability.available !== true || availability.model !== LIVE_MODEL) {
        setStatus({ state: "closed", message: availability.reason ?? availability.error ?? "Voice is unavailable. No microphone was accessed." });
        return;
      }
      // Token issuance remains gated server-side until native Live credentials and exact-model access are supported.
      const tokenResponse = await fetch("/api/assistant/voice", { method: "POST", signal: controller.signal });
      const credential = await tokenResponse.json();
      if (attempt !== generation.current) return;
      if (!tokenResponse.ok) throw new Error();
      if (!audio) throw new Error();
      const live = new NativeLiveSession(audio, update => {
        if (attempt === generation.current) setStatus(update);
      });
      session.current = live;
      live.start(credential);
      audio = undefined;
    } catch {
      if (attempt === generation.current) setStatus({ state: "closed", message: "Voice could not start. No alternative model was used. Use text or try again later." });
    } finally {
      audio?.dispose();
      if (attempt === generation.current) { request.current = null; setChecking(false); }
    }
  }
  const running = status?.state === "connecting" || status?.state === "listening" || status?.state === "closing";
  return <section className="flex flex-col gap-3" aria-label="Voice controls">
    <p className="text-sm text-muted-foreground">Voice sends live microphone audio to the provider. No recording or transcript is saved by this app. Provider retention applies. Silence still counts toward session usage; Stop Voice ends the session. Workspace tools remain in text.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={checking || running} onClick={start}>{checking ? "Checking Voice…" : "Start Voice"}</Button>{running && <Button type="button" variant="outline" onClick={() => session.current?.stop()} disabled={status?.state === "closing"}>{status?.state === "closing" ? "Ending Voice…" : "Stop Voice"}</Button>}</div>
    {status && <div className="flex flex-col gap-2 rounded-md border border-border p-3"><h3 className="text-sm font-medium">{status.state === "listening" ? "Voice Connected" : status.state === "connecting" ? "Connecting Voice" : status.state === "closing" ? "Ending Voice" : "Voice Not Active"}</h3><p role="status" className="text-sm leading-relaxed">{status.message ?? "Use Stop Voice to end the session."}</p>{status.seconds !== undefined && <p className="text-sm text-muted-foreground">Provider duration: {status.seconds} seconds. {status.usageConfirmed ? "Final usage confirmed." : "Final usage unconfirmed."}</p>}<a href={`/dashboard?workspace=${encodeURIComponent(workspace)}`} target="_blank" rel="noopener noreferrer" className="min-h-11 py-3 text-sm underline underline-offset-4">Open Workspace in New Tab</a></div>}
  </section>;
}
