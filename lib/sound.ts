let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { return null; }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type OscOpts = {
  freq: number;
  endFreq?: number;
  type?: OscillatorType;
  attackS: number;
  decayS?: number;
  sustainLevel?: number;
  releaseS: number;
  volume: number;
  offsetS?: number;
};

function osc(opts: OscOpts) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + (opts.offsetS ?? 0);
  const peakT = t0 + opts.attackS;
  const sustainLevel = opts.sustainLevel ?? opts.volume;
  const decayT = peakT + (opts.decayS ?? 0);
  const releaseT = decayT + opts.releaseS;

  const o = c.createOscillator();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(opts.freq, t0);
  if (opts.endFreq != null) {
    o.frequency.linearRampToValueAtTime(opts.endFreq, releaseT);
  }

  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.volume, peakT);
  g.gain.linearRampToValueAtTime(sustainLevel, decayT);
  g.gain.linearRampToValueAtTime(0, releaseT);

  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(releaseT + 0.02);
}

// Simple feedback delay for reverb-like tail
function delayTail(freq: number, offsetS: number, volume: number) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + offsetS;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(volume, t0);
  g.gain.linearRampToValueAtTime(0, t0 + 0.35);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + 0.37);
}

export const sounds = {
  // Armed — soft G4 sine, musical anticipation
  armed: () => osc({
    freq: 392,
    type: "sine",
    attackS: 0.01,
    decayS: 0.1,
    sustainLevel: 0.12 * 0.3,
    releaseS: 0.2,
    volume: 0.12,
  }),

  // Start — C5 + C6 layered (instant attack, punchy)
  start: () => {
    osc({ freq: 523, attackS: 0.001, decayS: 0.08, sustainLevel: 0, releaseS: 0.05, volume: 0.15 });
    osc({ freq: 1046, type: "sine", attackS: 0.001, decayS: 0.06, sustainLevel: 0, releaseS: 0.04, volume: 0.08 });
  },

  // Stop — A4 descending to F4 over 250ms, with reverb tail
  stop: () => {
    osc({
      freq: 440, endFreq: 349,
      attackS: 0.001,
      decayS: 0.05,
      sustainLevel: 0.18 * 0.7,
      releaseS: 0.4,
      volume: 0.18,
    });
    delayTail(174, 0.08, 0.06); // sub octave reverb tail
  },

  // PB — three-note warm ascending C5 → E5 → G5
  pb: () => {
    osc({ freq: 523.25, attackS: 0.03, decayS: 0.05, sustainLevel: 0.2 * 0.5, releaseS: 0.22, volume: 0.2 });
    osc({ freq: 659.25, attackS: 0.03, decayS: 0.05, sustainLevel: 0.2 * 0.5, releaseS: 0.22, volume: 0.2, offsetS: 0.13 });
    osc({ freq: 783.99, attackS: 0.03, decayS: 0.05, sustainLevel: 0.2 * 0.5, releaseS: 0.3, volume: 0.22, offsetS: 0.26 });
    delayTail(261, 0.3, 0.05);
  },

  newSession: () => {
    osc({ freq: 523.25, attackS: 0.03, releaseS: 0.16, volume: 0.13 });
    osc({ freq: 659.25, attackS: 0.03, releaseS: 0.16, volume: 0.13, offsetS: 0.06 });
    osc({ freq: 783.99, attackS: 0.03, releaseS: 0.16, volume: 0.13, offsetS: 0.12 });
  },

  inspectionTick: (urgent = false) => osc({
    freq: urgent ? 120 : 80,
    attackS: 0.002,
    releaseS: 0.05,
    volume: urgent ? 0.18 : 0.1,
  }),
};

export function unlockAudio() {
  getCtx();
}
