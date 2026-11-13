// 논문 근거 배지. 숫자는 논문의 표와 그림에서 그대로 옮겼다 (PDF와 대조함).
// 현재 설정이 논문 실험과 같을 때만 숫자를 보여 준다. 바꾼 값이 둘 이상이거나 실험하지 않은 값이면 "논문에 없는 설정".
// 기준 토글(논문 / 공식 코드), seed, 온도는 실험 조건이 아니므로 배지에 영향을 주지 않는다.

import { PRESETS } from './presets'
import type { Config, InteractionMode } from './types'

export type Experiment = 'main' | 'interaction' | 'depth' | 'horizon'

export interface PaperBadge {
  experiment: Experiment
  /** 평균 성공률 (%) */
  success: number
  source: string
  /** 같은 실험에서 함께 바뀌는 숫자 (예: 파라미터 수) */
  extra?: string
  /** extra의 출처 (source와 다를 때. 기본 설정의 파라미터 수는 Tab. 1이 아니라 Tab. 9에 있다) */
  extraSource?: string
}

export interface PaperLookup {
  badge: PaperBadge | null
  /** 기본 프리셋과 다른 설정 이름 */
  changed: (keyof Config)[]
}

const MODE_LIBERO: Record<InteractionMode, number> = {
  none: 96.3,
  l_from_v_only: 96.8,
  v_from_l_only: 97.2,
  bidirectional: 97.6,
}

const MODE_ROBOTWIN: Record<InteractionMode, number> = {
  none: 82.58,
  l_from_v_only: 86.62,
  v_from_l_only: 87.08,
  bidirectional: 88.06,
}

const DEPTH_LIBERO: Record<number, { success: number; params: string }> = {
  2: { success: 95.4, params: '206.6M' },
  4: { success: 96.9, params: '211.3M' },
  6: { success: 97.6, params: '216.1M' },
}

const HORIZON_LIBERO: Record<number, number> = { 8: 96.8, 10: 97.3, 12: 97.6, 15: 96.7 }

/** 실험 조건에 해당하는 설정. 이 밖의 값(basis, seed, 온도)은 배지에 영향이 없다. */
const EXPERIMENT_KEYS: (keyof Config)[] = ['K', 'imageSize', 'stateDim', 'actionDim', 'Ns', 'N', 'interactionHeads', 'H', 'mode']

export function paperLookup(config: Config): PaperLookup {
  const base = PRESETS[config.profile === 'libero' ? 'LIBERO' : 'RoboTwin']
  const changed = EXPERIMENT_KEYS.filter((k) => config[k] !== base[k])
  const libero = config.profile === 'libero'

  if (changed.length === 0) {
    return {
      changed,
      badge: libero
        ? { experiment: 'main', success: 97.6, source: 'Tab. 1', extra: DEPTH_LIBERO[6].params, extraSource: 'Tab. 9' }
        : { experiment: 'main', success: 88.06, source: 'Tab. 2' },
    }
  }
  if (changed.length > 1) return { changed, badge: null }

  const [key] = changed
  if (key === 'mode') {
    return {
      changed,
      badge: libero
        ? { experiment: 'interaction', success: MODE_LIBERO[config.mode], source: 'Tab. 5' }
        : { experiment: 'interaction', success: MODE_ROBOTWIN[config.mode], source: 'Tab. 10' },
    }
  }
  if (libero && key === 'N' && DEPTH_LIBERO[config.N]) {
    const row = DEPTH_LIBERO[config.N]
    return { changed, badge: { experiment: 'depth', success: row.success, source: 'Tab. 9', extra: row.params, extraSource: 'Tab. 9' } }
  }
  if (libero && key === 'H' && HORIZON_LIBERO[config.H] !== undefined) {
    return { changed, badge: { experiment: 'horizon', success: HORIZON_LIBERO[config.H], source: 'Fig. 6' } }
  }
  return { changed, badge: null }
}

/**
 * 프리셋 설명 카드에 쓰는 논문 사실. 텐서 모양에 쓰는 값(카메라 수, 이미지 크기, state, action, H)은
 * presets.ts의 PRESETS에서 읽고, 여기에는 화면 계산에 쓰지 않는 사실만 둔다.
 */
export const PRESET_FACTS = {
  libero: { visionEncoder: 'DINOv3 ViT-B/16', success: 97.6, latencyMs: 31.2, source: 'Tab. 1' },
  robotwin: { visionEncoder: 'DINOv3 ViT-L/16', success: 88.06, latencyMs: 43.4, source: 'Tab. 2' },
} as const
