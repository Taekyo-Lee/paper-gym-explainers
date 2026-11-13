// 파라미터 패널에서 바꿀 수 있는 모든 범위에서 forward가 돌고, 모양이 설정을 따른다.
import { describe, expect, it } from 'vitest'
import { forward } from './forward'
import { HEAD_CHOICES, defaultState, presetConfig, withChanges } from './presets'
import { rowSums, shapeOf } from './tensor'
import type { Config, InteractionMode } from './types'

const STACK = 'Stack the three bowls'

function run(preset: 'LIBERO' | 'RoboTwin', changes: Partial<Config>) {
  const config = withChanges(presetConfig(preset), changes)
  return { config, t: forward(config, { instruction: STACK, state: defaultState(config) }) }
}

describe('조절 범위 전체', () => {
  for (const preset of ['LIBERO', 'RoboTwin'] as const) {
    it(`${preset}: K, 이미지 크기, N_s가 visual 토큰 수와 memory 모양을 정한다`, () => {
      for (const K of [1, 2, 3]) {
        for (const imageSize of [224, 256] as const) {
          for (const Ns of [1, 4]) {
            const { config, t } = run(preset, { K, imageSize, Ns })
            const P = (imageSize / 16) ** 2
            expect(t.views.length).toBe(K)
            expect(shapeOf(t.Zv)).toBe(`[${K * P} × 256]`)
            expect(shapeOf(t.state.Zs)).toBe(`[${Ns} × 256]`)
            expect(t.memory.rows).toBe(K * P + t.Zl.rows + Ns)
            expect(config.preset).toBe(K === presetConfig(preset).K && imageSize === presetConfig(preset).imageSize && Ns === 2 ? preset : 'Custom')
          }
        }
      }
    })

    it(`${preset}: N, heads, 모드에서 interaction 층과 attention 모양이 맞고 행 합이 1이다`, () => {
      const modes: InteractionMode[] = ['bidirectional', 'v_from_l_only', 'l_from_v_only', 'none']
      for (const N of [1, 6]) {
        for (const interactionHeads of HEAD_CHOICES) {
          for (const mode of modes) {
            const { t } = run(preset, { N, interactionHeads, mode })
            expect(t.layers.length).toBe(mode === 'none' ? 0 : N)
            for (const layer of t.layers) {
              expect(layer.A_v_from_l.length).toBe(interactionHeads)
              for (const A of [...layer.A_v_from_l, ...layer.A_l_from_v]) {
                for (const s of rowSums(A)) expect(s).toBeCloseTo(1, 4)
              }
            }
          }
        }
      }
    })

    it(`${preset}: H는 action query와 action chunk의 행 수다`, () => {
      for (const H of [1, 8, 50]) {
        const { config, t } = run(preset, { H })
        expect(shapeOf(t.Qa)).toBe(`[${H} × 256]`)
        expect(shapeOf(t.actions)).toBe(`[${H} × ${config.actionDim}]`)
        expect(t.decoder[0].crossAttn[0].rows).toBe(H)
      }
    })
  }

  it('온도와 seed는 프리셋을 Custom으로 바꾸지 않는다 (실험 조건이 아님)', () => {
    expect(withChanges(presetConfig('LIBERO'), { attnTemperature: 2, seed: 3 }).preset).toBe('LIBERO')
    expect(withChanges(presetConfig('LIBERO'), { N: 4 }).preset).toBe('Custom')
    expect(withChanges(withChanges(presetConfig('LIBERO'), { N: 4 }), { N: 6 }).preset).toBe('LIBERO')
  })
})
