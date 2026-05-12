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

const WARMTH = 0.85;
const w = (hz: number) => hz * WARMTH;

type ToneOpts = {
  startFreq: number;
  endFreq?: number;
  durationMs: number;
  volume: number;
  offsetMs?: number;
  type?: OscillatorType;
  attackMs?: number;
  releaseMs?: number;
};

function tone(opts: ToneOpts) {
  const c = getCtx();
  if (!c) return;
  const start = c.currentTime + (opts.offsetMs ?? 0) / 1000;
  const dur = opts.durationMs / 1000;
  const end = start + dur;
  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.startFreq, start);
  if (opts.endFreq != null) {
    osc.frequency.linearRampToValueAtTime(opts.endFreq, end);
  }
  const gain = c.createGain();
  const attack = (opts.attackMs ?? Math.min(20, opts.durationMs / 3)) / 1000;
  const release = (opts.releaseMs ?? Math.min(80, opts.durationMs / 2)) / 1000;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(opts.volume, start + attack);
  gain.gain.setValueAtTime(opts.volume, Math.max(start + attack, end - release));
  gain.gain.linearRampToValueAtTime(0, end);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(end + 0.05);
}

// Soft reverb tail via a brief decaying sine ping
function tail(freq: number, delayMs: number, volume: number, durMs = 220) {
  tone({
    startFreq: freq,
    durationMs: durMs,
    volume,
    offsetMs: delayMs,
    attackMs: 40,
    releaseMs: 180,
  });
}

export const sounds = {
  // Anticipation, not alert — soft attack, gentle rise
  armed: () =>
    tone({
      startFreq: w(360),
      endFreq: w(440),
      durationMs: 260,
      volume: 0.13,
      attackMs: 80,
      releaseMs: 140,
    }),
  // Ultra-short, punchy click
  start: () =>
    tone({
      startFreq: w(880),
      endFreq: w(760),
      durationMs: 55,
      volume: 0.22,
      attackMs: 2,
      releaseMs: 30,
    }),
  // Weighted landing + soft reverb tail
  stop: () => {
    tone({
      startFreq: w(520),
      endFreq: w(340),
      durationMs: 260,
      volume: 0.22,
      attackMs: 4,
      releaseMs: 140,
    });
    tail(w(220), 100, 0.06, 260);
  },
  // Three-note ascending warm chord — earned, not celebratory
  pb: () => {
    tone({ startFreq: w(523.25), durationMs: 240, volume: 0.2, attackMs: 30, releaseMs: 160 });
    tone({ startFreq: w(659.25), durationMs: 240, volume: 0.2, offsetMs: 130, attackMs: 30, releaseMs: 160 });
    tone({ startFreq: w(783.99), durationMs: 320, volume: 0.22, offsetMs: 260, attackMs: 30, releaseMs: 220 });
    tail(w(523.25 / 2), 320, 0.05, 320);
  },
  newSession: () => {
    tone({ startFreq: w(523.25), durationMs: 200, volume: 0.13, attackMs: 30, releaseMs: 130 });
    tone({ startFreq: w(659.25), durationMs: 200, volume: 0.13, offsetMs: 60, attackMs: 30, releaseMs: 130 });
    tone({ startFreq: w(783.99), durationMs: 200, volume: 0.13, offsetMs: 120, attackMs: 30, releaseMs: 130 });
  },
  inspectionTick: (urgent = false) => {
    tone({
      startFreq: w(urgent ? 120 : 80),
      durationMs: 50,
      volume: urgent ? 0.18 : 0.1,
    });
  },
};

export function unlockAudio() {
  getCtx();
}
