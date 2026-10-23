export class Sound {
  private context?: AudioContext;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  muted = false;
  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.engine = this.context.createOscillator();
        this.engineGain = this.context.createGain();
        this.engine.type = "triangle";
        this.engine.frequency.value = 45;
        this.engineGain.gain.value = 0;
        this.engine.connect(this.engineGain).connect(this.context.destination);
        this.engine.start();
      }
      void this.context.resume().catch(() => {});
    } catch {
      /* The game remains playable when audio is unavailable. */
    }
  }
  update(speed: number, playing: boolean) {
    if (!this.context || !this.engine || !this.engineGain) return;
    this.engine.frequency.setTargetAtTime(
      35 + speed * 1.7,
      this.context.currentTime,
      0.1,
    );
    this.engineGain.gain.setTargetAtTime(
      playing && !this.muted ? 0.018 : 0,
      this.context.currentTime,
      0.08,
    );
  }
  play(name: string) {
    if (!this.context || this.muted) return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const crash = name === "hit" || name === "crash";
    const frequencies: Record<string, number> = {
      start: 400,
      count: 500,
      go: 800,
      score: 680,
      detect: 920,
      pickup: 1100,
      turn: 230,
      hit: 90,
      crash: 65,
    };
    const duration = crash ? 0.4 : name === "pickup" ? 0.22 : 0.09;
    oscillator.type = crash ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(
      frequencies[name] ?? 440,
      ctx.currentTime,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      crash ? 25 : (frequencies[name] ?? 440) * 1.4,
      ctx.currentTime + duration,
    );
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      crash ? 0.075 : 0.035,
      ctx.currentTime + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
