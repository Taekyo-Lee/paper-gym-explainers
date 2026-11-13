// seed PRNG.
// 가중치와 feature는 `seed`와 이름(stream)으로 만든 독립 난수열에서 뽑는다.
// 그래서 한 부분(예: H)을 바꿔도 다른 부분(예: vision 가중치)의 값은 그대로다.

/** 문자열 → 32-bit 해시 (FNV-1a) */
export function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: 32-bit 상태 하나로 [0, 1) 균등 난수를 낸다 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private readonly next: () => number
  private spare: number | null = null

  constructor(seed: number, stream: string) {
    const mixed = (hash32(stream) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0
    this.next = mulberry32(mixed)
  }

  uniform(): number {
    return this.next()
  }

  /** 표준 정규분포 (Box–Muller) */
  normal(): number {
    if (this.spare !== null) {
      const value = this.spare
      this.spare = null
      return value
    }
    let u = 0
    while (u <= Number.EPSILON) u = this.next()
    const v = this.next()
    const radius = Math.sqrt(-2 * Math.log(u))
    this.spare = radius * Math.sin(2 * Math.PI * v)
    return radius * Math.cos(2 * Math.PI * v)
  }

  /**
   * 가벼운 잡음: 평균 0, 표준편차 std인 균등분포. 분포 모양이 중요하지 않은 가상 가중치의 잡음에 쓴다
   * (정규분포보다 훨씬 빠르다).
   */
  noiseArray(length: number, std = 1): Float32Array {
    const out = new Float32Array(length)
    const width = 2 * Math.sqrt(3) * std
    for (let i = 0; i < length; i++) out[i] = (this.next() - 0.5) * width
    return out
  }

  normalArray(length: number, std = 1): Float32Array {
    const out = new Float32Array(length)
    for (let i = 0; i < length; i++) out[i] = this.normal() * std
    return out
  }
}

/** seed와 이름으로 독립 난수열을 만든다. 같은 (seed, stream)이면 항상 같은 수열이다. */
export function rng(seed: number, stream: string): Rng {
  return new Rng(seed, stream)
}
