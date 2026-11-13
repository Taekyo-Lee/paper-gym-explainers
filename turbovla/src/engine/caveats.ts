// 기술적 주의 (technical caveats)의 ID와 조건. 화면 문구는 content/caveats.ts.

import type { Config, ForwardInputs } from './types'

export const CAVEAT_IDS = [
  'virtual-values',
  'encoders-not-run',
  'scene-views',
  'concept-channels',
  'head-roles',
  'attention-maps',
  'designed-queries',
  'low-rank-weights',
  'layer-norm-affine',
  'temperature',
  'tokenizer',
  'inference-only',
  'internals-from-code',
  'action-script',
  'epos-values',
  'residual-placement',
  'text-block-omitted',
  'gamma-virtual',
  'subsentence-mask',
  'interaction-modes',
  'real-robot-shapes',
  'robotwin-execution',
] as const

export type CaveatId = (typeof CAVEAT_IDS)[number]

/** 설정과 관계없이 늘 해당하는 caveat */
export const ALWAYS: CaveatId[] = [
  'virtual-values',
  'encoders-not-run',
  'scene-views',
  'concept-channels',
  'head-roles',
  'attention-maps',
  'designed-queries',
  'low-rank-weights',
  'layer-norm-affine',
  'temperature',
  'tokenizer',
  'inference-only',
  'internals-from-code',
  'action-script',
]

/** 논문 실제 로봇 실험의 지시문 (Fig. 3(a), Fig. 4) */
export const REAL_ROBOT_INSTRUCTION = 'stack the three bowls'

export function activeCaveats(config: Config, inputs: ForwardInputs): CaveatId[] {
  const out = [...ALWAYS]
  // "섞지 않음" 모드는 interaction 층을 통째로 건너뛰므로 residual, γ, 텍스트 블록에 대한 주의가 해당하지 않는다
  const interacts = config.mode !== 'none'
  if (config.basis === 'paper') {
    out.push('epos-values')
    if (interacts) out.push('residual-placement', 'text-block-omitted')
  } else {
    // γ는 interaction 층 안에서, RoboTwin E_pos의 scale은 encoder에서 쓴다
    if (interacts || config.profile === 'robotwin') out.push('gamma-virtual')
    if (interacts) out.push('subsentence-mask')
  }
  if (config.mode !== 'bidirectional') out.push('interaction-modes')
  const instruction = inputs.instruction.trim().toLowerCase().replace(/[.!?]+$/, '')
  if (instruction === REAL_ROBOT_INSTRUCTION) out.push('real-robot-shapes')
  if (config.profile === 'robotwin') out.push('robotwin-execution')
  return out
}
