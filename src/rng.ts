/** Mulberry32: all randomness is explicit, split into independent named streams. */
export function deriveSeed(seed: number, stream: string): number {
  let h = seed >>> 0;
  for (const ch of stream) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}
export class Rng {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    let t = this.state = (this.state + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(max: number): number {
    if (!Number.isSafeInteger(max) || max < 1) throw new Error('Nieprawidłowy zakres RNG');
    return Math.floor(this.next() * max);
  }
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
