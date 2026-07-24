/**
 * Web Audio API Sound Synthesizer
 * Provides crisp audio feedback for game events without external asset dependencies.
 */

class AudioService {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(state) {
    this.muted = state !== undefined ? state : !this.muted;
    return this.muted;
  }

  // Play a simple frequency tone with envelope
  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1, delay = 0) {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch (e) {
      console.warn('Audio playback issue:', e);
    }
  }

  // 1. Number called chime
  playNumberCallSound() {
    this.playTone(523.25, 'sine', 0.2, 0.15); // C5
    this.playTone(659.25, 'sine', 0.25, 0.15, 0.08); // E5
  }

  // 2. Ticket number marked pop
  playMarkSound() {
    this.playTone(880, 'triangle', 0.1, 0.2); // A5
  }

  // 3. Countdown tick
  playTickSound() {
    this.playTone(440, 'sine', 0.05, 0.05); // A4
  }

  // 4. Winner fanfare
  playWinSound() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.3, 0.2, idx * 0.12);
    });
  }

  // 5. Game start alert
  playGameStartSound() {
    this.playTone(440, 'sawtooth', 0.15, 0.1);
    this.playTone(554.37, 'sawtooth', 0.15, 0.1, 0.1);
    this.playTone(659.25, 'sawtooth', 0.3, 0.15, 0.2);
  }

  // 6. Invalid click / error chime
  playErrorSound() {
    this.playTone(200, 'sawtooth', 0.2, 0.15);
  }
}

export const audioService = new AudioService();
