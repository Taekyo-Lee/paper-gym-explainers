// 2017 비교. 같은 H개 출력을 두 방식으로 낼 때, decoder를 몇 번 돌렸을 때 몇 개가 나와 있는지.
// - autoregressive (2017 Transformer decoder): 한 번 돌릴 때마다 한 step. 앞서 낸 출력을 오른쪽으로 한 칸 밀어 다시 넣는다(shifted right).
// - parallel (TurboVLA Action Chunk Decoder): action query H개로 한 번에 H step.
// self-attention mask도 여기서 정한다: autoregressive는 자기 자리와 앞자리만 보고, parallel은 mask가 없다.

export type DecodingMode = 'autoregressive' | 'parallel'

/** 모든 출력을 내는 데 필요한 decoder 실행 횟수 */
export function passesNeeded(mode: DecodingMode, H: number): number {
  return mode === 'autoregressive' ? H : 1
}

/** decoder를 pass번 돌린 뒤 나와 있는 출력 수 (앞 step부터 차례로) */
export function revealedCount(mode: DecodingMode, pass: number, H: number): number {
  const p = Math.max(0, Math.floor(pass))
  return mode === 'autoregressive' ? Math.min(p, H) : p >= 1 ? H : 0
}

/** step k(0부터)가 몇 번째 실행에서 나오는가 (1부터) */
export function passOfStep(mode: DecodingMode, k: number): number {
  return mode === 'autoregressive' ? k + 1 : 1
}

/** self-attention에서 자리 i가 자리 j를 볼 수 있는가 (autoregressive: j ≤ i, parallel: 모두) */
export function canAttend(mode: DecodingMode, i: number, j: number): boolean {
  return mode === 'parallel' || j <= i
}
