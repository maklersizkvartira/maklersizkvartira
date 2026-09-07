/**
 * Pure Web Audio API sound synthesizer for 2048 game.
 * Zero external audio assets needed; works in all modern browsers & devices.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private hasInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('uyiz_game_sound');
      // Default to true unless explicitly disabled by user
      this.enabled = saved !== 'false';

      // Auto-unlock Web Audio on first user interaction anywhere
      const unlockAudio = () => {
        this.init();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };

      window.addEventListener('click', unlockAudio, { passive: true, once: true });
      window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
    }
  }

  public init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.hasInitialized = true;
    } catch {
      // Audio context creation errors handled safely
    }
    return this.ctx;
  }

  private getActiveContext(): AudioContext | null {
    const ctx = this.init();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  }

  public isMuted(): boolean {
    return !this.enabled;
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('uyiz_game_sound', String(this.enabled));
    }
    if (this.enabled) {
      // Play a confirmation sound when unmuted
      this.playClick();
    }
    return !this.enabled; // returns isMuted state
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('uyiz_game_sound', String(this.enabled));
    }
  }

  /** Subtle and punchy whoosh/click on tile slide */
  public playMove(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getActiveContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Ignore audio failure
    }
  }

  /** Harmonic crystal chime on tile merge; scales beautifully with value */
  public playMerge(value: number): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getActiveContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Rich pentatonic & scale mappings
      const noteMap: Record<number, number> = {
        4: 293.66,   // D4
        8: 329.63,   // E4
        16: 392.00,  // G4
        32: 440.00,  // A4
        64: 523.25,  // C5
        128: 587.33, // D5
        256: 659.25, // E5
        512: 783.99, // G5
        1024: 880.00,// A5
        2048: 1046.5,// C6
        4096: 1318.5,// E6
      };

      const freq = noteMap[value] || Math.min(1400, 300 + Math.log2(value) * 80);

      // Primary tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = value >= 128 ? 'triangle' : 'sine';
      osc1.frequency.setValueAtTime(freq, now);
      osc1.frequency.exponentialRampToValueAtTime(freq * 1.04, now + 0.2);

      const volume = value >= 512 ? 0.35 : value >= 64 ? 0.28 : 0.22;
      gain1.gain.setValueAtTime(volume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.22);

      // Add shimmer octave harmonic for large buildings (64+)
      if (value >= 64) {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 1.5, now + 0.02);
        osc2.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.22);

        gain2.gain.setValueAtTime(volume * 0.45, now + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now + 0.02);
        osc2.stop(now + 0.22);
      }
    } catch {
      // Ignore audio failure
    }
  }

  /** Exciting musical arpeggio on combo */
  public playCombo(comboCount: number): void {
    if (!this.enabled || comboCount < 2) return;
    try {
      const ctx = this.getActiveContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const baseFreq = 440;
      const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];

      const count = Math.min(notes.length, comboCount + 1);
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        const noteTime = now + i * 0.06;
        osc.frequency.setValueAtTime(notes[i], noteTime);

        gain.gain.setValueAtTime(0.24, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.18);
      }
    } catch {
      // Ignore
    }
  }

  /** UI click/toggle sound */
  public playClick(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getActiveContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Ignore
    }
  }

  /** Pleasant reverse whoosh on undo */
  public playUndo(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getActiveContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.1);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore
    }
  }

  /** Victory fanfare when 2048 is reached */
  public playVictory(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getActiveContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const start = now + idx * 0.11;
        const duration = idx === notes.length - 1 ? 0.6 : 0.28;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
      });
    } catch {
      // Ignore
    }
  }

  /** Soft descending game over melody */
  public playGameOver(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getActiveContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [392.0, 329.63, 261.63, 196.0]; // G4, E4, C4, G3
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const start = now + idx * 0.14;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // Ignore
    }
  }
}

export const sound = new SoundManager();
