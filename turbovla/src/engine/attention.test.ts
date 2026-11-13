// caveat low-rank-weights의 근거: 구조화한 가중치로 결합법칙을 써서 한 계산이
// 실제 모양의 dense 행렬로 한 계산과 같은지 확인한다.

import { describe, expect, it } from 'vitest'
import { attention, biAttention, denseOutput, denseProjection, type AttentionWeights, type BiAttentionWeights } from './attention'
import { CONCEPT_SLOTS, D } from './concepts'
import {
  applySelector,
  applyWriter,
  coupledScores,
  coupledValues,
  couplingDense,
  couplingFactors,
  makeCoupling,
  makeSelector,
  makeWriter,
} from './lowrank'
import { rng } from './prng'
import { matmul, matmulBT, maxAbsDiff, scale, softmaxRows, tensor, transpose, type Tensor } from './tensor'

const TOL = 1e-3

function randomInput(rows: number, seed: string): Tensor {
  return tensor(rows, D, seed, rng(1, seed).normalArray(rows * D, 1))
}

function headSlice(t: Tensor, h: number, hd: number): Tensor {
  const out = tensor(t.rows, hd)
  for (let r = 0; r < t.rows; r++) out.data.set(t.data.subarray(r * t.cols + h * hd, r * t.cols + (h + 1) * hd), r * hd)
  return out
}

function concatCols(parts: Tensor[]): Tensor {
  const cols = parts.reduce((s, p) => s + p.cols, 0)
  const out = tensor(parts[0].rows, cols)
  let offset = 0
  for (const p of parts) {
    for (let r = 0; r < p.rows; r++) out.data.set(p.data.subarray(r * p.cols, (r + 1) * p.cols), r * cols + offset)
    offset += p.cols
  }
  return out
}

describe('구조화한 가중치 = 펼친 dense 행렬', () => {
  const x = randomInput(9, 'x')

  it('Selector', () => {
    const s = makeSelector(rng(2, 'sel'))
    expect(s.dense.rows).toBe(D)
    expect(s.dense.cols).toBe(CONCEPT_SLOTS)
    expect(maxAbsDiff(applySelector(x, s), matmul(x, s.dense))).toBeLessThan(TOL)
  })

  it('Writer', () => {
    const w = makeWriter(rng(3, 'wr'), 1.7)
    const h = tensor(9, CONCEPT_SLOTS, '', rng(4, 'h').normalArray(9 * CONCEPT_SLOTS))
    expect(maxAbsDiff(applyWriter(h, w), matmul(h, w.dense))).toBeLessThan(TOL)
  })

  it('Coupling: left · rightᵀ = G, scores = XA·G·YAᵀ, values = A·YA·G', () => {
    const c = makeCoupling(rng(5, 'c'), [0, 4, 7], 2.5, 0.3)
    const G = couplingDense(c)
    const [left, right] = couplingFactors(c, 16)
    expect(maxAbsDiff(matmulBT(left, right), G)).toBeLessThan(1e-5)

    const XA = tensor(7, CONCEPT_SLOTS, '', rng(6, 'xa').normalArray(7 * CONCEPT_SLOTS))
    const YA = tensor(5, CONCEPT_SLOTS, '', rng(7, 'ya').normalArray(5 * CONCEPT_SLOTS))
    expect(maxAbsDiff(coupledScores(XA, YA, c, 0.25), scale(matmulBT(matmul(XA, G), YA), 0.25))).toBeLessThan(TOL)

    const A = softmaxRows(tensor(7, 5, '', rng(8, 'a').normalArray(35)))
    expect(maxAbsDiff(coupledValues(A, YA, c), matmul(matmul(A, YA), G))).toBeLessThan(TOL)
  })

  it('multi-head attention: 실제 모양 Wq, Wk, Wv (256 × heads·hd), Wo (heads·hd × 256)로 한 계산과 같다', () => {
    const heads = 4
    const hd = 64
    const r = (s: string) => rng(11, s)
    const slots = [[0, 1, 4], [8, 9], [12, 16], []]
    const w: AttentionWeights = {
      label: 'test',
      heads,
      headDim: hd,
      qIn: makeSelector(r('q')),
      kIn: makeSelector(r('k')),
      vIn: makeSelector(r('v')),
      qk: slots.map((s, h) => makeCoupling(r(`qk${h}`), s, 3, 0.2)),
      vo: slots.map((s, h) => makeCoupling(r(`vo${h}`), s, 0.5, 0.1)),
      out: makeWriter(r('o'), 1),
      bo: r('bo').normalArray(D, 0.1),
    }
    const X = randomInput(6, 'X')
    const Y = randomInput(5, 'Y')
    const mask = Uint8Array.from([0, 0, 1, 0, 0])
    const fast = attention(X, Y, w, { temperature: 1.3, keyMask: mask })

    const Wq = denseProjection(w.qIn, w.qk, hd, 'left')
    const Wk = denseProjection(w.kIn, w.qk, hd, 'right')
    const Wv = denseProjection(w.vIn, w.vo, hd, 'left')
    const Wo = denseOutput(w.vo, hd, w.out)
    expect([Wq.rows, Wq.cols, Wo.rows, Wo.cols]).toEqual([256, 256, 256, 256])
    const Q = matmul(X, Wq)
    const K = matmul(Y, Wk)
    const V = matmul(Y, Wv)
    const heads_out: Tensor[] = []
    for (let h = 0; h < heads; h++) {
      const S = scale(matmulBT(headSlice(Q, h, hd), headSlice(K, h, hd)), 1 / Math.sqrt(hd))
      expect(maxAbsDiff(S, fast.S[h])).toBeLessThan(TOL)
      const A = softmaxRows(S, '', { temperature: 1.3, keyMask: mask })
      expect(maxAbsDiff(A, fast.A[h])).toBeLessThan(1e-5)
      heads_out.push(matmul(A, headSlice(V, h, hd)))
    }
    const out = matmul(concatCols(heads_out), Wo)
    for (let r = 0; r < out.rows; r++) for (let c = 0; c < D; c++) out.data[r * D + c] += (w.bo as Float32Array)[c]
    expect(maxAbsDiff(out, fast.out)).toBeLessThan(TOL)
  })

  it('self-attention (같은 입력, 같은 Selector)과 문장 mask: 실제 모양으로 한 계산과 같다', () => {
    const heads = 4
    const hd = 64
    const r = (s: string) => rng(31, s)
    const slots = [[0, 1, 4], [8, 9], [12, 16], []]
    const sel = makeSelector(r('sel'))
    const w: AttentionWeights = {
      label: 'self',
      heads,
      headDim: hd,
      qIn: sel,
      kIn: sel,
      vIn: sel,
      qk: slots.map((s, h) => makeCoupling(r(`qk${h}`), s, 3, 0.2)),
      vo: slots.map((s, h) => makeCoupling(r(`vo${h}`), s, 0.5, 0.1)),
      out: makeWriter(r('o'), 1),
      bo: null,
    }
    const X = randomInput(5, 'Xs')
    // [CLS] a b [SEP] [PAD] 의 문장 단위 mask
    const allowed = Uint8Array.from([1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1])
    const fast = attention(X, X, w, { allowed })
    const Q = matmul(X, denseProjection(sel, w.qk, hd, 'left'))
    const K = matmul(X, denseProjection(sel, w.qk, hd, 'right'))
    const V = matmul(X, denseProjection(sel, w.vo, hd, 'left'))
    const outs: Tensor[] = []
    for (let h = 0; h < heads; h++) {
      const A = softmaxRows(scale(matmulBT(headSlice(Q, h, hd), headSlice(K, h, hd)), 1 / Math.sqrt(hd)), '', { allowed })
      expect(maxAbsDiff(A, fast.A[h])).toBeLessThan(1e-5)
      outs.push(matmul(A, headSlice(V, h, hd)))
    }
    expect(maxAbsDiff(matmul(concatCols(outs), denseOutput(w.vo, hd, w.out)), fast.out)).toBeLessThan(TOL)
  })

  it('양방향 cross-attention: 실제 모양 v_proj, l_proj, values_*, out_* 로 한 계산과 같고 두 방향이 S를 공유한다', () => {
    const heads = 4
    const hd = 256
    const r = (s: string) => rng(21, s)
    const slots = [[0, 4], [8], [12, 16], []]
    const w: BiAttentionWeights = {
      label: 'bi',
      heads,
      headDim: hd,
      vIn: makeSelector(r('v')),
      lIn: makeSelector(r('l')),
      qk: slots.map((s, h) => makeCoupling(r(`qk${h}`), s, 2, 0.05)),
      voV: slots.map((s, h) => makeCoupling(r(`vv${h}`), s, 0.4, 0.02)),
      voL: slots.map((s, h) => makeCoupling(r(`vl${h}`), s, 0.4, 0.02)),
      outV: makeWriter(r('ov'), 1),
      outL: makeWriter(r('ol'), 1),
    }
    const Vn = randomInput(8, 'V')
    const Ln = randomInput(5, 'L')
    const pad = Uint8Array.from([0, 0, 0, 0, 1])
    for (const T of [1, 1.3, 0.02]) {
    const fast = biAttention(Vn, Ln, w, { textKeyMask: pad, temperature: T })

    const vProj = matmul(Vn, denseProjection(w.vIn, w.qk, hd, 'left')) // v_proj (256 × 1,024)
    const lProj = matmul(Ln, denseProjection(w.lIn, w.qk, hd, 'right')) // l_proj
    const valuesL = matmul(Ln, denseProjection(w.lIn, w.voV, hd, 'left')) // values_l_proj
    const valuesV = matmul(Vn, denseProjection(w.vIn, w.voL, hd, 'left')) // values_v_proj
    const outV: Tensor[] = []
    const outL: Tensor[] = []
    for (let h = 0; h < heads; h++) {
      const S = scale(matmulBT(headSlice(vProj, h, hd), headSlice(lProj, h, hd)), 1 / Math.sqrt(hd))
      expect(maxAbsDiff(S, fast.S[h])).toBeLessThan(TOL)
      const Avl = softmaxRows(S, '', { keyMask: pad, temperature: T })
      const Alv = softmaxRows(transpose(S), '', { temperature: T })
      expect(maxAbsDiff(Avl, fast.A_v_from_l[h])).toBeLessThan(1e-5)
      expect(maxAbsDiff(Alv, fast.A_l_from_v[h])).toBeLessThan(1e-5)
      outV.push(matmul(Avl, headSlice(valuesL, h, hd)))
      outL.push(matmul(Alv, headSlice(valuesV, h, hd)))
    }
    const dV = matmul(concatCols(outV), denseOutput(w.voV, hd, w.outV)) // out_v_proj (1,024 × 256)
    const dL = matmul(concatCols(outL), denseOutput(w.voL, hd, w.outL))
    expect(maxAbsDiff(dV, fast.dV)).toBeLessThan(TOL)
    expect(maxAbsDiff(dL, fast.dL)).toBeLessThan(TOL)
    }
  })
})
