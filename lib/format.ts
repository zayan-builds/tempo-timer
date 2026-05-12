export const TIME_PATTERN = /^[0-9]+:[0-9]{2}\.[0-9]{2}$/;

// Only use ASCII digits 0-9 — never rely on font rendering to distinguish letters
export function formatTime(ms: number): string {
  if (typeof ms !== "number" || !isFinite(ms) || ms < 0) ms = 0;
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  // Explicitly coerce each part through Number() to guarantee digit characters
  const mm = String(min | 0);
  const ss = String(sec | 0).padStart(2, "0");
  const cc = String(cs | 0).padStart(2, "0");
  return `${mm}:${ss}.${cc}`;
}

export function isValidFormatted(s: string): boolean {
  return TIME_PATTERN.test(s);
}

export function average(times: number[]): number | null {
  if (times.length < 3) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const trim = Math.ceil(times.length * 0.05) || 1;
  const middle = sorted.slice(trim, sorted.length - trim);
  if (middle.length === 0) return null;
  return middle.reduce((a, b) => a + b, 0) / middle.length;
}
