import type { LiveAudio } from "./live-session";

export function createLiveAudio(): LiveAudio {
  const context = new AudioContext({ sampleRate: 24000 });
  const unlocked = context.resume().catch(() => undefined);
  let disposed = false;
  let inputStopped = false;
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let capture: AudioWorkletNode | undefined;
  let nextOutput = 0;
  const playing = new Set<AudioBufferSourceNode>();
  function stopInput() {
    inputStopped = true;
    capture?.disconnect();
    if (capture) capture.port.onmessage = null;
    source?.disconnect();
    stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
  }
  return {
    async start(send, interrupted) {
      await unlocked;
      if (disposed || inputStopped) return;
      if (context.state !== "running" || context.sampleRate < 24000) throw new Error("Voice audio needs a fresh user gesture or a supported sample rate.");
      await context.audioWorklet.addModule("/live-capture.js");
      if (disposed || inputStopped) return;
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      if (disposed || inputStopped) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      stream.getTracks().forEach(track => { track.onended = interrupted; });
      source = context.createMediaStreamSource(stream);
      capture = new AudioWorkletNode(context, "alias-live-capture");
      capture.onprocessorerror = interrupted;
      context.onstatechange = () => { if (!disposed && !inputStopped && context.state !== "running") interrupted(); };
      capture.port.onmessage = event => {
        if (disposed || inputStopped || !(event.data instanceof ArrayBuffer) || event.data.byteLength !== 960) return;
        let binary = "";
        for (const byte of new Uint8Array(event.data)) binary += String.fromCharCode(byte);
        send(btoa(binary));
      };
      source.connect(capture);
      capture.connect(context.destination);
    },
    play(pcm) {
      if (disposed || pcm.length > 128_000) throw new Error("Invalid voice audio.");
      const bytes = atob(pcm);
      if (!bytes.length || bytes.length % 2) throw new Error("Invalid voice PCM.");
      if (nextOutput - context.currentTime > 3) throw new Error("Voice playback queue exceeded its limit.");
      const buffer = context.createBuffer(1, bytes.length / 2, 24000);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const value = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8);
        samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
      }
      const output = context.createBufferSource();
      output.buffer = buffer;
      output.connect(context.destination);
      playing.add(output);
      output.onended = () => { playing.delete(output); output.disconnect(); };
      nextOutput = Math.max(context.currentTime, nextOutput);
      output.start(nextOutput);
      nextOutput += buffer.duration;
    },
    stopInput,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopInput();
      context.onstatechange = null;
      if (capture) { capture.onprocessorerror = null; capture.port.close(); }
      for (const output of playing) { output.onended = null; output.stop(); output.disconnect(); }
      playing.clear();
      void context.close().catch(() => undefined);
    },
  };
}
