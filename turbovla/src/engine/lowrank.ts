// 구조가 있는 가상 가중치 (caveat low-rank-weights).
//
// 실제 TurboVLA 가중치는 학습된 dense 행렬이다. 여기서는 브라우저에서 forward 전체를 100 ms 안에 다시 계산해야 하므로
// 가상 가중치를 "실제 모양의 dense 행렬을 정확히 표현하지만 곱셈이 싼" 구조로 만든다.
//   - Selector (D × r): 개념 채널 r개를 그대로 읽고 + rank q 잡음.        x·W = x[:, :r] + (x·U)·V
//   - Writer   (r × D): 개념 채널 r개에 gain만큼 다시 쓰고 + rank q 잡음.  x·W = gain·[x, 0] + (x·U)·V
//   - Coupling (r × r): head 하나의 Q·K 결합 (또는 value·out 결합).
//                        G = gain·Σ_{c∈slots} e_c e_cᵀ + eps·u·vᵀ
//                        실제 B_q, B_k (r × hd)는 B_q·B_kᵀ = G가 되도록 만든다 (couplingFactors).
//   - LowRankLinear (in × out): FFN과 출력 MLP용 무작위 저랭크 행렬 A·B.
// 모든 구조는 dense 행렬로 펼칠 수 있고(`dense`), 테스트가 펼친 행렬로 한 계산과 결과가 같은지 확인한다.

import { CONCEPT_SLOTS, D } from './concepts'
import type { Rng } from './prng'
import { addRowVector, matmul, tensor, type Tensor } from './tensor'

const NOISE_RANK = 2

function noiseTensor(r: Rng, rows: number, cols: number, std: number): Tensor {
  return tensor(rows, cols, '', r.noiseArray(rows * cols, std))
}

// ---------------------------------------------------------------------------------------------
// Selector

export interface Selector {
  /** 펼친 행렬 (D × r) */
  dense: Tensor
  U: Tensor
  V: Tensor
}

export function makeSelector(r: Rng, noise = 0.05): Selector {
  // 잡음 크기 noise가 dense 칸 하나의 표준편차가 되도록 U·V를 나눠 잡는다
  const each = Math.sqrt(noise / Math.sqrt(NOISE_RANK))
  const U = noiseTensor(r, D, NOISE_RANK, each)
  const V = noiseTensor(r, NOISE_RANK, CONCEPT_SLOTS, each)
  const dense = matmul(U, V, 'selector')
  for (let c = 0; c < CONCEPT_SLOTS; c++) dense.data[c * CONCEPT_SLOTS + c] += 1
  return { dense, U, V }
}

/** x (n × D) · Selector (D × r) = x[:, :r] + (x·U)·V, 행마다 한 번에 계산한다 */
export function applySelector(x: Tensor, s: Selector): Tensor {
  const r = CONCEPT_SLOTS
  const q = s.U.cols
  const X = x.data
  const U = s.U.data
  const V = s.V.data
  const out = tensor(x.rows, r)
  const O = out.data
  const n = x.cols
  if (q === 2) {
    // 잡음 rank가 2일 때(늘 그렇다)의 빠른 경로: 계수 두 개를 변수로 둔다. 계산 순서는 아래 일반 경로와 같다
    for (let i = 0; i < x.rows; i++) {
      const xi = i * n
      let c0 = 0
      let c1 = 0
      for (let d = 0; d < n; d++) {
        const v = X[xi + d]
        c0 += v * U[2 * d]
        c1 += v * U[2 * d + 1]
      }
      const oi = i * r
      for (let c = 0; c < r; c++) O[oi + c] = X[xi + c] + c0 * V[c] + c1 * V[r + c]
    }
    return out
  }
  const coef = new Float64Array(q)
  for (let i = 0; i < x.rows; i++) {
    const xi = i * x.cols
    coef.fill(0)
    for (let d = 0; d < x.cols; d++) {
      const v = X[xi + d]
      const ud = d * q
      for (let k = 0; k < q; k++) coef[k] += v * U[ud + k]
    }
    const oi = i * r
    for (let c = 0; c < r; c++) {
      let sum = X[xi + c]
      for (let k = 0; k < q; k++) sum += coef[k] * V[k * r + c]
      O[oi + c] = sum
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Writer

export interface Writer {
  gain: number
  /** 펼친 행렬 (r × D) */
  dense: Tensor
  U: Tensor
  V: Tensor
}

export function makeWriter(r: Rng, gain: number, noise = 0.05): Writer {
  const each = Math.sqrt(noise / Math.sqrt(NOISE_RANK))
  const U = noiseTensor(r, CONCEPT_SLOTS, NOISE_RANK, each)
  const V = noiseTensor(r, NOISE_RANK, D, each)
  const dense = matmul(U, V, 'writer')
  for (let c = 0; c < CONCEPT_SLOTS; c++) dense.data[c * D + c] += gain
  return { gain, dense, U, V }
}

/** x (n × r) · Writer (r × D) */
export function applyWriter(x: Tensor, w: Writer, label = ''): Tensor {
  return writeInto(null, x, w, 1, label)
}

/**
 * base + s · (x · Writer). base가 null이면 0에서 시작한다. 큰 중간 행렬 없이 행마다 한 번에 계산한다.
 * forward는 applyWriter(base = null, s = 1)로만 쓴다. residual V + γ·ΔV는 ΔV를 trace에 남겨야 해서
 * interaction.ts에서 addScaled로 따로 더한다.
 */
export function writeInto(base: Tensor | null, x: Tensor, w: Writer, s: number, label = ''): Tensor {
  const r = CONCEPT_SLOTS
  const cols = w.V.cols
  const q = w.U.cols
  const n = x.rows
  const X = x.data
  const U = w.U.data
  const V = w.V.data
  const out = base ? tensor(n, cols, label, new Float32Array(base.data)) : tensor(n, cols, label)
  const O = out.data
  const g = w.gain * s
  if (q === 2) {
    // 잡음 rank가 2일 때의 빠른 경로 (계산 순서는 아래 일반 경로와 같다)
    for (let i = 0; i < n; i++) {
      const xi = i * r
      let c0 = 0
      let c1 = 0
      for (let c = 0; c < r; c++) {
        const v = X[xi + c]
        c0 += v * U[2 * c]
        c1 += v * U[2 * c + 1]
      }
      const oi = i * cols
      const k0 = c0 * s
      for (let d = 0; d < cols; d++) O[oi + d] += k0 * V[d]
      const k1 = c1 * s
      for (let d = 0; d < cols; d++) O[oi + d] += k1 * V[cols + d]
      for (let c = 0; c < r; c++) O[oi + c] += g * X[xi + c]
    }
    return out
  }
  const coef = new Float64Array(q)
  for (let i = 0; i < n; i++) {
    const xi = i * r
    coef.fill(0)
    for (let c = 0; c < r; c++) {
      const v = X[xi + c]
      for (let k = 0; k < q; k++) coef[k] += v * U[c * q + k]
    }
    const oi = i * cols
    for (let k = 0; k < q; k++) {
      const ck = coef[k] * s
      const vk = k * cols
      for (let d = 0; d < cols; d++) O[oi + d] += ck * V[vk + d]
    }
    for (let c = 0; c < r; c++) O[oi + c] += g * X[xi + c]
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Coupling: G = gain·Σ_{c∈slots} e_c e_cᵀ + eps·u·vᵀ  (r × r)

export interface Coupling {
  slots: number[]
  gain: number
  eps: number
  u: Float32Array
  v: Float32Array
}

export function makeCoupling(r: Rng, slots: number[], gain: number, eps: number): Coupling {
  return { slots, gain, eps, u: r.noiseArray(CONCEPT_SLOTS, 1), v: r.noiseArray(CONCEPT_SLOTS, 1) }
}

/** 펼친 G (r × r) */
export function couplingDense(c: Coupling): Tensor {
  const r = CONCEPT_SLOTS
  const out = tensor(r, r)
  for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) out.data[i * r + j] = c.eps * c.u[i] * c.v[j]
  for (const s of c.slots) out.data[s * r + s] += c.gain
  return out
}

/**
 * 실제 모양의 head projection factor 두 개 (r × hd). left · rightᵀ = G가 된다.
 * Q·K 결합이면 left = B_q, right = B_k. value·out 결합이면 left = B_v, rightᵀ = A_o.
 */
export function couplingFactors(c: Coupling, headDim: number): [Tensor, Tensor] {
  const r = CONCEPT_SLOTS
  if (headDim < c.slots.length + 1) throw new Error(`head dim ${headDim} too small for ${c.slots.length} slots`)
  const left = tensor(r, headDim)
  const right = tensor(r, headDim)
  const g = Math.sqrt(c.gain)
  c.slots.forEach((s, i) => {
    left.data[s * headDim + i] = g
    right.data[s * headDim + i] = g
  })
  const e = Math.sqrt(Math.abs(c.eps))
  const col = c.slots.length
  for (let i = 0; i < r; i++) {
    left.data[i * headDim + col] = e * c.u[i] * Math.sign(c.eps || 1)
    right.data[i * headDim + col] = e * c.v[i]
  }
  return [left, right]
}

function dot(row: Float32Array, offset: number, w: Float32Array): number {
  let sum = 0
  for (let c = 0; c < w.length; c++) sum += row[offset + c] * w[c]
  return sum
}

/** 행렬 (n × r)에서 slots 열만 모은 (n × slots.length) 배열 */
function gatherSlots(t: Tensor, slots: number[]): Float32Array {
  const r = t.cols
  const ns = slots.length
  const out = new Float32Array(t.rows * ns)
  const T = t.data
  for (let i = 0; i < t.rows; i++) for (let k = 0; k < ns; k++) out[i * ns + k] = T[i * r + slots[k]]
  return out
}

/** XA (n × r) · G · YAᵀ (r × m) · scale → (n × m) */
export function coupledScores(XA: Tensor, YA: Tensor, c: Coupling, scale: number, label = ''): Tensor {
  const r = CONCEPT_SLOTS
  const n = XA.rows
  const m = YA.rows
  const xu = new Float32Array(n)
  const yv = new Float32Array(m)
  for (let i = 0; i < n; i++) xu[i] = dot(XA.data, i * r, c.u)
  for (let j = 0; j < m; j++) yv[j] = dot(YA.data, j * r, c.v)
  const out = tensor(n, m, label)
  const g = c.gain
  const ns = c.slots.length
  // 결합에 쓰는 개념 칸만 모아 연속 배열로 (안쪽 루프가 간접 참조 없이 돈다. 더하는 순서는 같다)
  const Xs = gatherSlots(XA, c.slots)
  const Ys = gatherSlots(YA, c.slots)
  const O = out.data
  for (let i = 0; i < n; i++) {
    const xi = i * ns
    const noise = c.eps * xu[i]
    const oi = i * m
    for (let j = 0; j < m; j++) {
      const yj = j * ns
      let sum = 0
      for (let k = 0; k < ns; k++) sum += Xs[xi + k] * Ys[yj + k]
      O[oi + j] = (g * sum + noise * yv[j]) * scale
    }
  }
  return out
}

/** A (n × m) · YA (m × r) · G → (n × r).  (A·YA·G)[i][col] = gain·(A·YA)[i][col]·[col∈slots] + eps·(A·YA·u)[i]·v[col] */
export function coupledValues(A: Tensor, YA: Tensor, c: Coupling): Tensor {
  const r = CONCEPT_SLOTS
  const n = A.rows
  const m = A.cols
  const yu = new Float32Array(m)
  for (let j = 0; j < m; j++) yu[j] = dot(YA.data, j * r, c.u)
  const slots = Int32Array.from(c.slots)
  const ns = slots.length
  const out = tensor(n, r)
  const O = out.data
  const Ad = A.data
  const Ys = gatherSlots(YA, c.slots)
  const gain = c.gain
  const v = c.v
  // 한 행의 slot 칸 합을 Float32 칸에 차례로 더한다 (전과 같은 순서와 정밀도)
  const acc = new Float32Array(ns)
  for (let i = 0; i < n; i++) {
    const ai = i * m
    let au = 0
    for (let j = 0; j < m; j++) au += Ad[ai + j] * yu[j]
    const oi = i * r
    acc.fill(0)
    for (let j = 0; j < m; j++) {
      const a = Ad[ai + j]
      if (a === 0) continue
      const ga = gain * a
      const yj = j * ns
      for (let k = 0; k < ns; k++) acc[k] += ga * Ys[yj + k]
    }
    for (let k = 0; k < ns; k++) O[oi + slots[k]] += acc[k]
    const kk = c.eps * au
    for (let col = 0; col < r; col++) O[oi + col] += kk * v[col]
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// 무작위 저랭크 Linear (FFN, 출력 MLP)

export interface LowRankLinear {
  label: string
  inDim: number
  outDim: number
  rank: number
  A: Tensor
  B: Tensor
  bias: Float32Array | null
}

/** x · W + b = (x · A) · B + b */
export function applyLinear(x: Tensor, w: LowRankLinear, label = ''): Tensor {
  if (x.cols !== w.inDim) throw new Error(`applyLinear ${w.label}: input ${x.cols} vs ${w.inDim}`)
  const h = matmul(matmul(x, w.A), w.B, label)
  return w.bias ? addRowVector(h, w.bias, label) : h
}

/**
 * act(x · W1 + b1) · W2 + b2 를 행마다 한 번에 계산한다 (FFN, 출력 MLP 한 칸).
 * hidden(예: 2,048차원)을 행렬로 만들지 않아서 빠르다. 결과는 applyLinear를 두 번 쓴 것과 같다 (lowrank.test.ts).
 */
export function lowRankMLP(
  x: Tensor,
  w1: LowRankLinear,
  w2: LowRankLinear,
  act: 'relu' | 'none' = 'relu',
  label = '',
): Tensor {
  if (x.cols !== w1.inDim || w1.outDim !== w2.inDim) throw new Error(`lowRankMLP ${label}: shape mismatch`)
  const n = x.rows
  const din = w1.inDim
  const hidden = w1.outDim
  const dout = w2.outDim
  const r1 = w1.rank
  const r2 = w2.rank
  const X = x.data
  const A1 = w1.A.data
  const B1 = w1.B.data
  const b1 = w1.bias
  const A2 = w2.A.data
  const B2 = w2.B.data
  const b2 = w2.bias
  const out = tensor(n, dout, label)
  const O = out.data
  const z = new Float64Array(r1)
  const acc = new Float64Array(r2)
  const pre = new Float64Array(hidden)
  const relu = act === 'relu'
  for (let i = 0; i < n; i++) {
    z.fill(0)
    acc.fill(0)
    const xi = i * din
    for (let d = 0; d < din; d++) {
      const v = X[xi + d]
      if (v === 0) continue
      const ad = d * r1
      for (let k = 0; k < r1; k++) z[k] += v * A1[ad + k]
    }
    // hidden 칸마다 b1 + Σ_k z_k·B1[k][h]. k를 바깥에 두어 B1을 연속으로 읽는다 (칸마다 더하는 순서는 같다)
    if (b1) for (let h = 0; h < hidden; h++) pre[h] = b1[h]
    else pre.fill(0)
    for (let k = 0; k < r1; k++) {
      const zk = z[k]
      const bk = k * hidden
      for (let h = 0; h < hidden; h++) pre[h] += zk * B1[bk + h]
    }
    for (let h = 0; h < hidden; h++) {
      const p = pre[h]
      const a = relu ? (p > 0 ? p : 0) : p
      if (a === 0) continue
      const ah = h * r2
      for (let k = 0; k < r2; k++) acc[k] += a * A2[ah + k]
    }
    const oi = i * dout
    for (let c = 0; c < dout; c++) {
      let sum = b2 ? b2[c] : 0
      for (let k = 0; k < r2; k++) sum += acc[k] * B2[k * dout + c]
      O[oi + c] = sum
    }
  }
  return out
}

/** 확인용: 실제 모양의 dense 가중치 W = A · B */
export function denseWeight(w: LowRankLinear): Tensor {
  return matmul(w.A, w.B, `${w.label} (${w.inDim} × ${w.outDim})`)
}

export function randomTensor(r: Rng, rows: number, cols: number, std: number, label = ''): Tensor {
  return tensor(rows, cols, label, r.noiseArray(rows * cols, std))
}

/** 출력 크기가 입력과 비슷하게 유지되도록 std를 잡은 무작위 저랭크 Linear */
export function randomLowRank(
  r: Rng,
  label: string,
  inDim: number,
  outDim: number,
  rank: number,
  gain = 1,
  biasStd = 0,
): LowRankLinear {
  return {
    label,
    inDim,
    outDim,
    rank,
    A: randomTensor(r, inDim, rank, 1 / Math.sqrt(inDim)),
    B: randomTensor(r, rank, outDim, gain / Math.sqrt(rank)),
    bias: biasStd > 0 ? r.noiseArray(outDim, biasStd) : null,
  }
}
