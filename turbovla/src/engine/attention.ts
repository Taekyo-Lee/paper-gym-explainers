// 구조가 있는 가상 가중치로 하는 attention (caveat low-rank-weights).
//
// 실제 모양: Q = Xn·Wq (n × heads·hd), K = Yn·Wk, V = Yn·Wv, out = concat_h(A_h·V_h)·Wo + bo
// 가상 가중치 (lowrank.ts):
//   Wq = Sel_q · [B_q,1 | … | B_q,H],  Wk = Sel_k · [B_k,h],  B_q,h·B_k,hᵀ = G_h (Coupling)
//   Wv = Sel_v · [B_v,h],  Wo의 h번째 행 묶음 = A_o,h · Writer,  B_v,h·A_o,h = C_h (Coupling)
// 결합법칙으로 순서만 바꿔 계산한다 (결과는 펼친 dense 행렬로 한 계산과 같다. attention.test.ts가 확인):
//   S_h = (Xn·Sel_q) · G_h · (Yn·Sel_k)ᵀ / √hd,   out = Writer( Σ_h A_h · (Yn·Sel_v) · C_h ) + bo

import {
  applySelector,
  applyWriter,
  coupledScores,
  coupledValues,
  couplingFactors,
  type Coupling,
  type Selector,
  type Writer,
} from './lowrank'
import { addRowVector, biSoftmax, matmul, softmaxRows, tensor, transpose, type Tensor } from './tensor'

export interface AttentionWeights {
  label: string
  heads: number
  /** head 하나의 폭 (실제 모양 기준) */
  headDim: number
  qIn: Selector
  kIn: Selector
  vIn: Selector
  /** head별 Q·K 결합 G_h */
  qk: Coupling[]
  /** head별 value·out 결합 C_h */
  vo: Coupling[]
  out: Writer
  bo: Float32Array | null
}

export interface AttentionOptions {
  temperature?: number
  keyMask?: Uint8Array | null
  allowed?: Uint8Array | null
  label?: string
}

export interface AttentionResult {
  /** head별 score (n × m), 1/√hd까지 곱한 값 */
  S: Tensor[]
  /** head별 attention (n × m), 행 합 = 1 */
  A: Tensor[]
  /** (n × D) */
  out: Tensor
}

function accumulate(target: Tensor | null, other: Tensor): Tensor {
  if (!target) return other
  for (let i = 0; i < target.data.length; i++) target.data[i] += other.data[i]
  return target
}

/** Xn이 query 쪽, Yn이 key·value 쪽 입력이다 (정규화는 부르는 쪽이 한다). */
export function attention(Xn: Tensor, Yn: Tensor, w: AttentionWeights, options: AttentionOptions = {}): AttentionResult {
  const { temperature = 1, keyMask = null, allowed = null, label = w.label } = options
  const XA = applySelector(Xn, w.qIn)
  const YK = Xn === Yn && w.kIn === w.qIn ? XA : applySelector(Yn, w.kIn)
  const YV = w.vIn === w.kIn ? YK : applySelector(Yn, w.vIn)
  const scale = 1 / Math.sqrt(w.headDim)
  const S: Tensor[] = []
  const A: Tensor[] = []
  let acc: Tensor | null = null
  for (let h = 0; h < w.heads; h++) {
    const s = coupledScores(XA, YK, w.qk[h], scale, `${label} S head ${h + 1}`)
    const a = softmaxRows(s, `${label} A head ${h + 1}`, { temperature, keyMask, allowed })
    acc = accumulate(acc, coupledValues(a, YV, w.vo[h]))
    S.push(s)
    A.push(a)
  }
  let out = applyWriter(acc as Tensor, w.out, `${label} out`)
  if (w.bo) out = addRowVector(out, w.bo, `${label} out`)
  return { S, A, out }
}

// ---------------------------------------------------------------------------------------------
// interaction 층의 양방향 cross-attention (공식 코드 BiAttentionBlock)
//
// 실제 모양: v_proj, l_proj, values_v_proj, values_l_proj (D → inner), out_v_proj, out_l_proj (inner → D)
//   S_h     = (Vn·Wv_h)(Ln·Wl_h)ᵀ / √hd            (K·P × N_l)
//   A_{v←l} = softmax_행(S_h)    (patch가 묻는다, key mask: [PAD])
//   A_{l←v} = softmax_행(S_hᵀ)   (단어가 묻는다, mask 없음)
//   ΔV = concat_h(A_{v←l,h}·Ln·Wvalue_l,h)·Wout_v,   ΔL = concat_h(A_{l←v,h}·Vn·Wvalue_v,h)·Wout_l
// 가상 가중치는 stream마다 Selector 하나를 Q·K·value projection이 같이 쓴다.

export interface BiAttentionWeights {
  label: string
  heads: number
  headDim: number
  vIn: Selector
  lIn: Selector
  /** head별 G_h = B_v,h · B_l,hᵀ (v_proj와 l_proj의 결합) */
  qk: Coupling[]
  /** head별 ΔV 경로: values_l_proj · out_v_proj */
  voV: Coupling[]
  /** head별 ΔL 경로: values_v_proj · out_l_proj */
  voL: Coupling[]
  outV: Writer
  outL: Writer
}

export interface BiAttentionResult {
  S: Tensor[]
  A_v_from_l: Tensor[]
  A_l_from_v: Tensor[]
  dV: Tensor
  dL: Tensor
}

export function biAttention(
  Vn: Tensor,
  Ln: Tensor,
  w: BiAttentionWeights,
  options: { temperature?: number; textKeyMask?: Uint8Array | null; label?: string } = {},
): BiAttentionResult {
  const { temperature = 1, textKeyMask = null, label = w.label } = options
  const VA = applySelector(Vn, w.vIn)
  const LA = applySelector(Ln, w.lIn)
  const scale = 1 / Math.sqrt(w.headDim)
  const S: Tensor[] = []
  const Avl: Tensor[] = []
  const Alv: Tensor[] = []
  let accV: Tensor | null = null
  let accL: Tensor | null = null
  for (let h = 0; h < w.heads; h++) {
    const s = coupledScores(VA, LA, w.qk[h], scale, `${label} S head ${h + 1}`)
    // 같은 S를 행(patch가 묻는다)과 열(단어가 묻는다)로 각각 softmax
    const { rowWise: avl, colWise: alv } = biSoftmax(s, temperature, textKeyMask, [
      `${label} A v←l head ${h + 1}`,
      `${label} A l←v head ${h + 1}`,
    ])
    accV = accumulate(accV, coupledValues(avl, LA, w.voV[h]))
    accL = accumulate(accL, coupledValues(alv, VA, w.voL[h]))
    S.push(s)
    Avl.push(avl)
    Alv.push(alv)
  }
  return {
    S,
    A_v_from_l: Avl,
    A_l_from_v: Alv,
    dV: applyWriter(accV as Tensor, w.outV, `${label} ΔV`),
    dL: applyWriter(accL as Tensor, w.outL, `${label} ΔL`),
  }
}

// ---------------------------------------------------------------------------------------------
// 확인용: 실제 모양의 dense projection 행렬로 펼친다

/** Selector (D × r) · [left_h] → (D × heads·hd) */
export function denseProjection(sel: Selector, couplings: Coupling[], headDim: number, side: 'left' | 'right'): Tensor {
  const out = tensor(sel.dense.rows, headDim * couplings.length)
  couplings.forEach((c, h) => {
    const [left, right] = couplingFactors(c, headDim)
    const part = matmul(sel.dense, side === 'left' ? left : right)
    for (let r = 0; r < part.rows; r++) out.data.set(part.data.subarray(r * headDim, (r + 1) * headDim), r * out.cols + h * headDim)
  })
  return out
}

/** 출력 projection (heads·hd × D): h번째 행 묶음 = rightᵀ(C_h) · Writer */
export function denseOutput(couplings: Coupling[], headDim: number, writer: Writer): Tensor {
  const D = writer.dense.cols
  const out = tensor(headDim * couplings.length, D)
  couplings.forEach((c, h) => {
    const [, right] = couplingFactors(c, headDim)
    out.data.set(matmul(transpose(right), writer.dense).data, h * headDim * D)
  })
  return out
}
