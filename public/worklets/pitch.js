// Real-time pitch shifter (two crossfaded delay taps). Runs entirely on the device.
class PitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4 },
      { name: 'vibrato', defaultValue: 0, minValue: 0, maxValue: 0.5 },
    ];
  }

  constructor() {
    super();
    this.size = 8192;
    this.buf = new Float32Array(this.size);
    this.w = 0;
    this.phase = 0;
    this.win = Math.round(sampleRate * 0.05);
    this.t = 0;
  }

  read(delay) {
    let pos = this.w - delay - 1;
    while (pos < 0) pos += this.size;
    const i = Math.floor(pos);
    const f = pos - i;
    const a = this.buf[i % this.size];
    const b = this.buf[(i + 1) % this.size];
    return a + (b - a) * f;
  }

  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const n = out[0].length;
    const ratios = params.ratio;
    const vib = params.vibrato[0];
    for (let i = 0; i < n; i++) {
      this.buf[this.w] = input ? input[i] : 0;
      let ratio = ratios.length > 1 ? ratios[i] : ratios[0];
      if (vib) {
        this.t += 1 / sampleRate;
        ratio *= 1 + vib * Math.sin(2 * Math.PI * 5 * this.t);
      }
      this.phase += (1 - ratio) / this.win;
      this.phase -= Math.floor(this.phase);
      const p2 = (this.phase + 0.5) % 1;
      const w1 = Math.sin(Math.PI * this.phase) ** 2;
      const w2 = Math.sin(Math.PI * p2) ** 2;
      const y = this.read(this.phase * this.win) * w1 + this.read(p2 * this.win) * w2;
      for (let c = 0; c < out.length; c++) out[c][i] = y;
      this.w = (this.w + 1) % this.size;
    }
    return true;
  }
}

registerProcessor('pitch-shift', PitchShift);
