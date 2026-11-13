// V-L interaction: Eq. 6, 7, 8.
//
// 한 층 (두 기준 공통): Vn = LN(V^{ℓ−1}), Ln = LN(L^{ℓ−1})
//   공유 score S_h = (Vn·W_v,h)(Ln·W_l,h)ᵀ / √hd → A_{v←l} = softmax(S), A_{l←v} = softmax(Sᵀ)
// residual (기준에 따라):
//   논문           V^ℓ = V^{ℓ−1} + ΔV                    (Eq. 7을 글자 그대로, caveat residual-placement)
//   코드 LIBERO    V^ℓ = LN(V^{ℓ−1}) + γ·ΔV              (공식 코드 residual_style = "normalized")
//   코드 RoboTwin  V^ℓ = V^{ℓ−1} + γ·ΔV                  (공식 코드 residual_style = "pre_norm")
// 공식 코드 기준이면 이어서 텍스트 쪽만 self-attention + FFN (post-norm, 문장 단위 mask).

import { attention, biAttention, type AttentionWeights, type BiAttentionWeights } from './attention'
import { conceptsInGroups, headGroups } from './concepts'
import { VIRTUAL_SCALE } from './encoders'
import { lowRankMLP, makeCoupling, makeSelector, makeWriter, randomLowRank, type Coupling, type LowRankLinear } from './lowrank'
import { rng } from './prng'
import { add, addScaled, concatRows, layerNorm, relabel, type Tensor } from './tensor'
import type { Config, InteractionLayerTrace } from './types'

/** score = SCORE_GAIN · (맡은 개념 칸의 내적). head 폭 hd와 상관없이 크기가 같도록 G의 대각을 SCORE_GAIN·√hd로 둔다 (설명용 설계) */
const SCORE_GAIN = 0.11
/** ΔV, ΔL의 크기 (설명용 설계) */
const VALUE_GAIN = 0.35
const TEXT_FFN_RANK = 8

function qkCoupling(seed: number, stream: string, slots: number[], headDim: number): Coupling {
  return makeCoupling(rng(seed, stream), slots, SCORE_GAIN * Math.sqrt(headDim), 0.003 * Math.sqrt(headDim))
}

function voCoupling(seed: number, stream: string, slots: number[]): Coupling {
  return makeCoupling(rng(seed, stream), slots, VALUE_GAIN, 0.01)
}

export interface InteractionLayerWeights {
  bi: BiAttentionWeights
  text: { attn: AttentionWeights; ffn1: LowRankLinear; ffn2: LowRankLinear } | null
}

export function interactionWeights(config: Config, layer: number): InteractionLayerWeights {
  const heads = config.interactionHeads
  const hd = config.interactionInnerDim / heads
  const slots = headGroups(heads, 'interaction').map((g) => conceptsInGroups(g))
  const name = (part: string) => `interaction.${layer}.${part}`
  const seed = config.seed
  const bi: BiAttentionWeights = {
    label: `interaction ${layer}`,
    heads,
    headDim: hd,
    vIn: makeSelector(rng(seed, name('v_in'))),
    lIn: makeSelector(rng(seed, name('l_in'))),
    qk: slots.map((sl, h) => qkCoupling(seed, name(`qk.${h}`), sl, hd)),
    voV: slots.map((sl, h) => voCoupling(seed, name(`vo_v.${h}`), sl)),
    voL: slots.map((sl, h) => voCoupling(seed, name(`vo_l.${h}`), sl)),
    outV: makeWriter(rng(seed, name('out_v_proj')), 1),
    outL: makeWriter(rng(seed, name('out_l_proj')), 1),
  }
  if (config.basis !== 'code') return { bi, text: null }

  // 공식 코드의 텍스트 층: self-attention(heads = interactionHeads, hd = 256 / heads) + FFN(256 → 1,024 → 256)
  const textHd = config.d / heads
  const selector = makeSelector(rng(seed, name('text.in')))
  const attn: AttentionWeights = {
    label: `text layer ${layer}`,
    heads,
    headDim: textHd,
    qIn: selector,
    kIn: selector,
    vIn: selector,
    qk: slots.map((sl, h) => qkCoupling(seed, name(`text.qk.${h}`), sl, textHd)),
    vo: slots.map((sl, h) => voCoupling(seed, name(`text.vo.${h}`), sl)),
    out: makeWriter(rng(seed, name('text.out')), 1),
    bo: null,
  }
  const ffnRng = rng(seed, name('text.ffn'))
  return {
    bi,
    text: {
      attn,
      ffn1: randomLowRank(ffnRng, 'text FFN 1', config.d, config.textFFNDim, TEXT_FFN_RANK, 1, 0.05),
      ffn2: randomLowRank(ffnRng, 'text FFN 2', config.textFFNDim, config.d, TEXT_FFN_RANK, 0.5, 0.05),
    },
  }
}

export interface InteractionResult {
  layers: InteractionLayerTrace[]
  V: Tensor
  L: Tensor
  Zvl: Tensor
}

export function runInteraction(
  config: Config,
  Zv: Tensor,
  Zl: Tensor,
  textKeyPadding: Uint8Array,
  subSentence: Uint8Array,
): InteractionResult {
  if (config.mode === 'none') {
    // "w/o Interaction": interaction 층을 건너뛴다 (N = 0과 같음, caveat interaction-modes)
    return { layers: [], V: Zv, L: Zl, Zvl: concatRows([Zv, Zl], 'Z^{vl}') }
  }
  const active = {
    vFromL: config.mode !== 'l_from_v_only',
    lFromV: config.mode !== 'v_from_l_only',
  }
  const code = config.basis === 'code'
  const gamma = code ? VIRTUAL_SCALE : 1
  const hasPad = textKeyPadding.some((v) => v === 1)
  const layers: InteractionLayerTrace[] = []
  let V = Zv
  let L = Zl

  for (let l = 1; l <= config.N; l++) {
    const w = interactionWeights(config, l)
    const Vn = layerNorm(V, `LN(V^${l - 1})`)
    const Ln = layerNorm(L, `LN(L^${l - 1})`)
    const bi = biAttention(Vn, Ln, w.bi, {
      temperature: config.attnTemperature,
      // 공식 코드: [PAD]는 V←L 방향의 key에서만 가린다 (L←V는 mask 없음)
      textKeyMask: hasPad ? textKeyPadding : null,
      label: `layer ${l}`,
    })

    const normalizedResidual = code && config.profile === 'libero'
    const baseV = normalizedResidual ? Vn : V
    const baseL = normalizedResidual ? Ln : L
    const V_out = active.vFromL ? addScaled(baseV, bi.dV, gamma, `V^${l}`) : relabel(baseV, `V^${l}`)
    const L_mid = active.lFromV ? addScaled(baseL, bi.dL, gamma, `L′^${l}`) : relabel(baseL, `L′^${l}`)

    let L_out = relabel(L_mid, `L^${l}`)
    let textLayer: InteractionLayerTrace['textLayer'] = null
    if (w.text) {
      // post-norm: L1 = LN(L′ + SA(L′)), L^ℓ = LN(L1 + FFN(L1))
      const sa = attention(L_mid, L_mid, w.text.attn, {
        temperature: config.attnTemperature,
        allowed: subSentence,
        label: `text layer ${l}`,
      })
      const afterAttn = layerNorm(add(L_mid, sa.out), `LN(L′ + SA) ${l}`)
      const ffn = lowRankMLP(afterAttn, w.text.ffn1, w.text.ffn2)
      L_out = layerNorm(add(afterAttn, ffn), `L^${l}`)
      textLayer = { A: sa.A, afterAttn }
    }

    layers.push({
      index: l,
      V_in: V,
      L_in: L,
      V_norm: Vn,
      L_norm: Ln,
      S: bi.S,
      A_v_from_l: bi.A_v_from_l,
      A_l_from_v: bi.A_l_from_v,
      dV: bi.dV,
      dL: bi.dL,
      V_out,
      L_mid,
      L_out,
      textLayer,
      active,
    })
    V = V_out
    L = L_out
  }
  return { layers, V, L, Zvl: concatRows([V, L], 'Z^{vl}') }
}
