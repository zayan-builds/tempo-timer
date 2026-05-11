let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = {
  startFreq: number;
  endFreq?: number;
  durationMs: number;
  volume: number;
  offsetMs?: number;
};

function tone(opts: ToneOpts) {
  const c = getCtx();
  if (!c) return;
  const start = c.currentTime + (opts.offsetMs ?? 0) / 1000;
  const end = start + opts.durationMs / 1000;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(opts.startFreq, start);
  if (opts.endFreq != null) {
    osc.frequency.linearRampToValueAtTime(opts.endFreq, end);
  }
  const gain = c.createGain();
  const attack = Math.min(0.02, opts.durationMs / 1000 / 3);
  const release = Math.min(0.08, opts.durationMs / 1000 / 2);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(opts.volume, start + attack);
  gain.gain.setValueAtTime(opts.volume, Math.max(start + attack, end - release));
  gain.gain.linearRampToValueAtTime(0, end);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(end + 0.03);
}

export const sounds = {
  armed: () => tone({ startFreq: 440, endFreq: 520, durationMs: 200, volume: 0.15 }),
  start: () => tone({ startFreq: 880, durationMs: 80, volume: 0.2 }),
  stop: () => tone({ startFreq: 520, endFreq: 380, durationMs: 300, volume: 0.2 }),
  pb: () => {
    tone({ startFreq: 523.25, endFreq: 659.25, durationMs: 180, volume: 0.25 });
    tone({ startFreq: 659.25, endFreq: 783.99, durationMs: 220, volume: 0.25, offsetMs: 180 });
  },
  newSession: () => {
    // Warm three-note ascending chord: C5, E5, G5
    tone({ startFreq: 523.25, durationMs: 200, volume: 0.15 });
    tone({ startFreq: 659.25, durationMs: 200, volume: 0.15, offsetMs: 60 });
    tone({ startFreq: 783.99, durationMs: 200, volume: 0.15, offsetMs: 120 });
  },
  inspectionTick: (urgent = false) => {
    tone({
      startFreq: urgent ? 120 : 80,
      durationMs: 50,
      volume: urgent ? 0.18 : 0.1,
    });
  },
};

export function unlockAudio() {
  // Touch the context so it resumes on first user gesture.
  getCtx();
}
