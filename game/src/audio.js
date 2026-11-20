// RENT RUNNER — audio: fully synthesized WebAudio (no audio files, no network).
// Engine hum, gunshots, sirens, radio jingles and UI blips, all generated.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.radioGain = null;
    this.muted = false; this.station = 0; this.radioTimer = null; this.engineOsc = null;
    this.tracks = ['Neon Tide — Sunset Run', 'Palm Static — Harbor Lights', 'Modem Hearts — Rent Day'];
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination);
      this.radioGain = this.ctx.createGain(); this.radioGain.gain.value = 0.12; this.radioGain.connect(this.master);
    } catch (e) { this.ctx = null; }
  }
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol = 0.25, filterFreq = 1200) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  shot() { this.noise(0.12, 0.5, 2800); this.tone(160, 0.09, 'square', 0.18, 0, 60); }
  enemyShot() { this.noise(0.1, 0.2, 1800); }
  siren() { this.tone(720, 0.5, 'sine', 0.1, 0, 980); this.tone(980, 0.5, 'sine', 0.1, 0.5, 720); }
  pickup() { this.tone(660, 0.12, 'sine', 0.2); this.tone(990, 0.18, 'sine', 0.2, 0.1); }
  cash() { this.tone(880, 0.1, 'triangle', 0.22); this.tone(1320, 0.22, 'triangle', 0.22, 0.09); }
  crash() { this.noise(0.3, 0.4, 500); this.tone(90, 0.25, 'sawtooth', 0.2, 0, 40); }
  click() { this.tone(1200, 0.05, 'square', 0.1); }
  horn() { this.tone(370, 0.25, 'sawtooth', 0.15); this.tone(466, 0.25, 'sawtooth', 0.12); }
  engineStart() { this.tone(70, 0.5, 'sawtooth', 0.16, 0, 140); }
  startEngineLoop() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    this.engineOsc.connect(g); g.connect(this.master); this.engineOsc.start();
    this.engineGain = g;
  }
  setEngineRpm(rpm) { if (this.engineOsc) this.engineOsc.frequency.value = 55 + rpm * 90; if (this.engineGain) this.engineGain.gain.value = 0.03 + rpm * 0.05; }
  stopEngineLoop() { if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} this.engineOsc = null; } }
  // Radio: a gentle looping synth arpeggio, station changes the scale.
  startRadio(stationIdx) {
    this.stopRadio(); this.station = stationIdx;
    if (!this.ctx) return;
    const scales = [[0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 1, 3, 6, 8]];
    const scale = scales[stationIdx % scales.length];
    const base = [220, 196, 174.6][stationIdx % 3];
    let step = 0;
    this.radioTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const n = scale[step % scale.length] + 12 * Math.floor(step / scale.length) % 2;
      const f = base * Math.pow(2, n / 12);
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.10, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      o.connect(g); g.connect(this.radioGain); o.start(); o.stop(this.ctx.currentTime + 0.55);
      step++;
    }, 320);
  }
  stopRadio() { if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; } }
  nextStation() {
    const s = (this.station + 1) % 3;
    this.startRadio(s);
    return s;
  }
}
