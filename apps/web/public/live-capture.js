/* global AudioWorkletProcessor, sampleRate, registerProcessor */
class AliasLiveCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new ArrayBuffer(960);
    this.view = new DataView(this.frame);
    this.offset = 0;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.sum += sample;
      this.count++;
      this.phase += 24000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        const value = Math.max(-1, Math.min(1, this.sum / this.count));
        this.view.setInt16(this.offset, Math.round(value * (value < 0 ? 32768 : 32767)), true);
        this.offset += 2;
        this.sum = 0;
        this.count = 0;
        if (this.offset === 960) {
          this.port.postMessage(this.frame, [this.frame]);
          this.frame = new ArrayBuffer(960);
          this.view = new DataView(this.frame);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("alias-live-capture", AliasLiveCapture);
