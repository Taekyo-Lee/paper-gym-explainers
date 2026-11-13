// Config + 입력 → ForwardTrace. 같은 Config와 같은 입력이면 항상 같은 값이다.
//
// 단계별 memo: 설정 하나를 바꿔도 대개 일부 단계만 다시 계산하면 된다.
//   H를 바꾸면 decoder만, 지시문을 바꾸면 text 이후만, 온도를 바꾸면 interaction 이후만 다시 계산한다.
// 단계마다 그 단계가 실제로 읽는 설정만 key로 쓰고, key가 같으면 지난 결과를 그대로 쓴다.
// 단계마다 최근 결과 MEMO_SIZE개를 기억한다(LRU): 발표 중에 LIBERO ↔ RoboTwin, 논문 ↔ 공식 코드처럼 두 값을
// 오가면 돌아갈 때 다시 계산하지 않는다 (측정해 보니 프리셋 전환 116 ms의 절반 이상이 계산이었다).
// tensor는 만든 뒤 바꾸지 않으므로 여러 trace가 같은 결과를 공유해도 안전하다.

import { scriptActions, scriptTarget } from './actions'
import { activeCaveats } from './caveats'
import { runDecoder, type DecoderResult } from './decoder'
import { encodeState, encodeText, encodeVision, type StateResult, type TextResult, type VisionResult } from './encoders'
import { runInteraction, type InteractionResult } from './interaction'
import { validateConfig } from './presets'
import { concatRows, relabel, type Tensor } from './tensor'
import type { Config, ForwardInputs, ForwardTrace } from './types'

interface StageValues {
  vision: VisionResult
  text: TextResult
  state: StateResult
  interaction: InteractionResult
  decoder: { memory: Tensor; result: DecoderResult }
}

/** 단계마다 기억하는 결과 수 (가장 최근에 쓴 것이 앞) */
export const MEMO_SIZE = 3

const cache: { [K in keyof StageValues]?: { key: string; value: StageValues[K] }[] } = {}

function memo<K extends keyof StageValues>(stage: K, key: string, compute: () => StageValues[K]): StageValues[K] {
  const entries = (cache[stage] ??= []) as { key: string; value: StageValues[K] }[]
  const at = entries.findIndex((e) => e.key === key)
  if (at >= 0) {
    const [hit] = entries.splice(at, 1)
    entries.unshift(hit)
    return hit.value
  }
  const value = compute()
  entries.unshift({ key, value })
  if (entries.length > MEMO_SIZE) entries.length = MEMO_SIZE
  return value
}

/** 테스트에서 memo 없이 처음부터 계산할 때 쓴다 */
export function clearForwardCache(): void {
  for (const k of Object.keys(cache) as (keyof StageValues)[]) delete cache[k]
}

export function forward(config: Config, inputs: ForwardInputs): ForwardTrace {
  const errors = validateConfig(config)
  if (errors.length) throw new Error(`invalid config: ${errors.join(', ')}`)
  const c = config

  const visionKey = JSON.stringify([c.seed, c.K, c.imageSize, c.patchSize, c.profile, c.basis])
  const textKey = JSON.stringify([c.seed, c.profile, c.basis, inputs.instruction])
  const stateKey = JSON.stringify([c.seed, c.stateDim, c.Ns, inputs.state])
  const interactionKey = JSON.stringify([visionKey, textKey, c.N, c.interactionHeads, c.interactionInnerDim, c.textFFNDim, c.mode, c.attnTemperature])
  const decoderKey = JSON.stringify([interactionKey, stateKey, c.H, c.actionDim, c.decoderLayers, c.decoderHeads, c.decoderFFNDim, c.outputMLPHidden])

  const vision = memo('vision', visionKey, () => encodeVision(c))
  const text = memo('text', textKey, () => encodeText(c, inputs.instruction))
  const state = memo('state', stateKey, () => encodeState(c, inputs.state))
  const interaction = memo('interaction', interactionKey, () =>
    runInteraction(c, vision.Zv, text.Zl, text.keyPadding, text.subSentence),
  )
  // decoder memory = [V^N ; L^N ; Z^s] (App. A.1, 공식 코드와 같은 순서)
  const { memory, result: decoder } = memo('decoder', decoderKey, () => {
    const memory = concatRows([interaction.V, interaction.L, state.Zs], '[Z^{vl} ; Z^s]')
    return { memory, result: runDecoder(c, memory) }
  })

  const nv = interaction.V.rows
  const nl = interaction.L.rows
  const target = scriptTarget(interaction.layers, decoder.layers[decoder.layers.length - 1], vision.tokens, text.tokens)

  return {
    config,
    inputs,
    views: vision.views,
    tokens: { visual: vision.tokens, text: text.tokens, state: state.tokens },
    Zv: vision.Zv,
    Zv_parts: { content: vision.content, pos: vision.pos, posScale: vision.posScale, view: vision.view },
    Zl: text.Zl,
    textKeyPadding: text.keyPadding,
    textSubSentence: text.subSentence,
    state: { s: state.s, split: state.split, Zs: state.Zs },
    layers: interaction.layers,
    Zvl: relabel(interaction.Zvl, 'Z^{vl}'),
    memory,
    memorySegments: { visual: [0, nv], text: [nv, nv + nl], state: [nv + nl, nv + nl + state.Zs.rows] },
    Qa: decoder.Qa,
    decoder: decoder.layers,
    decoderOutput: decoder.output,
    actions: scriptActions(config, inputs.state, target),
    actionTarget: target,
    caveats: activeCaveats(config, inputs),
  }
}
