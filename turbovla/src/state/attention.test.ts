import { describe, expect, it } from 'vitest'
import { firstObjectPhrase } from '../engine/actions'
import { forward } from '../engine/forward'
import { defaultState, presetConfig } from '../engine/presets'
import { rowView } from '../engine/tensor'
import type { Basis, ForwardTrace } from '../engine/types'
import { groupHas, groupTokens, heatOpacity, patchColumn, segmentSums, sliceCols, wordHeat } from './attention'

const STACK = 'Stack the three bowls'
const BLUE = 'Pick up the blue bowl and place it on the plate'

function run(preset: 'LIBERO' | 'RoboTwin', basis: Basis, instruction: string): ForwardTrace {
  const config = presetConfig(preset, { basis })
  return forward(config, { instruction, state: defaultState(config) })
}

describe('attention 화면 함수', () => {
  it('wordHeat은 V←L 행렬의 열을 view별 격자로 나눈 것이다', () => {
    const t = run('LIBERO', 'paper', STACK)
    const A = t.layers[0].A_v_from_l[0]
    const heat = wordHeat(A, 4, t.views)
    expect(heat.length).toBe(t.views.length)
    const P = t.views[0].grid ** 2
    heat.forEach((h, vi) => h.forEach((v, p) => expect(v).toBe(A.data[(vi * P + p) * A.cols + 4])))
  })

  it('heatOpacity: 고르게 나눈 값 이하는 0, 가장 큰 값은 1, 순서는 그대로', () => {
    const heat = [Float32Array.from([0.1, 0.2, 0.5]), Float32Array.from([0.9, 0.25])]
    const { opacity, max, top, painted } = heatOpacity(heat, 0.25)
    expect(max).toBeCloseTo(0.9, 6)
    expect(top).toBeCloseTo(0.9, 6) // 0.9 > (1 + 0.25) / 2
    expect(painted).toBe(true)
    expect(Array.from(opacity[0])).toEqual([0, 0, expect.closeTo(0.25 / 0.65, 5)])
    expect(opacity[1][0]).toBeCloseTo(1, 6)
    expect(opacity[1][1]).toBe(0)
    // 모두 같으면 칠하지 않는다
    const flat = heatOpacity([Float32Array.from([0.2, 0.2])], 0.2)
    expect(Array.from(flat.opacity[0])).toEqual([0, 0])
    expect(flat.painted).toBe(false)
  })

  it('heatOpacity: 거의 고른 열의 작은 차이를 가장 진한 색으로 부풀리지 않는다', () => {
    const u = 1 / 6
    const nearlyFlat = heatOpacity([Float32Array.from([u + 0.01, u, u - 0.01])], u)
    expect(nearlyFlat.top).toBeCloseTo((1 + u) / 2, 6)
    expect(nearlyFlat.opacity[0][0]).toBeLessThan(0.05)
  })

  it('patchColumn은 L←V 행렬의 열이다', () => {
    const t = run('RoboTwin', 'paper', STACK)
    const A = t.layers[1].A_l_from_v[2]
    const col = patchColumn(A, 300)
    expect(col.length).toBe(A.rows)
    col.forEach((v, r) => expect(v).toBe(A.data[r * A.cols + 300]))
  })

  it('[PAD]를 하나로 묶어도 값이 같다: 모든 [PAD]는 L←V에서 같은 행, V←L에서 0인 열', () => {
    const t = run('LIBERO', 'code', STACK)
    const groups = groupTokens(t.tokens.text)
    const pad = groups.find((g) => g.kind === 'pad')
    expect(pad?.count).toBe(t.tokens.text.filter((x) => x.kind === 'pad').length)
    expect(groups.length).toBe(t.tokens.text.length - (pad!.count - 1))
    expect(groupHas(pad!, pad!.index + pad!.count - 1)).toBe(true)
    for (const layer of t.layers) {
      for (let h = 0; h < layer.A_l_from_v.length; h++) {
        const L = layer.A_l_from_v[h]
        const V = layer.A_v_from_l[h]
        for (let k = 1; k < pad!.count; k++) {
          expect(Array.from(rowView(L, pad!.index + k))).toEqual(Array.from(rowView(L, pad!.index)))
        }
        for (let r = 0; r < V.rows; r++) for (let k = 0; k < pad!.count; k++) expect(V.data[r * V.cols + pad!.index + k]).toBe(0)
      }
    }
  })
})

describe('decoder cross-attention의 memory 구간 요약', () => {
  for (const preset of ['LIBERO', 'RoboTwin'] as const) {
    for (const basis of ['paper', 'code'] as Basis[]) {
      it(`${preset} ${basis}: 세 구간이 memory 전체를 나누고, query마다 세 합이 1이다`, () => {
        const t = run(preset, basis, STACK)
        const { visual, text, state } = t.memorySegments
        expect(visual[0]).toBe(0)
        expect(visual[1]).toBe(text[0])
        expect(text[1]).toBe(state[0])
        expect(state[1]).toBe(t.memory.rows)
        for (const layer of t.decoder) {
          for (const A of layer.crossAttn) {
            expect(A.cols).toBe(t.memory.rows)
            for (const q of [0, A.rows - 1]) {
              const sums = segmentSums(A, q, [visual, text, state])
              expect(sums.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
            }
          }
        }
      })
    }
  }

  it('sliceCols로 나눈 세 구간을 다시 이으면 원래 행렬이다', () => {
    const t = run('LIBERO', 'code', STACK)
    const A = t.decoder[1].crossAttn[5]
    const { visual, text, state } = t.memorySegments
    const parts = [visual, text, state].map(([a, b]) => sliceCols(A, a, b))
    for (let r = 0; r < A.rows; r++) {
      const joined = parts.flatMap((p) => Array.from(p.data.subarray(r * p.cols, (r + 1) * p.cols)))
      expect(joined).toEqual(Array.from(A.data.subarray(r * A.cols, (r + 1) * A.cols)))
    }
  })

  it('설계: state head(6번)에서 앞쪽 query가 뒤쪽 query보다 state 구간을 더 본다 (caveat designed-queries)', () => {
    const t = run('LIBERO', 'paper', STACK)
    const A = t.decoder[0].crossAttn[5]
    const { visual, text, state } = t.memorySegments
    const first = segmentSums(A, 0, [visual, text, state])[2]
    const last = segmentSums(A, A.rows - 1, [visual, text, state])[2]
    expect(first).toBeGreaterThan(last)
  })
})

describe('텍스트 블록 그리드에서 [PAD]를 접어도 되는 이유', () => {
  it('공식 코드 기준 LIBERO: [PAD]는 자기 자신만 보고, 다른 토큰은 [PAD]를 보지 않는다', () => {
    const t = run('LIBERO', 'code', STACK)
    const n = t.tokens.text.length
    const pad = t.tokens.text.map((x) => x.kind === 'pad')
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const m = t.textSubSentence[r * n + c]
        if (pad[r]) expect(m).toBe(r === c ? 1 : 0)
        else if (pad[c]) expect(m).toBe(0)
      }
    }
    // self-attention 결과도 같다: [PAD] 열은 단어 행에서 0
    for (const layer of t.layers) {
      for (const A of layer.textLayer!.A) {
        for (let r = 0; r < n; r++) if (!pad[r]) for (let c = 0; c < n; c++) if (pad[c]) expect(A.data[r * n + c]).toBe(0)
      }
    }
  })
})

describe('장면 의미 (화면): 첫 층 첫 head의 V←L heatmap', () => {
  function heatOf(t: ForwardTrace, word: string): number[] {
    const j = t.tokens.text.findIndex((x) => x.name === word)
    return wordHeat(t.layers[0].A_v_from_l[0], j, t.views).flatMap((h) => Array.from(h))
  }

  /** heat가 가장 진한 patch 상위 5%의 물체 */
  function topObjects(t: ForwardTrace, word: string): string[] {
    const values = heatOf(t, word)
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0])
    return order.slice(0, Math.round(values.length * 0.05)).map(([, i]) => String(t.tokens.visual[i].object))
  }

  /** 물체마다 평균 heat, 큰 순서 */
  function objectRanking(t: ForwardTrace, word: string): string[] {
    const values = heatOf(t, word)
    const sums = new Map<string, [number, number]>()
    t.tokens.visual.forEach((tok, i) => {
      const [s, n] = sums.get(String(tok.object)) ?? [0, 0]
      sums.set(String(tok.object), [s + values[i], n + 1])
    })
    return [...sums].sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([o]) => o)
  }

  for (const basis of ['paper', 'code'] as Basis[]) {
    for (const preset of ['LIBERO', 'RoboTwin'] as const) {
      it(`${preset} ${basis}: "bowls"는 그릇 patch, "blue"는 파란 그릇 patch가 가장 진하다`, () => {
        const stack = run(preset, basis, STACK)
        expect(topObjects(stack, 'bowls').every((o) => o.endsWith('Bowl'))).toBe(true)
        // 물체별 평균으로도 세 그릇이 1–3등이다
        expect(new Set(objectRanking(stack, 'bowls').slice(0, 3))).toEqual(new Set(['pinkBowl', 'blueBowl', 'greenBowl']))
        const blue = run(preset, basis, BLUE)
        expect(topObjects(blue, 'blue').every((o) => o === 'blueBowl')).toBe(true)
        expect(objectRanking(blue, 'blue')[0]).toBe('blueBowl')
      })
    }
  }

  it('자동으로 고르는 단어(첫 물체 구)가 장면 의미 테스트의 단어다', () => {
    const stack = run('LIBERO', 'paper', STACK)
    expect(stack.tokens.text[firstObjectPhrase(stack.tokens.text)![0]].name).toBe('bowls')
    const blue = run('LIBERO', 'paper', BLUE)
    expect(blue.tokens.text[firstObjectPhrase(blue.tokens.text)![0]].name).toBe('blue')
  })
})
