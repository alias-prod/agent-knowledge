import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";
const script = readFileSync(`${process.cwd()}/apps/web/public/live-capture.js`, "utf8");
test.each([24000, 48000])("capture produces 20ms mono PCM16 at %i input Hz", sampleRate => {
  const postMessage = vi.fn();
  let Processor!: new () => { process: (inputs: Float32Array[][]) => boolean };
  runInNewContext(script, {
    sampleRate,
    AudioWorkletProcessor: class { port = { postMessage }; },
    registerProcessor: (_name: string, implementation: typeof Processor) => { Processor = implementation; },
  });
  const processor = new Processor();
  const samples = new Float32Array(sampleRate / 50).fill(0.5);
  processor.process([[samples]]);
  expect(postMessage).toHaveBeenCalledOnce();
  const frame = postMessage.mock.calls[0]![0] as ArrayBuffer;
  expect(frame.byteLength).toBe(960);
  expect(new DataView(frame).getInt16(0, true)).toBe(16384);
});
test("capture clamps samples and preserves frame boundaries across render quanta", () => {
  const postMessage = vi.fn(); let Processor!: new () => { process: (inputs: Float32Array[][]) => boolean };
  runInNewContext(script, { sampleRate: 24000, AudioWorkletProcessor: class { port = { postMessage }; }, registerProcessor: (_: string, implementation: typeof Processor) => { Processor = implementation; } });
  const processor = new Processor();
  for (let i = 0; i < 4; i++) processor.process([[new Float32Array(128).fill(-2)]]);
  expect(postMessage).toHaveBeenCalledOnce();
  expect(new DataView(postMessage.mock.calls[0]![0] as ArrayBuffer).getInt16(0, true)).toBe(-32768);
});
