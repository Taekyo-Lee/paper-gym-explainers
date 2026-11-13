// Action decoder: Eq. 9 Â_t = D_θ(Q_a, [Z^{vl}_t ; Z^s_t]) ∈ R^{H × d_a}.
// 구조는 논문에 없어서 공식 코드를 따른다 (caveat internals-from-code):
//   층마다 pre-norm  x ← x + SelfAttn(LN(x));  x ← x + CrossAttn(LN(x), memory);  x ← x + FFN(LN(x))
//   mask 없음, query·memory에 위치 embedding 없음, 마지막 LayerNorm 없음
//   출력 MLP 256 → 512 → 512 → d_a (ReLU) 뒤 tanh

import { attention, type AttentionWeights } from './attention'
import { POSITION_RANGE, conceptIndex, conceptsInGroups, headGroups } from './concepts'
import { applyLinear, lowRankMLP, makeCoupling, makeSelector, makeWriter, randomLowRank, type LowRankLinear } from './lowrank'
import { rng } from './prng'
import { add, layerNorm, relu, tanh, tensor, type Tensor } from './tensor'
import type { Config, DecoderLayerTrace } from './types'

const SCORE_GAIN = 0.11
const VALUE_GAIN = 0.3
const FFN_RANK = 8
const MLP_RANK = 16

/**
 * Q_a = [q_1, …, q_H] (H × d). 학습되는 parameter라 실제 값은 알 수 없다 (caveat virtual-values).
 * 설명용 설계: 물체, 색, 동작 개념을 찾고, 앞쪽 step일수록 state(proprio)를 더 찾게 한다. step마다 다른 위치 성분도 섞는다.
 * query 자체는 지시문과 무관하다(실제 모델의 learned query처럼). 지시 정보는 memory 쪽(V←L로 바뀐 patch)에 있다.
 */
export function actionQueries(config: Config): Tensor {
  const r = rng(config.seed, 'decoder.action_queries')
  const Qa = tensor(config.H, config.d, 'Q_a', r.noiseArray(config.H * config.d, 0.3))
  const [start, end] = POSITION_RANGE
  const width = end - start
  for (let t = 0; t < config.H; t++) {
    const row = Qa.data.subarray(t * config.d, (t + 1) * config.d)
    const progress = config.H > 1 ? t / (config.H - 1) : 0
    row[conceptIndex('bowl')] += 0.8
    row[conceptIndex('plate')] += 0.5
    // 색은 모두 같은 크기로 찾는다. 지시문의 색 단어로 V←L에서 강해진 patch가 더 많은 attention을 받는다
    for (const color of ['pink', 'blue', 'green', 'white']) row[conceptIndex(color)] += 1.2
    row[conceptIndex('stack')] += 1
    row[conceptIndex('pick')] += 1
    row[conceptIndex('place')] += 0.6 + progress
    row[conceptIndex('proprio')] += 2 * (1 - progress)
    for (let f = 0; f < width / 2; f++) {
      const omega = 1 / Math.pow(50, (2 * f) / width)
      row[start + 2 * f] += 0.5 * Math.sin(t * omega)
      row[start + 2 * f + 1] += 0.5 * Math.cos(t * omega)
    }
  }
  return Qa
}

interface DecoderLayerWeights {
  self: AttentionWeights
  cross: AttentionWeights
  ffn1: LowRankLinear
  ffn2: LowRankLinear
}

function decoderLayerWeights(config: Config, layer: number): DecoderLayerWeights {
  const heads = config.decoderHeads
  const hd = config.d / heads
  const slots = headGroups(heads, 'decoder').map((g) => conceptsInGroups(g))
  const name = (part: string) => `decoder.${layer}.${part}`
  const seed = config.seed
  const make = (kind: 'self' | 'cross', qkScale: number): AttentionWeights => {
    const qIn = makeSelector(rng(seed, name(`${kind}.q_in`)))
    const kvIn = kind === 'self' ? qIn : makeSelector(rng(seed, name(`${kind}.kv_in`)))
    return {
      label: `decoder ${layer} ${kind}`,
      heads,
      headDim: hd,
      qIn,
      kIn: kvIn,
      vIn: kvIn,
      qk: slots.map((sl, h) =>
        makeCoupling(rng(seed, name(`${kind}.qk.${h}`)), sl, qkScale * SCORE_GAIN * Math.sqrt(hd), 0.003 * Math.sqrt(hd)),
      ),
      vo: slots.map((sl, h) => makeCoupling(rng(seed, name(`${kind}.vo.${h}`)), sl, VALUE_GAIN, 0.01)),
      out: makeWriter(rng(seed, name(`${kind}.out`)), 1),
      bo: null,
    }
  }
  const ffnRng = rng(seed, name('ffn'))
  return {
    self: make('self', 0.6),
    cross: make('cross', 1),
    ffn1: randomLowRank(ffnRng, 'decoder FFN 1', config.d, config.decoderFFNDim, FFN_RANK, 1, 0.05),
    ffn2: randomLowRank(ffnRng, 'decoder FFN 2', config.decoderFFNDim, config.d, FFN_RANK, 0.5, 0.05),
  }
}

export interface DecoderResult {
  Qa: Tensor
  layers: DecoderLayerTrace[]
  hidden: Tensor
  output: Tensor
}

export function runDecoder(config: Config, memory: Tensor): DecoderResult {
  const Qa = actionQueries(config)
  const layers: DecoderLayerTrace[] = []
  let x = Qa
  for (let l = 1; l <= config.decoderLayers; l++) {
    const w = decoderLayerWeights(config, l)
    const xn = layerNorm(x)
    const sa = attention(xn, xn, w.self, { temperature: config.attnTemperature, label: `decoder ${l} self` })
    const x1 = add(x, sa.out)
    const ca = attention(layerNorm(x1), memory, w.cross, { temperature: config.attnTemperature, label: `decoder ${l} cross` })
    const x2 = add(x1, ca.out)
    const ffn = lowRankMLP(layerNorm(x2), w.ffn1, w.ffn2)
    x = add(x2, ffn, `decoder ${l} out`)
    layers.push({ index: l, selfAttn: sa.A, crossAttn: ca.A, out: x })
  }

  // 출력 MLP (Tab. 7 hidden 512, 공식 코드 3층) + tanh
  const r = rng(config.seed, 'decoder.output_mlp')
  const rank = (outDim: number) => Math.min(MLP_RANK, outDim)
  const mlp1 = randomLowRank(r, 'MLP 1', config.d, config.outputMLPHidden, rank(config.outputMLPHidden), 1.5, 0.1)
  const mlp2 = randomLowRank(r, 'MLP 2', config.outputMLPHidden, config.outputMLPHidden, rank(config.outputMLPHidden), 1.5, 0.1)
  const mlp3 = randomLowRank(r, 'MLP 3', config.outputMLPHidden, config.actionDim, rank(config.actionDim), 1, 0.1)
  // Linear(256→512) → ReLU → Linear(512→512) → ReLU → Linear(512→d_a)
  const h2 = relu(lowRankMLP(x, mlp1, mlp2, 'relu'))
  const raw = applyLinear(h2, mlp3)
  return { Qa, layers, hidden: x, output: tanh(raw, 'Â_t (decoder 출력)') }
}
