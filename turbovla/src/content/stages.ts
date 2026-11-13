// 화면의 여섯 단계. 순서가 곧 데이터 흐름 순서다.
export const STAGES = ['inputs', 'encoders', 'interaction', 'memory', 'decoder', 'output'] as const

export type StageId = (typeof STAGES)[number]

export type KeyIdeaId = 'k1' | 'k2' | 'k3'

/** 세미나 Chapter 05의 Key Idea와 단계의 대응 */
export const STAGE_KEY_IDEA: Partial<Record<StageId, KeyIdeaId>> = {
  encoders: 'k1',
  interaction: 'k2',
  decoder: 'k3',
}

export function isStageId(value: string): value is StageId {
  return (STAGES as readonly string[]).includes(value)
}
