// 체크포인트 1: `npm run shapes`로 LIBERO / RoboTwin × 논문 / 공식 코드의 모든 모양을 출력한다.

import { describe, expect, it } from 'vitest'
import { formatShapeReport, shapeReport } from './debug'
import { forward } from './forward'
import { defaultState, presetConfig } from './presets'

describe('checkpoint 1: shape report', () => {
  for (const preset of ['LIBERO', 'RoboTwin'] as const) {
    for (const basis of ['paper', 'code'] as const) {
      it(`${preset} / ${basis}`, () => {
        const config = presetConfig(preset, { basis })
        const trace = forward(config, { instruction: 'Stack the three bowls', state: defaultState(config) })
        console.info(`\n=== ${preset} / ${basis} ===\n${formatShapeReport(trace)}`)
        expect(shapeReport(trace).length).toBeGreaterThan(20)
      })
    }
  }
})
