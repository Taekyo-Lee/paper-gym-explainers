// Loss 장난감. 같은 장면을 보여 주는 시연 5개가 조금씩 다른 정답 action chunk를 준다.
// 그중 하나(OUTLIER_DEMO)에 튀는 값을 넣으면, 모든 시연에 대해 loss 합이 가장 작은 예측은
// L1이면 step마다 중앙값, L2면 step마다 평균이다. 그래서 L2 쪽이 튀는 값에 더 끌려간다.
// 논문은 ℓ1 loss를 쓴다고만 한다(§3.4, App. A.3). L2 비교와 중앙값 설명은 세미나 설명이다.

export const TOY_H = 12
export const TOY_DEMOS = 5
/** 튀는 값이 들어가는 시연 (0부터) */
export const OUTLIER_DEMO = 3
/** 튀는 값이 가장 큰 step (0부터) */
export const SPIKE_STEP = 6
/** 튀는 값 슬라이더 범위 (action 값은 [−1, 1] 안에 둔다) */
export const AMP_MAX = 0.95

/** 시연마다 조금씩 다른 위치 (가상 값) */
const OFFSETS = [-0.1, -0.045, 0, 0.035, 0.085]

/** 목표 물체로 다가가는 매끈한 곡선: −0.5에서 0.4로 */
function base(k: number): number {
  return -0.5 + 0.9 * ((1 - Math.cos((Math.PI * k) / (TOY_H - 1))) / 2)
}

/** 튀는 값의 모양: SPIKE_STEP 둘레의 좁은 혹 */
export function bump(k: number): number {
  return Math.exp(-((k - SPIKE_STEP) ** 2) / 2)
}

/** 시연 chunk (TOY_DEMOS × TOY_H). amp는 튀는 값의 크기 */
export function demoChunks(amp: number): number[][] {
  return OFFSETS.map((offset, i) =>
    Array.from({ length: TOY_H }, (_, k) => {
      const wiggle = 0.025 * Math.sin(0.9 * k + 1.7 * i)
      const spike = i === OUTLIER_DEMO ? amp * bump(k) : 0
      return base(k) + offset + wiggle + spike
    }),
  )
}

export function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 예측 p 하나에 대한 L1 loss 합: Σ|p − y| */
export function l1(p: number, ys: readonly number[]): number {
  return ys.reduce((sum, y) => sum + Math.abs(p - y), 0)
}

/** 예측 p 하나에 대한 L2 loss 합: Σ(p − y)² */
export function l2(p: number, ys: readonly number[]): number {
  return ys.reduce((sum, y) => sum + (p - y) ** 2, 0)
}

/** step k에서 시연들이 준 정답 값 */
export function column(chunks: readonly number[][], k: number): number[] {
  return chunks.map((chunk) => chunk[k])
}

/** 시연 전체에 대해 loss가 가장 작은 예측 chunk: L1이면 중앙값, L2면 평균 */
export function bestPrediction(chunks: readonly number[][], loss: 'l1' | 'l2'): number[] {
  return Array.from({ length: chunks[0].length }, (_, k) => (loss === 'l1' ? median : mean)(column(chunks, k)))
}
