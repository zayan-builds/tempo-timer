type Range = { max: number; messages: string[] };

const RANGES: Range[] = [
  {
    max: 5,
    messages: [
      "faster than a camera shutter",
      "faster than a hummingbird's wingbeat",
      "quicker than a blink",
      "faster than most reflexes register",
    ],
  },
  {
    max: 8,
    messages: [
      "about as long as a deep breath",
      "faster than most people tie their shoes",
      "about as long as a firm handshake",
      "quicker than reading this sentence",
    ],
  },
  {
    max: 12,
    messages: [
      "faster than most people read a sentence",
      "about as long as a microwave beep sequence",
      "quicker than finding WiFi password",
      "faster than a barista calls your name",
    ],
  },
  {
    max: 18,
    messages: [
      "quicker than brewing an espresso shot",
      "faster than most elevator doors close",
      "about as long as a decent guitar riff",
      "quicker than parallel parking in one go",
      "faster than loading Instagram used to be",
    ],
  },
  {
    max: 25,
    messages: [
      "faster than a London tube door closing",
      "about as long as a standing ovation start",
      "quicker than most people pick a Netflix show",
      "faster than a Formula 1 pit stop window",
      "about as long as the best part of a song",
    ],
  },
  {
    max: 35,
    messages: [
      "about as long as a perfect handshake",
      "faster than most people read a paragraph",
      "about as long as a news headline segment",
      "quicker than a microwave minute feels",
      "about as long as a dramatic film pause",
    ],
  },
  {
    max: 50,
    messages: [
      "faster than most elevator rides",
      "about as long as a great opening line",
      "quicker than most people find their keys",
      "about as long as the best film shots",
      "faster than most people choose a password",
    ],
  },
  {
    max: 70,
    messages: [
      "about as long as a stoplight",
      "faster than most people make a decision",
      "about as long as a good chorus",
      "quicker than reading the first page of a book",
      "about as long as a spacecraft separation burn",
    ],
  },
  {
    max: 90,
    messages: [
      "longer than a TikTok used to be",
      "about as long as a decent trailer",
      "roughly as long as a closing argument",
      "about the time it takes to forget why you walked in",
      "longer than most people's attention span online",
    ],
  },
  {
    max: 120,
    messages: [
      "about as long as a movie trailer",
      "longer than most ads you skip",
      "about as long as a strong coffee kick",
      "roughly the length of a perfect elevator pitch",
      "about as long as waiting for a delayed reply",
    ],
  },
  {
    max: Infinity,
    messages: [
      "even legends started somewhere",
      "every master was once a beginner",
      "the cube respects the attempt",
      "time is just a number. keep going",
      "Feliks Zemdegs didn't start fast either",
    ],
  },
];

let lastShown: string | null = null;

export function getComparison(seconds: number): string {
  const range = RANGES.find((r) => seconds < r.max) ?? RANGES[RANGES.length - 1];
  const pool = range.messages.filter((m) => m !== lastShown);
  const choices = pool.length > 0 ? pool : range.messages;
  const pick = choices[Math.floor(Math.random() * choices.length)];
  lastShown = pick;
  return pick;
}
