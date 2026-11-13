// V-L Interaction 화면에서 attention 행렬을 읽는 순수 함수들. Svelte를 모른다.

import { headGroups, type ConceptGroup } from '../engine/concepts'
import { tensor, type Tensor } from '../engine/tensor'
import type { TokenKind, TokenMeta, ViewInfo } from '../engine/types'

/**
 * V←L 행렬(K·P × N_l)의 열 하나 = 모든 patch가 단어 하나에 준 attention.
 * view마다 patch 격자(grid × grid, 행 우선)로 나눈다. 값은 attention 그대로(0–1)라 heatmap의 투명도로 쓴다.
 */
export function wordHeat(A: Tensor, word: number, views: ViewInfo[]): Float32Array[] {
  const P = views[0].grid * views[0].grid
  return views.map((_, vi) => {
    const out = new Float32Array(P)
    for (let p = 0; p < P; p++) out[p] = A.data[(vi * P + p) * A.cols + word]
    return out
  })
}

/** L←V 행렬(N_l × K·P)의 열 하나 = 단어마다 patch 하나에 준 attention */
export function patchColumn(A: Tensor, patch: number): Float32Array {
  const out = new Float32Array(A.rows)
  for (let r = 0; r < A.rows; r++) out[r] = A.data[r * A.cols + patch]
  return out
}

/**
 * heatmap의 진하기 (0–1). 한 patch의 V←L attention은 가리지 않은 지시 토큰 n개에 나뉘어 합이 1이므로,
 * 고르게 나눈 값 u = 1/n 이하는 칠하지 않고, u보다 큰 만큼을 top까지의 비율로 칠한다.
 * top = max(가장 큰 값, u와 1의 중간). 가장 큰 값이 u보다 조금만 크면(거의 고른 head) 그 작은 차이를
 * 가장 진한 색으로 부풀리지 않도록 중간값을 바닥으로 둔다.
 * attention 값 그대로를 투명도로 쓰면 탁상 patch까지 고르게 물들어(대부분 0.2–0.3) 어디가 진한지 읽기 어렵다.
 * 값이 클수록 진하다는 순서는 그대로다. painted = 칠한 칸이 하나라도 있는가
 */
export function heatOpacity(
  heat: Float32Array[],
  uniform: number,
): { opacity: Float32Array[]; max: number; top: number; painted: boolean } {
  let max = 0
  for (const h of heat) for (const v of h) if (v > max) max = v
  const top = Math.max(max, (1 + uniform) / 2)
  const span = top - uniform
  // float32 반올림(0.2 → 0.2000000003) 때문에 생기는 아주 작은 차이는 칠하지 않는다
  const opacity = heat.map((h) => Float32Array.from(h, (v) => (span > 1e-6 && v - uniform > 1e-6 ? (v - uniform) / span : 0)))
  return { opacity, max, top, painted: max > uniform + 1e-6 }
}

/** attention 행렬의 한 행을 열 구간마다 더한다 (decoder cross-attention의 memory 구간 요약) */
export function segmentSums(A: Tensor, row: number, segments: [number, number][]): number[] {
  const o = row * A.cols
  return segments.map(([a, b]) => {
    let s = 0
    for (let i = a; i < b; i++) s += A.data[o + i]
    return s
  })
}

/** 열 [a, b)만 떼어 낸 행렬 (decoder cross-attention을 memory 구간별로 따로 그리려고) */
export function sliceCols(A: Tensor, a: number, b: number, label = ''): Tensor {
  const w = b - a
  const out = new Float32Array(A.rows * w)
  for (let r = 0; r < A.rows; r++) out.set(A.data.subarray(r * A.cols + a, r * A.cols + b), r * w)
  return tensor(A.rows, w, label, out)
}

export function maxOf(values: Float32Array): number {
  let m = 0
  for (const v of values) if (v > m) m = v
  return m
}

/** 화면에 보일 토큰 묶음. 이어진 [PAD]는 하나로 묶는다 */
export interface TokenGroup {
  /** 대표 토큰 번호 (묶음의 첫 토큰) */
  index: number
  name: string
  kind: TokenKind
  /** 묶인 토큰 수 ([PAD]가 아니면 1) */
  count: number
}

/**
 * 공식 코드 기준 LIBERO에서는 [PAD]가 15칸 넘게 붙는다. 모든 [PAD] 칸은 같은 벡터라서
 * L←V에서 같은 행, V←L에서 같은 열(가려져 0)이 된다. 그래서 칩 하나로 묶어도 값이 같다 (단위 테스트).
 */
export function groupTokens(tokens: TokenMeta[]): TokenGroup[] {
  const out: TokenGroup[] = []
  for (const t of tokens) {
    const last = out[out.length - 1]
    if (t.kind === 'pad' && last?.kind === 'pad') last.count++
    else out.push({ index: t.index, name: t.name, kind: t.kind, count: 1 })
  }
  return out
}

/** 묶음 안에 토큰 번호가 들어 있는가 */
export function groupHas(g: TokenGroup, index: number): boolean {
  return index >= g.index && index < g.index + g.count
}

/** interaction head마다 맡은 개념 묶음 (설계, caveat head-roles) */
export function interactionHeadRoles(heads: number): ConceptGroup[][] {
  return headGroups(heads, 'interaction')
}
