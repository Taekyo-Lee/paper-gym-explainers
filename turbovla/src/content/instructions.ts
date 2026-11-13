// 지시문 프리셋. 장면의 그릇 세 개(분홍, 파랑, 초록)와 접시에 맞춘 문장이다.
export const INSTRUCTION_PRESETS = [
  'Stack the three bowls',
  'Pick up the blue bowl and place it on the plate',
  'Put the pink bowl on the green bowl',
] as const

export const DEFAULT_INSTRUCTION: string = INSTRUCTION_PRESETS[0]
