"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

const subscribe = () => () => {};
function voiceSupport() {
  const host = window as VoiceWindow;
  return (host.SpeechRecognition || host.webkitSpeechRecognition ? 1 : 0) |
    ("speechSynthesis" in host && "SpeechSynthesisUtterance" in host ? 2 : 0);
}

export function GraphVoiceControls({ onSearch, readout }: { onSearch: (query: string) => void; readout?: string }) {
  const support = useSyncExternalStore(subscribe, voiceSupport, () => 0);
  const recognition = useRef<Recognition | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function stop() {
      if (watchdog.current) clearTimeout(watchdog.current);
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.abort();
        recognition.current = null;
      }
      if (utterance.current) {
        utterance.current.onend = null;
        utterance.current.onerror = null;
        window.speechSynthesis.cancel();
        utterance.current = null;
      }
    }
    function hide() {
      if (!document.hidden) return;
      stop();
      setListening(false);
      setSpeaking(false);
      setMessage("Voice paused while this page is hidden.");
    }
    document.addEventListener("visibilitychange", hide);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  function dictate() {
    if (listening) {
      recognition.current?.abort();
      setListening(false);
      setMessage("Voice search stopped. You can type your search instead.");
      return;
    }
    const Constructor = (window as VoiceWindow).SpeechRecognition ?? (window as VoiceWindow).webkitSpeechRecognition;
    if (!Constructor) return;
    if (utterance.current) window.speechSynthesis.cancel();
    const session = new Constructor();
    recognition.current = session;
    session.lang = navigator.language || "en-US";
    session.continuous = false;
    session.interimResults = false;
    session.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript.trim().slice(0, 200);
      if (!text) return;
      onSearch(text);
      setMessage(`Searching for: ${text}. Edit the search field to correct it.`);
    };
    session.onerror = (event) => setMessage(event.error === "not-allowed" || event.error === "service-not-allowed"
      ? "Microphone access was denied. Allow it in your browser, or type your search."
      : event.error === "aborted" ? "Voice search stopped."
      : "Could not hear your search. Try again or type in the search field.");
    session.onend = () => {
      if (recognition.current !== session) return;
      recognition.current = null;
      if (watchdog.current) clearTimeout(watchdog.current);
      setListening(false);
      setMessage((current) => current.startsWith("Listening") ? "No speech received. Try again or type your search." : current);
    };
    try {
      session.start();
      setListening(true);
      setMessage("Listening… Say the words you want to search for.");
      watchdog.current = setTimeout(() => {
        if (recognition.current !== session) return;
        session.abort();
        setListening(false);
        setMessage("Voice search timed out. Check microphone permission, or type your search instead.");
      }, 15_000);
    } catch {
      recognition.current = null;
      setMessage("Voice search could not start. Use the text search instead.");
    }
  }

  function speak() {
    if (speaking) {
      if (utterance.current) {
        utterance.current.onend = null;
        utterance.current.onerror = null;
        utterance.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setMessage("Read aloud stopped.");
      return;
    }
    if (!readout || !(support & 2)) return;
    recognition.current?.abort();
    const speech = new SpeechSynthesisUtterance(readout.slice(0, 3000));
    utterance.current = speech;
    speech.lang = navigator.language || "en-US";
    speech.onend = () => { utterance.current = null; setSpeaking(false); setMessage("Read aloud finished."); };
    speech.onerror = () => { utterance.current = null; setSpeaking(false); setMessage("Read aloud stopped. The node details are available as text."); };
    window.speechSynthesis.speak(speech);
    setSpeaking(true);
    setMessage("Reading the selected node. Select Stop Reading to end playback.");
  }

  return (
    <details className="graph-voice" onToggle={(event) => {
      if (event.currentTarget.open) return;
      recognition.current?.abort();
      if (utterance.current) window.speechSynthesis.cancel();
      setListening(false);
      setSpeaking(false);
    }}>
      <summary>Voice & Audio Options</summary>
      <div className="graph-voice-content">
        <p id="graph-voice-privacy">Optional: your browser may send speech to its recognition service. Nothing listens automatically. Spoken words only filter this view; they never change records.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!(support & 1)} aria-describedby="graph-voice-privacy" aria-pressed={listening} onClick={dictate}>{listening ? <Square data-icon="inline-start" aria-hidden="true" /> : <Mic data-icon="inline-start" aria-hidden="true" />}{listening ? "Stop Listening" : "Search by Voice"}</Button>
          <Button type="button" variant="outline" disabled={!(support & 2) || !readout} aria-pressed={speaking} onClick={speak}>{speaking ? <Square data-icon="inline-start" aria-hidden="true" /> : <Volume2 data-icon="inline-start" aria-hidden="true" />}{speaking ? "Stop Reading" : "Read Selected Node"}</Button>
        </div>
        <p>{!(support & 1) ? "Voice search is not supported in this browser. Text search remains available. " : ""}{!readout ? "Select a node to enable read aloud." : !(support & 2) ? "Read aloud is not supported in this browser." : "Read aloud plays the selected node’s details through your browser."}</p>
        <p role="status" aria-live="polite" aria-atomic="true">{message}</p>
      </div>
    </details>
  );
}
