export function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${min}:${sec.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export function average(times: number[]): number | null {
  if (times.length < 3) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const trim = Math.ceil(times.length * 0.05) || 1;
  const middle = sorted.slice(trim, sorted.length - trim);
  if (middle.length === 0) return null;
  return middle.reduce((a, b) => a + b, 0) / middle.length;
}
