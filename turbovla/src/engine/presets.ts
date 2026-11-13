// 프리셋과 Config 검사.

import type { Config, InteractionHeads, Preset, Profile } from './types'

const SHARED = {
  patchSize: 16,
  d: 256,
  Ns: 2,
  N: 6,
  interactionHeads: 4,
  interactionInnerDim: 1024,
  textFFNDim: 1024,
  decoderLayers: 3,
  decoderHeads: 8,
  decoderFFNDim: 2048,
  outputMLPHidden: 512,
  mode: 'bidirectional',
  attnTemperature: 1,
  seed: 7,
  basis: 'paper',
} as const

export const PRESETS: Record<Exclude<Preset, 'Custom'>, Config> = {
  LIBERO: {
    ...SHARED,
    preset: 'LIBERO',
    profile: 'libero',
    K: 2,
    imageSize: 256,
    stateDim: 8,
    actionDim: 7,
    H: 12,
  },
  RoboTwin: {
    ...SHARED,
    preset: 'RoboTwin',
    profile: 'robotwin',
    K: 3,
    imageSize: 224,
    stateDim: 14,
    actionDim: 14,
    H: 50,
  },
}

export function presetConfig(preset: Exclude<Preset, 'Custom'>, overrides: Partial<Config> = {}): Config {
  return { ...PRESETS[preset], ...overrides }
}

/** 프리셋 값에서 하나라도 바꾸면 Custom이 된다. profile은 원래 프리셋 것을 이어받는다. */
export function withChanges(config: Config, changes: Partial<Config>): Config {
  const next = { ...config, ...changes }
  const base = PRESETS[config.profile === 'libero' ? 'LIBERO' : 'RoboTwin']
  const keys = Object.keys(base) as (keyof Config)[]
  const differs = keys.some((k) => k !== 'preset' && k !== 'basis' && k !== 'seed' && k !== 'attnTemperature' && next[k] !== base[k])
  return { ...next, preset: differs ? 'Custom' : base.preset }
}

export const PROFILE_OF: Record<Exclude<Preset, 'Custom'>, Profile> = { LIBERO: 'libero', RoboTwin: 'robotwin' }

export const HEAD_CHOICES: readonly InteractionHeads[] = [1, 2, 4, 8]

/** 기본 robot state (설명용 값). LIBERO는 표준화된 값, RoboTwin은 [−1, 1] 관절과 {0, 1} gripper. */
export function defaultState(config: Config): number[] {
  if (config.stateDim === 8) return [0.3, -0.2, 0.5, 0.1, -0.1, 0, 0.8, -0.8]
  if (config.stateDim === 14) return [0, -0.3, 0.4, 0, 0.2, 0, 0, -0.3, 0.4, 0, 0.2, 0, 1, 1]
  return Array.from({ length: config.stateDim }, (_, i) => Math.round(Math.sin(i + 1) * 50) / 100)
}

/** 범위를 벗어난 값을 찾는다. 빈 배열이면 문제없음. */
export function validateConfig(config: Config): string[] {
  const errors: string[] = []
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(message)
  }
  check(Number.isInteger(config.K) && config.K >= 1 && config.K <= 3, 'K must be 1–3')
  check(config.imageSize === 224 || config.imageSize === 256, 'imageSize must be 224 or 256')
  check(Number.isInteger(config.N) && config.N >= 1 && config.N <= 6, 'N must be 1–6')
  check(HEAD_CHOICES.includes(config.interactionHeads), 'interactionHeads must be 1, 2, 4 or 8')
  check(Number.isInteger(config.H) && config.H >= 1 && config.H <= 50, 'H must be 1–50')
  check(Number.isInteger(config.Ns) && config.Ns >= 1 && config.Ns <= 4, 'Ns must be 1–4')
  check(Number.isInteger(config.stateDim) && config.stateDim >= 1, 'stateDim must be ≥ 1')
  check(Number.isInteger(config.actionDim) && config.actionDim >= 2, 'actionDim must be ≥ 2')
  check(config.attnTemperature > 0, 'attnTemperature must be > 0')
  return errors
}
