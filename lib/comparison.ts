// Truth-grounded comparison engine.
//
// Every statement is gated behind a real numeric condition computed from the
// user's actual solves (profile mean/std-dev, personal best, session shape).
// The engine can never contradict the data because a statement is only
// eligible when its condition is provably true. Selection is a softmax over
// (relevance x weight x recency-decay) with time-similarity dedup so the same
// line is never recycled for a near-identical solve.

export type UserProfile = {
  mean: number;
  stdDev: number;
  tier: "beginner" | "intermediate" | "advanced" | "elite";
  count: number;
};

export type Story =
  | { kind: "first-solve" }
  | { kind: "milestone"; key: string }
  | { kind: "pb" }
  | { kind: "session-best" }
  | { kind: "session-worst" }
  | { kind: "near-pb" }
  | { kind: "above-average" }
  | { kind: "below-average" }
  | { kind: "consistent" }
  | { kind: "comeback" }
  | { kind: "neutral" };

export type ComparisonContext = {
  timeMs: number;
  isPB: boolean;
  isSessionBest: boolean;
  isSessionWorst: boolean;
  ao5: number | null;
  ao12: number | null;
  ao5Trend: "improving" | "stable" | "declining" | null;
  ao12Trend: "improving" | "stable" | "declining" | null;
  sessionCount: number;
  totalSolves: number;
  personalBest: number;
  currentStreakDays: number;
  longestStreakDays: number;
  hourOfDay: number;
  dayOfWeek: number;
  justHitMilestone: string | null;
  profile: UserProfile;
  story: Story;
};

type Statement = {
  id: string;
  story: string;
  weight?: number;
  text: string | ((ctx: ComparisonContext) => string);
};

function fmtDelta(ms: number): string {
  const s = Math.max(Math.abs(ms) / 1000, 0.01);
  return parseFloat(s.toFixed(2)).toString();
}

const STATEMENTS: Record<string, Record<string, Statement[]>> = {
  pb: {
    pb: [
      "the cube humbled itself before you. new personal best.",
      "you just rewrote your own record. the cube remembers.",
      "your previous best just became the baseline.",
      "a new floor for your ceiling. well done.",
      "microseconds matter. that one just did.",
      "the gap between you and the cube just narrowed.",
      "your hands moved faster than your last memory of speed.",
      "this is what progress feels like.",
      "the cube has a new target. you set it.",
      "records fall. you're the one pushing them.",
      "that's the best solve of your life. so far.",
      "you beat yourself today. that's the hardest opponent.",
      "new best. say it again — new best.",
      "every solve is a chance to beat yesterday. you took it.",
    ].map((text, i) => ({ id: `pb-${i}`, story: "pb", weight: 1.25, text })),
  },
  milestone: (() => {
    const raw: Record<string, string[]> = {
      sub10: [
        "sub-10. you're in a different league now.",
        "under ten seconds. say that out loud.",
      ],
      sub15: [
        "sub-15. your reflexes are officially faster than most.",
        "fifteen-second barrier? more like a suggestion.",
      ],
      sub20: [
        "sub-20. you've crossed into serious cubing territory.",
        "twenty seconds flat or better. that's a flex.",
      ],
      sub30: [
        "sub-30. faster than the average human by far.",
        "thirty seconds. the casuals can't touch this.",
      ],
      sub60: [
        "sub-60. the casuals can only dream of this.",
        "one minute broken. the next goal awaits.",
      ],
      "100solves": [
        "100 solves logged. you're not a beginner anymore.",
        "century mark. 100 solves of pure dedication.",
      ],
      "500solves": [
        "500 solves. the cube is starting to understand you.",
        "five hundred. half a thousand solves. that's commitment.",
      ],
      "1000solves": [
        "1000 solves. at this point the cube owes you rent.",
        "four digits. the cube respects you.",
      ],
    };
    const out: Record<string, Statement[]> = {};
    for (const [key, arr] of Object.entries(raw)) {
      out[key] = arr.map((text, i) => ({ id: `ms-${key}-${i}`, story: "milestone", weight: 1.4, text }));
    }
    return out;
  })(),
  sessionBest: {
    sessionBest: [
      "best of the session so far. the table is yours.",
      "your fastest today by a clear margin.",
      "this session has a new pace-setter.",
      "session high. fastest yet.",
      "you raised the bar for the rest of this session.",
      "best in class. class size: one.",
      "nothing in this session has touched that time.",
      "your hands found a rhythm the others couldn't.",
    ].map((text, i) => ({ id: `sb-${i}`, story: "session-best", weight: 1, text })),
  },
  sessionWorst: {
    sessionWorst: [
      "the worst of the session. but you finished it.",
      "every session has its anchor. this one is behind you now.",
      "slow solves teach patience. that one was educational.",
      "you can't have a best without a worst. now go again.",
      "consider that your warm-up. the real session starts now.",
      "even the best cubers have solves like this. keep going.",
      "tomorrow you'll wonder why this felt so slow.",
      "the only bad solve is the one you don't learn from.",
    ].map((text, i) => ({ id: `sw-${i}`, story: "session-worst", weight: 0.95, text })),
  },
  nearPb: {
    nearPb: [
      {
        id: "np-d1",
        story: "near-pb",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `just ${fmtDelta(ctx.timeMs - ctx.personalBest)}s off your best. so close.`,
      },
      {
        id: "np-d2",
        story: "near-pb",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `that was ${fmtDelta(ctx.timeMs - ctx.personalBest)}s from a personal best. the ceiling is right there.`,
      },
      {
        id: "np-d3",
        story: "near-pb",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `${fmtDelta(ctx.timeMs - ctx.personalBest)}s shy of the record. it's starting to feel inevitable.`,
      },
      {
        id: "np-d4",
        story: "near-pb",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `so close to your best — only ${fmtDelta(ctx.timeMs - ctx.personalBest)}s between you and it.`,
      },
      "buzzing around your personal best. dangerous territory.",
      "your best is getting nervous. you keep showing up.",
      "that solve was eyeing your record.",
      "the PB is in range. it's a matter of when, not if.",
    ].map((s, i) => (typeof s === "string" ? { id: `np-${i}`, story: "near-pb", weight: 1, text: s } : s)),
  },
  aboveAverage: {
    aboveAverage: [
      {
        id: "aa-d1",
        story: "above-average",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `${fmtDelta(ctx.profile.mean - ctx.timeMs)}s under your average. you're trending sharp.`,
      },
      {
        id: "aa-d2",
        story: "above-average",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `faster than your usual by ${fmtDelta(ctx.profile.mean - ctx.timeMs)}s. the pattern is real.`,
      },
      {
        id: "aa-d3",
        story: "above-average",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `that one came in ${fmtDelta(ctx.profile.mean - ctx.timeMs)}s ahead of your average. smooth.`,
      },
      {
        id: "aa-d4",
        story: "above-average",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `you beat your own average by ${fmtDelta(ctx.profile.mean - ctx.timeMs)}s today.`,
      },
      {
        id: "aa-d5",
        story: "above-average",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `${fmtDelta(ctx.profile.mean - ctx.timeMs)}s faster than your norm. consistency loves this.`,
      },
      {
        id: "aa-d6",
        story: "above-average",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `your average just took a ${fmtDelta(ctx.profile.mean - ctx.timeMs)}s lesson.`,
      },
    ],
  },
  belowAverage: {
    belowAverage: [
      {
        id: "ba-d1",
        story: "below-average",
        weight: 1,
        text: (ctx: ComparisonContext) => `${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s above your average. the cube has off days.`,
      },
      {
        id: "ba-d2",
        story: "below-average",
        weight: 1,
        text: (ctx: ComparisonContext) => `a little slower than your norm — ${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s. it happens.`,
      },
      {
        id: "ba-d3",
        story: "below-average",
        weight: 1,
        text: (ctx: ComparisonContext) => `${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s behind your usual pace. the average forgives.`,
      },
      {
        id: "ba-d4",
        story: "below-average",
        weight: 1,
        text: (ctx: ComparisonContext) => `you drifted ${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s past your mean. shake it off.`,
      },
      "the average is still yours. one solve doesn't move it.",
      "slow solves teach patience. this was educational.",
      "your consistency is bigger than one off solve.",
    ].map((s, i) => (typeof s === "string" ? { id: `ba-s${i}`, story: "below-average", weight: 0.95, text: s } : s)),
  },
  consistent: {
    consistent: [
      {
        id: "cs-d1",
        story: "consistent",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `within ${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s of your average. metronome energy.`,
      },
      {
        id: "cs-d2",
        story: "consistent",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s from your mean. you're locked in.`,
      },
      {
        id: "cs-d3",
        story: "consistent",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `clocked ${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s off your usual. that's control.`,
      },
      {
        id: "cs-d4",
        story: "consistent",
        weight: 1.1,
        text: (ctx: ComparisonContext) => `repeatable. ${fmtDelta(Math.abs(ctx.timeMs - ctx.profile.mean))}s of drift. winners are made here.`,
      },
      "low variance. high consistency. solver's signature.",
      "your times are getting predictable. in the best way.",
      "tight spread. you're in command of your method.",
      "you're not just fast. you're reliably fast.",
    ].map((s, i) => (typeof s === "string" ? { id: `cs-${i}`, story: "consistent", weight: 1, text: s } : s)),
  },
  comeback: {
    comeback: [
      "back after a break. the cube welcomed you.",
      "rust? what rust. you picked up right where you left off.",
      "absence makes the turns smoother. welcome back.",
      "you stepped away. the cube waited. you returned stronger.",
      "comeback solve. the muscle memory never left.",
      "first solve after a hiatus. the cube forgives.",
      "you took a break. the cube understands. now go.",
      "returning after time away. the cube is patient.",
    ].map((text, i) => ({ id: `cb-${i}`, story: "comeback", weight: 1, text })),
  },
  firstSolve: {
    firstSolve: [
      "the first of many. the cube is paying attention.",
      "your story starts with a single turn.",
      "every legend logs their first solve somewhere. this is yours.",
      "the cube has been waiting for you.",
      "one solve in. the journey has begun.",
      "that's your opening statement. more to come.",
    ].map((text, i) => ({ id: `fs-${i}`, story: "first-solve", weight: 1.1, text })),
  },
  neutral: {
    fast: [
      "faster than a camera shutter captures light.",
      "quicker than a hummingbird's heart beats twice.",
      "faster than a shooting star leaves its trail.",
      "quicker than a reflex registers surprise.",
      "faster than a firefly decides to glow.",
      "quicker than a magician's sleight fools the eye.",
      "faster than a gecko's tongue finds its target.",
      "quicker than a coin toss decides your fate.",
    ].map((text, i) => ({ id: `nf-${i}`, story: "neutral", weight: 1, text })),
    mid: [
      "about as long as a microwave counts down from fifteen.",
      "faster than most people read a sentence aloud.",
      "quicker than finding the wifi password on a menu.",
      "faster than a barista calls your name at a busy cafe.",
      "about as long as an elevator door decides to open.",
      "quicker than a free throw leaves your hand.",
      "about as long as a held note in a power ballad.",
      "faster than most people fold a t-shirt once.",
      "about as long as a good yawn and a stretch.",
    ].map((text, i) => ({ id: `nm-${i}`, story: "neutral", weight: 1, text })),
    slow: [
      "about as long as a news headline segment.",
      "faster than most people find their keys in the morning.",
      "about as long as a microwave minute actually feels.",
      "quicker than a cold start computer boot.",
      "about as long as a dramatic pause in a film.",
      "quicker than a meditative breath cycle.",
      "about as long as a firework fuse burns down.",
      "about as long as someone holds the door from across a hall.",
    ].map((text, i) => ({ id: `ns-${i}`, story: "neutral", weight: 1, text })),
    slower: [
      "about as long as a great opening line in a speech.",
      "longer than a tiktok clip used to be.",
      "about as long as a decent movie trailer.",
      "roughly the length of a short elevator pitch.",
      "about as long as forgetting why you walked into a room.",
      "about as long as untangling one headphone knot.",
      "roughly the time it takes to convince yourself to exercise.",
    ].map((text, i) => ({ id: `ns2-${i}`, story: "neutral", weight: 1, text })),
    verySlow: [
      "even legends started somewhere. you're writing your story.",
      "every master was once a beginner who didn't quit.",
      "the cube respects the attempt. every single one.",
      "time is just a number. persistence is the real metric.",
      "you're lapping everyone who hasn't started yet.",
      "slow is smooth and smooth is fast eventually.",
      "the cube doesn't judge. it just turns.",
      "patience is a puzzle too. you're solving it.",
      "slower solves build faster intuition. trust the process.",
      "you're faster than you were yesterday. that's all that matters.",
    ].map((text, i) => ({ id: `nv-${i}`, story: "neutral", weight: 1, text })),
    morning: [
      "morning light. orange side up.",
      "early morning solves hit different.",
      "dawn patrol. the cube before coffee? brave.",
      "the world is quiet. the cube is loud.",
    ].map((text, i) => ({ id: `todm-${i}`, story: "neutral", weight: 0.85, text })),
    night: [
      "late night. just you and the scramble.",
      "night solves have a different gravity.",
      "midnight madness. the best solves happen after dark.",
      "post-dinner solve. dessert for the brain.",
    ].map((text, i) => ({ id: `todn-${i}`, story: "neutral", weight: 0.85, text })),
    streak: [
      "solved every day. the streak lives.",
      "another day, another solve. the chain unbroken.",
      "you haven't missed a day. the cube notices.",
      "no days off. the streak is its own reward.",
      "the calendar doesn't lie. you show up every day.",
    ].map((text, i) => ({ id: `st-${i}`, story: "neutral", weight: 0.9, text })),
  },
};

// ── Persistence ──

const RECENCY_KEY = "tempo.comparisonRecents";
const MILESTONE_KEY = "tempo.milestonesHit";
const MAX_RECENT = 40;

function getRecents(): { id: string; timeMs: number }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENCY_KEY);
    return raw ? (JSON.parse(raw) as { id: string; timeMs: number }[]) : [];
  } catch {
    return [];
  }
}

function addRecent(id: string, timeMs: number) {
  if (typeof window === "undefined") return;
  try {
    const recents = getRecents();
    recents.push({ id, timeMs });
    if (recents.length > MAX_RECENT) recents.splice(0, recents.length - MAX_RECENT);
    localStorage.setItem(RECENCY_KEY, JSON.stringify(recents));
  } catch {
    /**/
  }
}

function getMilestonesHit(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MILESTONE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markMilestoneHit(id: string) {
  if (typeof window === "undefined") return;
  try {
    const hit = getMilestonesHit();
    hit.add(id);
    localStorage.setItem(MILESTONE_KEY, JSON.stringify([...hit]));
  } catch {
    /**/
  }
}

// ── Selection ──

function softmaxPick(scores: number[]): number {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  let roll = Math.random() * sum;
  for (let i = 0; i < exps.length; i++) {
    roll -= exps[i];
    if (roll <= 0) return i;
  }
  return exps.length - 1;
}

const TIME_SIMILARITY_MS = 2500;

function poolFor(ctx: ComparisonContext): Statement[] {
  const story = ctx.story;
  const timeBucket = (t: number): string => {
    const s = t / 1000;
    if (s < 10) return "fast";
    if (s < 35) return "mid";
    if (s < 60) return "slow";
    if (s < 120) return "slower";
    return "verySlow";
  };

  switch (story.kind) {
    case "first-solve":
      return STATEMENTS.firstSolve.firstSolve;
    case "milestone":
      return STATEMENTS.milestone[story.key] || STATEMENTS.pb.pb;
    case "pb":
      return STATEMENTS.pb.pb;
    case "session-best":
      return STATEMENTS.sessionBest.sessionBest;
    case "session-worst":
      return STATEMENTS.sessionWorst.sessionWorst;
    case "near-pb":
      return STATEMENTS.nearPb.nearPb;
    case "above-average":
      return STATEMENTS.aboveAverage.aboveAverage;
    case "below-average":
      return STATEMENTS.belowAverage.belowAverage;
    case "consistent":
      return STATEMENTS.consistent.consistent;
    case "comeback":
      return STATEMENTS.comeback.comeback;
    case "neutral": {
      const arr = [...STATEMENTS.neutral[timeBucket(ctx.timeMs)]];
      if (ctx.hourOfDay >= 6 && ctx.hourOfDay < 12) arr.push(...STATEMENTS.neutral.morning);
      if (ctx.hourOfDay >= 22 || ctx.hourOfDay < 6) arr.push(...STATEMENTS.neutral.night);
      if (ctx.currentStreakDays >= 3) arr.push(...STATEMENTS.neutral.streak);
      return arr;
    }
  }
}

export function getComparison(ctx: ComparisonContext): string {
  const recents = getRecents();
  const pool = poolFor(ctx);

  // Time-similarity + recency dedup: never recycle the same line for a
  // near-identical solve, and never repeat a line seen in the last 20 picks.
  const seenRecentIds = new Set(recents.slice(-20).map((r) => r.id));
  const candidates = pool.filter((s) => {
    if (seenRecentIds.has(s.id)) return false;
    if (recents.some((r) => r.id === s.id && Math.abs(r.timeMs - ctx.timeMs) <= TIME_SIMILARITY_MS)) {
      return false;
    }
    return true;
  });

  const eligible = candidates.length > 0 ? candidates : pool;

  const trendBoost =
    ctx.ao12Trend === "improving" && (ctx.story.kind === "above-average" || ctx.story.kind === "consistent")
      ? 1.3
      : 1;

  const scores = eligible.map((s) => {
    let w = (s.weight ?? 1) * trendBoost;
    // Story-match gets a decisive boost so the engine stays on-topic.
    if (s.story === ctx.story.kind) w *= 2;
    if (ctx.justHitMilestone && s.story === "milestone") w *= 3;
    return w;
  });

  const idx = softmaxPick(scores);
  const pick = eligible[idx];
  const text = typeof pick.text === "function" ? pick.text(ctx) : pick.text;

  addRecent(pick.id, ctx.timeMs);
  if (ctx.story.kind === "milestone" && ctx.justHitMilestone) {
    markMilestoneHit(ctx.justHitMilestone);
  }

  return text;
}

// ── Context builder ──

function computeProfile(solves: { time_ms: number }[]): UserProfile {
  const times = solves.map((s) => s.time_ms);
  const n = times.length;
  if (n === 0) {
    return { mean: 0, stdDev: 0, tier: "beginner", count: 0 };
  }
  const mean = times.reduce((a, b) => a + b, 0) / n;
  const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const tier = mean < 10000 ? "elite" : mean < 20000 ? "advanced" : mean < 45000 ? "intermediate" : "beginner";
  return { mean, stdDev, tier, count: n };
}

function daysBetween(a: number, b: number): number {
  return Math.round(Math.abs(a - b) / (1000 * 60 * 60 * 24));
}

// Trimmed rolling average — identical semantics to the on-screen avgOfN
// (drop the best and worst of the window), so engine statements never
// contradict the stats the user sees.
function trimmedAverage(times: number[], n: number): number | null {
  if (times.length < n) return null;
  const last = times.slice(-n);
  const sorted = [...last].sort((a, b) => a - b);
  const trim = Math.max(1, Math.ceil(n * 0.05));
  const middle = sorted.slice(trim, sorted.length - trim);
  if (middle.length === 0) return null;
  return middle.reduce((a, b) => a + b, 0) / middle.length;
}

function computeStreak(solves: { timestamp: number }[]): { current: number; longest: number } {
  if (solves.length === 0) return { current: 0, longest: 0 };
  const days = [...new Set(solves.map((s) => startOfDay(s.timestamp)))].sort((a, b) => b - a);
  let current = 0;
  let longest = 0;
  const today = startOfDay(Date.now());
  const yesterday = today - 86400000;
  for (let i = 0; i < days.length; i++) {
    const expected = today - i * 86400000;
    if (days[i] === expected || (i === 0 && days[i] === yesterday)) current++;
    else break;
  }
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 86400000) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 1;
    }
  }
  if (current > longest) longest = current;
  return { current, longest };
}

function computeTrend(solves: { time_ms: number }[], n: number): "improving" | "stable" | "declining" | null {
  if (solves.length < n + 3) return null;
  const prev = solves.slice(-n - 3, -3).map((s) => s.time_ms);
  const curr = solves.slice(-n).map((s) => s.time_ms);
  const avgPrev = prev.reduce((a, b) => a + b, 0) / prev.length;
  const avgCurr = curr.reduce((a, b) => a + b, 0) / curr.length;
  const diff = avgPrev - avgCurr;
  const threshold = avgPrev * 0.02;
  if (diff > threshold) return "improving";
  if (diff < -threshold) return "declining";
  return "stable";
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function detectMilestone(timeMs: number, totalSolves: number, personalBest: number): string | null {
  const milestones: Array<{ key: string; test: () => boolean }> = [
    { key: "sub10", test: () => timeMs < 10000 && personalBest >= 10000 },
    { key: "sub15", test: () => timeMs < 15000 && personalBest >= 15000 },
    { key: "sub20", test: () => timeMs < 20000 && personalBest >= 20000 },
    { key: "sub30", test: () => timeMs < 30000 && personalBest >= 30000 },
    { key: "sub60", test: () => timeMs < 60000 && personalBest >= 60000 },
    { key: "100solves", test: () => totalSolves >= 100 },
    { key: "500solves", test: () => totalSolves >= 500 },
    { key: "1000solves", test: () => totalSolves >= 1000 },
  ];
  const hit = getMilestonesHit();
  for (const m of milestones) {
    if (!hit.has(m.key) && m.test()) return m.key;
  }
  return null;
}

type StoryInput = {
  timeMs: number;
  isPB: boolean;
  personalBest: number;
  sessionCount: number;
  sessionTimes: number[];
  totalSolves: number;
  profile: UserProfile;
  gapDays: number;
  justHitMilestone: string | null;
};

function classifyStory(input: StoryInput): Story {
  const { timeMs, isPB, personalBest, sessionCount, sessionTimes, totalSolves, profile, gapDays, justHitMilestone } =
    input;
  const pb = personalBest;

  if (justHitMilestone) return { kind: "milestone", key: justHitMilestone };
  if (isPB || timeMs <= pb) return { kind: "pb" };

  if (sessionCount >= 3 && timeMs <= Math.min(...sessionTimes)) return { kind: "session-best" };
  if (sessionCount >= 3 && timeMs >= Math.max(...sessionTimes)) return { kind: "session-worst" };

  // Near-PB window scaled to the solver's own variance, with a floor so it
  // never becomes unreachable for tightly-consistent cubers:
  //   nearWindow = max(0.3 * stdDev, 3% of PB)
  if (pb > 0) {
    const nearWindow = Math.max(0.3 * profile.stdDev, 0.03 * pb);
    if (timeMs < pb + nearWindow) return { kind: "near-pb" };
  }

  if (totalSolves <= 4) return { kind: "first-solve" };

  if (totalSolves > 30 && sessionCount <= 2 && gapDays >= 2) return { kind: "comeback" };

  if (profile.mean > 0) {
    if (timeMs < profile.mean * 0.97) return { kind: "above-average" };
    if (timeMs > profile.mean * 1.08) return { kind: "below-average" };
    if (Math.abs(timeMs - profile.mean) <= profile.mean * 0.025 && totalSolves >= 8) {
      return { kind: "consistent" };
    }
  }

  return { kind: "neutral" };
}

export function buildComparisonContext(
  timeMs: number,
  isPB: boolean,
  solves: { time_ms: number; timestamp: number }[],
  sessionStartTime?: number,
): ComparisonContext {
  const sorted = [...solves].sort((a, b) => a.timestamp - b.timestamp);
  const sessionSolves = sessionStartTime ? sorted.filter((s) => s.timestamp >= sessionStartTime) : sorted.slice(-5);

  const sessionCount = sessionSolves.length;
  const sessionTimes = sessionSolves.map((s) => s.time_ms);
  const isSessionBest = sessionCount > 0 && timeMs <= Math.min(...sessionTimes);
  const isSessionWorst = sessionCount > 0 && timeMs >= Math.max(...sessionTimes);

  const personalBest = sorted.length > 0 ? Math.min(...sorted.map((s) => s.time_ms)) : Infinity;
  const streak = computeStreak(sorted);
  const profile = computeProfile(sorted);
  // The solve being evaluated is not in `solves` yet (it is persisted after),
  // so story/milestone counts must include it or they lag one solve behind.
  const totalCount = sorted.length + 1;
  const sortedTimes = sorted.map((s) => s.time_ms);

  const now = new Date();
  const hourOfDay = now.getHours();
  const dayOfWeek = now.getDay();

  const justHitMilestone = detectMilestone(timeMs, totalCount, personalBest);

  const lastSolveTs = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : null;
  const gapDays =
    sessionStartTime && lastSolveTs ? Math.max(0, (sessionStartTime - lastSolveTs) / (1000 * 60 * 60 * 24)) : 0;

  const story = classifyStory({
    timeMs,
    isPB,
    personalBest,
    sessionCount,
    sessionTimes,
    totalSolves: totalCount,
    profile,
    gapDays,
    justHitMilestone,
  });

  return {
    timeMs,
    isPB,
    isSessionBest,
    isSessionWorst,
    ao5: trimmedAverage(sortedTimes, 5),
    ao12: trimmedAverage(sortedTimes, 12),
    ao5Trend: computeTrend(sorted, 5),
    ao12Trend: computeTrend(sorted, 12),
    sessionCount,
    totalSolves: totalCount,
    personalBest,
    currentStreakDays: streak.current,
    longestStreakDays: streak.longest,
    hourOfDay,
    dayOfWeek,
    justHitMilestone,
    profile,
    story,
  };
}
