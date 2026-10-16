import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GraphVoiceControls } from "../../apps/web/components/graph/GraphVoiceControls";

class Recognition {
  static current: Recognition;
  lang = "";
  continuous = true;
  interimResults = true;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  abort = vi.fn(() => this.onend?.());
  constructor() { Recognition.current = this; }
}

class Utterance {
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const synth = { speak: vi.fn(), cancel: vi.fn() };
beforeEach(() => {
  vi.stubGlobal("SpeechRecognition", Recognition);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", synth);
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function openVoice() {
  fireEvent.click(screen.getByText("Voice & Audio Options"));
}

describe("opt-in graph voice controls", () => {
  test("never starts a microphone or playback automatically", () => {
    render(<GraphVoiceControls onSearch={vi.fn()} readout="Knowledge" />);
    openVoice();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Search by Voice" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/browser may send speech/)).toBeInTheDocument();
  });

  test("transcribes into editable search and ends listening", () => {
    const search = vi.fn();
    render(<GraphVoiceControls onSearch={search} />);
    openVoice();
    fireEvent.click(screen.getByRole("button", { name: "Search by Voice" }));
    expect(Recognition.current.start).toHaveBeenCalledOnce();
    expect(Recognition.current.continuous).toBe(false);
    expect(screen.getByRole("button", { name: "Stop Listening" })).toHaveAttribute("aria-pressed", "true");
    act(() => {
      Recognition.current.onresult?.({ results: [[{ transcript: "  allowedAgentIds  " }]] });
      Recognition.current.onend?.();
    });
    expect(search).toHaveBeenCalledWith("allowedAgentIds");
    expect(screen.getByRole("status")).toHaveTextContent("Edit the search field to correct it");
  });

  test("provides a recovery action when microphone permission is denied", () => {
    render(<GraphVoiceControls onSearch={vi.fn()} />);
    openVoice();
    fireEvent.click(screen.getByRole("button", { name: "Search by Voice" }));
    act(() => {
      Recognition.current.onerror?.({ error: "not-allowed" });
      Recognition.current.onend?.();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Microphone access was denied");
    expect(screen.getByRole("button", { name: "Search by Voice" })).toBeEnabled();
  });

  test("offers explicit read and stop controls for selected details", () => {
    render(<GraphVoiceControls onSearch={vi.fn()} readout="Knowledge. Fifteen fields." />);
    openVoice();
    fireEvent.click(screen.getByRole("button", { name: "Read Selected Node" }));
    expect(synth.speak.mock.calls[0][0].text).toBe("Knowledge. Fifteen fields.");
    fireEvent.click(screen.getByRole("button", { name: "Stop Reading" }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read Selected Node" })).toHaveAttribute("aria-pressed", "false");
  });

  test("cleans up recognition on unmount", () => {
    const view = render(<GraphVoiceControls onSearch={vi.fn()} />);
    openVoice();
    fireEvent.click(screen.getByRole("button", { name: "Search by Voice" }));
    view.unmount();
    expect(Recognition.current.abort).toHaveBeenCalledOnce();
    expect(Recognition.current.onresult).toBeNull();
  });

  test("explicit stop ends recognition without executing a search", () => {
    const search = vi.fn();
    render(<GraphVoiceControls onSearch={search} />); openVoice();
    fireEvent.click(screen.getByRole("button", { name: "Search by Voice" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop Listening" }));
    expect(Recognition.current.abort).toHaveBeenCalledOnce();
    expect(search).not.toHaveBeenCalled();
  });
  test("ignored permission or silent recognition times out and releases the session", () => {
    vi.useFakeTimers();
    try {
      render(<GraphVoiceControls onSearch={vi.fn()} />); openVoice();
      fireEvent.click(screen.getByRole("button", { name: "Search by Voice" }));
      act(() => vi.advanceTimersByTime(15000));
      expect(Recognition.current.abort).toHaveBeenCalledOnce();
      expect(screen.getByRole("status")).toHaveTextContent("timed out");
      expect(screen.getByRole("button", { name: "Search by Voice" })).toHaveAttribute("aria-pressed", "false");
    } finally { vi.useRealTimers(); }
  });
  test("keeps typed search available when voice is unsupported", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    render(<GraphVoiceControls onSearch={vi.fn()} />);
    openVoice();
    expect(screen.getByRole("button", { name: "Search by Voice" })).toBeDisabled();
    expect(screen.getByText(/Text search remains available/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read Selected Node" })).toBeDisabled();
  });
});
