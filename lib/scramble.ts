const FACES = ["U", "D", "R", "L", "F", "B"] as const;
const MODIFIERS = ["", "'", "2"] as const;

export function generateScramble(length = 20): string {
  const moves: string[] = [];
  let lastFace = "";
  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    if (face === lastFace) continue;
    const mod = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
    moves.push(face + mod);
    lastFace = face;
  }
  return moves.join(" ");
}
