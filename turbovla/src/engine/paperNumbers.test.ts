// 논문 근거 배지

import { describe, expect, it } from 'vitest'
import { PRESET_FACTS, paperLookup } from './paperNumbers'
import { presetConfig } from './presets'
import type { Config, InteractionMode } from './types'

const libero = (o: Partial<Config> = {}) => paperLookup(presetConfig('LIBERO', o))
const robotwin = (o: Partial<Config> = {}) => paperLookup(presetConfig('RoboTwin', o))

describe('논문 근거 배지', () => {
  it('기본 프리셋은 주요 결과', () => {
    expect(libero().badge).toMatchObject({ success: 97.6, source: 'Tab. 1', extra: '216.1M', extraSource: 'Tab. 9' })
    expect(robotwin().badge).toMatchObject({ success: 88.06, source: 'Tab. 2' })
  })

  it('LIBERO interaction 모드 → Tab. 5', () => {
    const expected: Record<InteractionMode, number> = { none: 96.3, l_from_v_only: 96.8, v_from_l_only: 97.2, bidirectional: 97.6 }
    for (const [mode, success] of Object.entries(expected) as [InteractionMode, number][]) {
      const badge = libero({ mode }).badge
      expect(badge?.success).toBe(success)
      if (mode !== 'bidirectional') expect(badge?.source).toBe('Tab. 5')
    }
  })

  it('RoboTwin interaction 모드 → Tab. 10', () => {
    expect(robotwin({ mode: 'none' }).badge).toMatchObject({ success: 82.58, source: 'Tab. 10' })
    expect(robotwin({ mode: 'l_from_v_only' }).badge?.success).toBe(86.62)
    expect(robotwin({ mode: 'v_from_l_only' }).badge?.success).toBe(87.08)
  })

  it('LIBERO N = 2, 4 → Tab. 9 (파라미터 수 포함), H = 8, 10, 15 → Fig. 6', () => {
    expect(libero({ N: 2 }).badge).toMatchObject({ success: 95.4, source: 'Tab. 9', extra: '206.6M' })
    expect(libero({ N: 4 }).badge).toMatchObject({ success: 96.9, extra: '211.3M' })
    expect(libero({ H: 8 }).badge).toMatchObject({ success: 96.8, source: 'Fig. 6' })
    expect(libero({ H: 10 }).badge?.success).toBe(97.3)
    expect(libero({ H: 15 }).badge?.success).toBe(96.7)
  })

  it('실험하지 않은 값, 둘 이상 바꾼 설정, RoboTwin의 N·H 변경은 "논문에 없는 설정"', () => {
    expect(libero({ N: 3 }).badge).toBeNull()
    expect(libero({ H: 9 }).badge).toBeNull()
    expect(libero({ N: 2, H: 8 }).badge).toBeNull()
    expect(libero({ interactionHeads: 8 }).badge).toBeNull()
    expect(robotwin({ H: 12 }).badge).toBeNull()
    expect(robotwin({ N: 2 }).badge).toBeNull()
  })

  it('기준 토글, seed, 온도는 배지에 영향이 없다', () => {
    expect(libero({ basis: 'code', seed: 99, attnTemperature: 2 }).badge).toMatchObject({ success: 97.6 })
    expect(libero({ basis: 'code', mode: 'none' }).badge?.success).toBe(96.3)
  })
})

describe('프리셋 설명 카드의 논문 숫자', () => {
  it('성공률과 출처가 기본 설정의 논문 배지와 같다', () => {
    expect(libero().badge).toMatchObject({ success: PRESET_FACTS.libero.success, source: PRESET_FACTS.libero.source })
    expect(robotwin().badge).toMatchObject({ success: PRESET_FACTS.robotwin.success, source: PRESET_FACTS.robotwin.source })
  })
})
