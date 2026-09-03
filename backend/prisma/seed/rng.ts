/**
 * Deterministic PRNG for the seeder.
 *
 * Every run with the same SEED produces byte-identical data, so a teammate who
 * reseeds sees exactly the dashboard you saw. Change SEED in generate.ts to get
 * a different-but-still-reproducible dataset.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** mulberry32 — small, fast, good enough for fixtures. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** true with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** n distinct elements, or the whole array if n exceeds its length. */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.min(n, items.length));
  }

  /**
   * Index into `items`, biased towards the front. Higher `bias` = steeper.
   * Used so a handful of customers account for most challans, the way a real
   * customer base behaves.
   */
  weightedIndex(length: number, bias = 2): number {
    return Math.floor(Math.pow(this.next(), bias) * length);
  }
}
