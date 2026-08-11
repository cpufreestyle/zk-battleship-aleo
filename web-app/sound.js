// ===== SoundFX — AudioContext initialized on first user gesture =====

export const SoundFX = {
  ctx: null,
  enabled: localStorage.getItem("sound") !== "false",
  _initialized: false,

  initOnGesture() {
    if (this._initialized) return;
    this._initialized = true;
    // Create AudioContext within a user gesture to satisfy autoplay policy
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("AudioContext not available");
    }
    // Resume if suspended (Chrome auto-suspends until gesture)
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  },

  beep(freq, duration, type = "sine", vol = 0.15) {
    if (!this.enabled) return;
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  fire() { this.beep(200, 0.15, "sawtooth", 0.1); },
  hit() { this.beep(80, 0.3, "square", 0.2); setTimeout(() => this.beep(60, 0.2, "square", 0.15), 100); },
  miss() { this.beep(400, 0.1, "sine", 0.08); setTimeout(() => this.beep(300, 0.15, "sine", 0.06), 80); },
  place() { this.beep(600, 0.08, "sine", 0.1); },
  scan() { this.beep(800, 0.05, "sine", 0.08); setTimeout(() => this.beep(1000, 0.05, "sine", 0.08), 50); setTimeout(() => this.beep(1200, 0.1, "sine", 0.06), 100); },
  victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.2, "triangle", 0.12), i * 150)); },
  defeat() { [400, 350, 300, 250].forEach((f, i) => setTimeout(() => this.beep(f, 0.3, "sawtooth", 0.1), i * 200)); },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem("sound", this.enabled);
    if (this.enabled) this.initOnGesture();
    return this.enabled;
  },
};
