// forward 전체 검사: 텐서 모양, attention 행 합 = 1, 장면 의미, 기준(논문 / 공식 코드) 전환, 재현성, caveat

import { describe, expect, it } from 'vitest'
import { attention, biAttention } from './attention'
import { REAL_ROBOT_INSTRUCTION, CAVEAT_IDS } from './caveats'
import { VIRTUAL_SCALE, subSentenceMask, tokenize } from './encoders'
import { clearForwardCache, forward, MEMO_SIZE } from './forward'
import { interactionWeights } from './interaction'
import { lowRankMLP } from './lowrank'
import { PRESETS, defaultState, presetConfig } from './presets'
import { add, addScaled, concatRows, layerNorm, maxAbsDiff, rowSums, shapeOf, softmaxRows, transpose, type Tensor } from './tensor'
import type { Basis, Config, ForwardTrace } from './types'

const STACK = 'Stack the three bowls'
const BLUE = 'Pick up the blue bowl and place it on the plate'

function run(preset: 'LIBERO' | 'RoboTwin', overrides: Partial<Config> = {}, instruction = STACK): ForwardTrace {
  const config = presetConfig(preset, overrides)
  return forward(config, { instruction, state: defaultState(config) })
}

/** forward 결과의 모든 attention 행렬 */
/** memo 없이 처음부터 계산한다 */
function cold(preset: 'LIBERO' | 'RoboTwin', overrides: Partial<Config> = {}, instruction = STACK): ForwardTrace {
  clearForwardCache()
  return run(preset, overrides, instruction)
}

/** trace 안의 tensor를 모두 모은다 (재현성, memo 비교용) */
function tensorsOf(t: ForwardTrace): Tensor[] {
  return [
    t.Zv, t.Zl, t.state.s, t.state.Zs, t.Zvl, t.memory, t.Qa, t.decoderOutput, t.actions,
    t.Zv_parts.content, t.Zv_parts.view, ...(t.Zv_parts.pos ? [t.Zv_parts.pos] : []),
    ...t.layers.flatMap((l) => [l.V_in, l.L_in, l.V_norm, l.L_norm, l.dV, l.dL, l.V_out, l.L_mid, l.L_out, ...l.S, ...l.A_v_from_l, ...l.A_l_from_v, ...(l.textLayer ? [l.textLayer.afterAttn, ...l.textLayer.A] : [])]),
    ...t.decoder.flatMap((d) => [d.out, ...d.selfAttn, ...d.crossAttn]),
  ]
}

const bytes = (x: Tensor) => Buffer.from(x.data.buffer, x.data.byteOffset, x.data.byteLength)

function allAttention(t: ForwardTrace): Tensor[] {
  return [
    ...t.layers.flatMap((l) => [...l.A_v_from_l, ...l.A_l_from_v, ...(l.textLayer?.A ?? [])]),
    ...t.decoder.flatMap((d) => [...d.selfAttn, ...d.crossAttn]),
  ]
}

describe('텐서 모양', () => {
  it('LIBERO 논문 기준', () => {
    const t = run('LIBERO')
    const Nl = tokenize(STACK, t.config).length
    expect(Nl).toBe(6) // [CLS] stack the three bowls [SEP]
    expect(shapeOf(t.Zv)).toBe('[512 × 256]')
    expect(shapeOf(t.Zl)).toBe(`[${Nl} × 256]`)
    expect(shapeOf(t.state.Zs)).toBe('[2 × 256]')
    // 마지막 Linear 출력(1 × 512)을 둘로 자른 것. 행 i = 출력의 [256·i, 256·(i+1)) 토막, 위치를 더하고 LN하면 Z^s
    expect(shapeOf(t.state.split)).toBe('[2 × 256]')
    expect(maxAbsDiff(layerNorm(t.state.split), t.state.Zs)).toBeGreaterThan(0)
    expect(shapeOf(t.memory)).toBe(`[${512 + Nl + 2} × 256]`)
    expect(shapeOf(t.Qa)).toBe('[12 × 256]')
    expect(shapeOf(t.actions)).toBe('[12 × 7]')
    expect(shapeOf(t.decoderOutput)).toBe('[12 × 7]')
    expect(t.layers).toHaveLength(6)
    expect(t.layers[0].A_v_from_l).toHaveLength(4)
    expect(shapeOf(t.layers[0].A_v_from_l[0])).toBe(`[512 × ${Nl}]`)
    expect(shapeOf(t.layers[0].A_l_from_v[0])).toBe(`[${Nl} × 512]`)
    expect(t.decoder).toHaveLength(3)
    expect(t.decoder[0].crossAttn).toHaveLength(8)
    expect(shapeOf(t.decoder[0].crossAttn[0])).toBe(`[12 × ${512 + Nl + 2}]`)
  })

  it('LIBERO 공식 코드 기준: Z^l 21 × 256, memory 535 × 256', () => {
    const t = run('LIBERO', { basis: 'code' })
    expect(shapeOf(t.Zl)).toBe('[21 × 256]')
    expect(shapeOf(t.memory)).toBe('[535 × 256]')
  })

  it('RoboTwin', () => {
    for (const basis of ['paper', 'code'] as Basis[]) {
      const t = run('RoboTwin', { basis })
      const Nl = t.Zl.rows
      expect(shapeOf(t.Zv)).toBe('[588 × 256]')
      expect(shapeOf(t.state.Zs)).toBe('[2 × 256]')
      expect(shapeOf(t.memory)).toBe(`[${588 + Nl + 2} × 256]`)
      expect(shapeOf(t.Qa)).toBe('[50 × 256]')
      expect(shapeOf(t.actions)).toBe('[50 × 14]')
      expect(t.inputs.state).toHaveLength(14)
      expect(t.views.map((v) => v.name)).toEqual(['head', 'left wrist', 'right wrist'])
    }
  })

  it('memory 구간은 [V^N ; L^N ; Z^s] 순서다', () => {
    const t = run('LIBERO')
    expect(t.memorySegments).toEqual({ visual: [0, 512], text: [512, 518], state: [518, 520] })
  })
})

describe('모든 attention 행렬의 행 합 = 1', () => {
  const cases: [string, ForwardTrace][] = [
    ['LIBERO paper', run('LIBERO')],
    ['LIBERO code', run('LIBERO', { basis: 'code' })],
    ['RoboTwin code', run('RoboTwin', { basis: 'code' }, BLUE)],
    ['LIBERO 8 heads, T = 0.5', run('LIBERO', { interactionHeads: 8, attnTemperature: 0.5 }, BLUE)],
    ['LIBERO one-way', run('LIBERO', { mode: 'v_from_l_only', basis: 'code' })],
  ]
  for (const [name, t] of cases) {
    it(name, () => {
      const mats = allAttention(t)
      expect(mats.length).toBeGreaterThan(0)
      for (const A of mats) for (const sum of rowSums(A)) expect(Math.abs(sum - 1)).toBeLessThan(1e-5)
    })
  }
})

describe('공유 score와 mask (공식 코드)', () => {
  it('A_{v←l} = softmax(S), A_{l←v} = softmax(Sᵀ)', () => {
    const t = run('LIBERO', {}, BLUE)
    const layer = t.layers[2]
    for (let h = 0; h < layer.S.length; h++) {
      expect(maxAbsDiff(layer.A_v_from_l[h], softmaxRows(layer.S[h]))).toBeLessThan(1e-6)
      expect(maxAbsDiff(layer.A_l_from_v[h], softmaxRows(transpose(layer.S[h])))).toBeLessThan(1e-6)
    }
  })

  it('공식 코드 기준 LIBERO: [PAD]는 V←L의 key에서만 가리고, decoder memory에는 들어간다', () => {
    const t = run('LIBERO', { basis: 'code' })
    const pads = [...t.textKeyPadding.keys()].filter((i) => t.textKeyPadding[i])
    expect(pads).toHaveLength(15)
    const A = t.layers[0].A_v_from_l[0]
    for (let i = 0; i < A.rows; i++) for (const j of pads) expect(A.data[i * A.cols + j]).toBe(0)
    const B = t.layers[0].A_l_from_v[0]
    for (const j of pads) expect(rowSums(B)[j]).toBeCloseTo(1, 5)
    const cross = t.decoder[0].crossAttn[0]
    const textStart = t.memorySegments.text[0]
    expect(cross.data[textStart + pads[0]]).toBeGreaterThan(0)
  })

  it('문장 단위 mask는 Grounding DINO 규칙을 따른다', () => {
    const mask = subSentenceMask(['[CLS]', 'a', 'b', '[SEP]', '[PAD]'])
    const allowed = (r: number, c: number) => mask[r * 5 + c] === 1
    expect(allowed(0, 1)).toBe(false) // [CLS]는 자기 자신만
    expect(allowed(1, 2) && allowed(2, 3) && allowed(3, 1)).toBe(true) // 단어와 [SEP]이 한 블록
    expect(allowed(4, 4) && !allowed(4, 1)).toBe(true) // [PAD]는 자기 자신만
    const last = subSentenceMask(['[CLS]', 'a', 'b', '[SEP]'])
    expect(last[1 * 4 + 2]).toBe(0) // [SEP]이 마지막 칸이면 블록이 열리지 않는다 (코드 그대로)
  })
})

describe('기준(논문 / 공식 코드) 전환', () => {
  it('LIBERO', () => {
    const paper = run('LIBERO')
    const code = run('LIBERO', { basis: 'code' })
    expect(paper.Zv_parts.pos).not.toBeNull()
    expect(code.Zv_parts.pos).toBeNull()
    expect(paper.layers.every((l) => l.textLayer === null)).toBe(true)
    expect(code.layers.every((l) => l.textLayer !== null)).toBe(true)
    expect(paper.Zl.rows).toBe(6)
    expect(code.Zl.rows).toBe(21)
    // E_pos가 없으므로 공식 코드 기준의 Z^v는 content + e_view와 정확히 같다
    expect(maxAbsDiff(code.Zv, add(code.Zv_parts.content, code.Zv_parts.view))).toBeLessThan(1e-6)
  })

  it('RoboTwin: 공식 코드 기준은 학습 위치표 × scale', () => {
    const code = run('RoboTwin', { basis: 'code' })
    expect(code.Zv_parts.pos).not.toBeNull()
    expect(code.Zv_parts.posScale).toEqual([0.5, 0.5, 0.5])
    expect(run('RoboTwin').Zv_parts.posScale).toBeNull()
  })

  it('기준만 바꾸면 encoder의 content는 그대로다', () => {
    expect(maxAbsDiff(run('LIBERO').Zv_parts.content, run('LIBERO', { basis: 'code' }).Zv_parts.content)).toBe(0)
  })
})

describe('Eq. 4, 6–8과 기준별 residual: 모든 층을 다시 계산해 맞춰 본다', () => {
  for (const preset of ['LIBERO', 'RoboTwin'] as const) {
    for (const basis of ['paper', 'code'] as Basis[]) {
      it(`${preset} ${basis}`, () => {
        const t = run(preset, { basis }, BLUE)
        const c = t.config
        const gamma = basis === 'code' ? VIRTUAL_SCALE : 1
        const normalized = basis === 'code' && preset === 'LIBERO' // 공식 코드 LIBERO: LN을 거친 값에 더한다
        const pad = t.textKeyPadding.some((v) => v === 1) ? t.textKeyPadding : null
        const mask = subSentenceMask(t.tokens.text.map((x) => x.name))

        // Eq. 4: content + E_pos + e_view
        const expectedZv = t.Zv_parts.pos ? add(add(t.Zv_parts.content, t.Zv_parts.view), t.Zv_parts.pos) : add(t.Zv_parts.content, t.Zv_parts.view)
        expect(maxAbsDiff(t.Zv, expectedZv)).toBeLessThan(1e-5)

        let V = t.Zv
        let L = t.Zl
        for (const layer of t.layers) {
          expect(maxAbsDiff(layer.V_in, V)).toBe(0) // 앞 층 출력이 다음 층 입력
          expect(maxAbsDiff(layer.L_in, L)).toBe(0)
          expect(maxAbsDiff(layer.V_norm, layerNorm(V))).toBe(0)
          expect(maxAbsDiff(layer.L_norm, layerNorm(L))).toBe(0)
          // 두 방향 모두 ℓ−1 값에서 동시에 계산
          const w = interactionWeights(c, layer.index)
          const bi = biAttention(layer.V_norm, layer.L_norm, w.bi, { temperature: c.attnTemperature, textKeyMask: pad })
          expect(maxAbsDiff(layer.dV, bi.dV)).toBe(0)
          expect(maxAbsDiff(layer.dL, bi.dL)).toBe(0)
          // residual 위치와 γ
          expect(maxAbsDiff(layer.V_out, addScaled(normalized ? layer.V_norm : layer.V_in, layer.dV, gamma))).toBe(0)
          expect(maxAbsDiff(layer.L_mid, addScaled(normalized ? layer.L_norm : layer.L_in, layer.dL, gamma))).toBe(0)
          if (basis === 'code') {
            // 텍스트 self-attention + FFN, post-norm
            const text = w.text
            expect(text).not.toBeNull()
            const sa = attention(layer.L_mid, layer.L_mid, text!.attn, { temperature: c.attnTemperature, allowed: mask })
            const afterAttn = layerNorm(add(layer.L_mid, sa.out))
            expect(maxAbsDiff(layer.textLayer!.afterAttn, afterAttn)).toBe(0)
            expect(maxAbsDiff(layer.L_out, layerNorm(add(afterAttn, lowRankMLP(afterAttn, text!.ffn1, text!.ffn2))))).toBe(0)
          } else {
            expect(layer.textLayer).toBeNull()
            expect(maxAbsDiff(layer.L_out, layer.L_mid)).toBe(0)
          }
          V = layer.V_out
          L = layer.L_out
        }
        // Eq. 8과 memory
        expect(maxAbsDiff(t.Zvl, concatRows([V, L]))).toBe(0)
        expect(maxAbsDiff(t.memory, concatRows([V, L, t.state.Zs]))).toBe(0)
      })
    }
  }

  it('공식 코드 기준의 텍스트 self-attention은 문장 단위 mask 밖을 보지 않는다', () => {
    for (const preset of ['LIBERO', 'RoboTwin'] as const) {
      const t = run(preset, { basis: 'code' }, 'Pick up the blue bowl. Place it on the plate.')
      const names = t.tokens.text.map((x) => x.name)
      const mask = subSentenceMask(names)
      const n = names.length
      let blocked = 0
      for (const layer of t.layers) {
        for (const A of layer.textLayer!.A) {
          for (let r = 0; r < n; r++) {
            for (let col = 0; col < n; col++) {
              if (!mask[r * n + col]) {
                expect(A.data[r * n + col]).toBe(0)
                blocked++
              }
            }
          }
          for (const sum of rowSums(A)) expect(sum).toBeCloseTo(1, 5)
        }
      }
      expect(blocked).toBeGreaterThan(0)
    }
  })
})

describe('interaction 모드', () => {
  it('none: interaction 층이 없고 Z^{vl} = [Z^v ; Z^l]', () => {
    const t = run('LIBERO', { mode: 'none' })
    expect(t.layers).toHaveLength(0)
    expect(t.Zvl.rows).toBe(t.Zv.rows + t.Zl.rows)
    expect(Array.from(t.Zvl.data.subarray(0, 256))).toEqual(Array.from(t.Zv.data.subarray(0, 256)))
  })

  it('v_from_l_only (논문 기준): L은 바뀌지 않는다', () => {
    const t = run('LIBERO', { mode: 'v_from_l_only' })
    expect(maxAbsDiff(t.layers[5].L_out, t.Zl)).toBe(0)
    expect(maxAbsDiff(t.layers[5].V_out, t.Zv)).toBeGreaterThan(0.1)
  })

  it('l_from_v_only (논문 기준): V는 바뀌지 않는다', () => {
    const t = run('LIBERO', { mode: 'l_from_v_only' })
    expect(maxAbsDiff(t.layers[5].V_out, t.Zv)).toBe(0)
  })
})

describe('장면 의미 (설명용 설계의 목표)', () => {
  function columnMeans(t: ForwardTrace, word: string, head = 0): Record<string, number> {
    const A = t.layers[0].A_v_from_l[head]
    const j = t.tokens.text.findIndex((tok) => tok.name === word)
    const sums: Record<string, [number, number]> = {}
    t.tokens.visual.forEach((tok, i) => {
      const o = tok.object as string
      const [s, n] = sums[o] ?? [0, 0]
      sums[o] = [s + A.data[i * A.cols + j], n + 1]
    })
    return Object.fromEntries(Object.entries(sums).map(([k, [s, n]]) => [k, s / n]))
  }

  for (const basis of ['paper', 'code'] as Basis[]) {
    for (const preset of ['LIBERO', 'RoboTwin'] as const) {
      it(`${preset} ${basis}: "bowls"는 세 그릇, "blue"는 파란 그릇 patch에서 가장 진하다`, () => {
        const bowls = columnMeans(run(preset, { basis }), 'bowls')
        for (const bowl of ['pinkBowl', 'blueBowl', 'greenBowl']) {
          expect(bowls[bowl]).toBeGreaterThan(2 * bowls.table)
          expect(bowls[bowl]).toBeGreaterThan(2 * bowls.plate)
        }
        const blue = columnMeans(run(preset, { basis }, BLUE), 'blue')
        for (const other of ['pinkBowl', 'greenBowl', 'plate', 'table']) expect(blue.blueBowl).toBeGreaterThan(3 * blue[other])
      })
    }
  }

  it('스크립트의 목표 물체는 지시문의 색을 따른다', () => {
    for (const seed of [1, 7, 42]) {
      for (const preset of ['LIBERO', 'RoboTwin'] as const) {
        expect(run(preset, { seed }, BLUE).actionTarget).toBe('blueBowl')
        expect(run(preset, { seed }, 'Put the pink bowl on the green bowl').actionTarget).toBe('pinkBowl')
        expect(run(preset, { seed }, 'Pick up the green bowl').actionTarget).toBe('greenBowl')
      }
    }
  })
})

describe('action 값의 범위', () => {
  it('LIBERO: 팔 [−1, 1], gripper {−1, +1}이고 마지막 step에서 닫힌다', () => {
    const t = run('LIBERO')
    const a = t.actions
    for (let k = 0; k < a.rows; k++) {
      for (let j = 0; j < 6; j++) expect(Math.abs(a.data[k * 7 + j])).toBeLessThanOrEqual(1)
      expect([-1, 1]).toContain(a.data[k * 7 + 6])
    }
    expect(a.data[0 * 7 + 6]).toBe(-1)
    expect(a.data[(a.rows - 1) * 7 + 6]).toBe(1)
  })

  it('RoboTwin: 관절 [−1, 1], gripper {0, 1}', () => {
    const a = run('RoboTwin').actions
    for (let k = 0; k < a.rows; k++) {
      for (let j = 0; j < 12; j++) expect(Math.abs(a.data[k * 14 + j])).toBeLessThanOrEqual(1)
      expect([0, 1]).toContain(a.data[k * 14 + 12])
      expect([0, 1]).toContain(a.data[k * 14 + 13])
    }
  })

  it('decoder 출력은 tanh라서 (−1, 1)', () => {
    for (const v of run('RoboTwin').decoderOutput.data) expect(Math.abs(v)).toBeLessThan(1)
  })
})

describe('재현성', () => {
  for (const preset of ['LIBERO', 'RoboTwin'] as const) {
    for (const basis of ['paper', 'code'] as Basis[]) {
      it(`${preset} ${basis}: 처음부터 두 번 계산해도 모든 tensor가 비트 단위로 같다`, () => {
        const a = cold(preset, { basis }, BLUE)
        const b = cold(preset, { basis }, BLUE)
        expect(b.memory).not.toBe(a.memory) // 정말 다시 계산했는지 (memo가 끼어들면 이 테스트는 의미가 없다)
        const ta = tensorsOf(a)
        const tb = tensorsOf(b)
        expect(tb.length).toBe(ta.length)
        ta.forEach((x, i) => expect(bytes(x).equals(bytes(tb[i]))).toBe(true))
        expect(b.actionTarget).toBe(a.actionTarget)
      })
    }
  }

  it('seed가 다르면 값이 다르다', () => {
    expect(maxAbsDiff(cold('LIBERO', { seed: 1 }).memory, cold('LIBERO', { seed: 2 }).memory)).toBeGreaterThan(0.01)
  })

  it('H만 바꾸면 vision과 interaction 값은 그대로다 (난수 stream이 독립)', () => {
    const a = cold('LIBERO')
    const b = cold('LIBERO', { H: 8 })
    expect(b.Zv).not.toBe(a.Zv)
    expect(maxAbsDiff(a.Zv, b.Zv)).toBe(0)
    expect(maxAbsDiff(a.Zvl, b.Zvl)).toBe(0)
    expect(b.Qa.rows).toBe(8)
  })
})

describe('단계별 memo', () => {
  it('memo로 계산한 결과는 처음부터 계산한 결과와 같다', () => {
    const steps: Partial<Config>[] = [{}, { H: 8 }, { attnTemperature: 0.7 }, { mode: 'none' }, { basis: 'code' }, { H: 12, basis: 'paper' }]
    for (const step of steps) {
      const cached = run('LIBERO', step, BLUE)
      clearForwardCache()
      const fresh = run('LIBERO', step, BLUE)
      expect(maxAbsDiff(cached.memory, fresh.memory)).toBe(0)
      expect(maxAbsDiff(cached.decoderOutput, fresh.decoderOutput)).toBe(0)
      expect(maxAbsDiff(cached.actions, fresh.actions)).toBe(0)
    }
  })

  it('설정 하나나 입력 하나를 바꿀 때마다 memo 결과가 처음부터 계산한 결과와 같다 (memo key 점검)', { timeout: 60000 }, () => {
    // 프리셋에서 바꿀 수 있는 모든 설정. 고정값(타입이 상수)은 제외한다.
    const FIXED = ['preset', 'patchSize', 'd', 'interactionInnerDim', 'textFFNDim', 'decoderLayers', 'decoderHeads', 'decoderFFNDim', 'outputMLPHidden']
    const variants: Partial<Record<keyof Config, Partial<Config>>> = {
      profile: { profile: 'robotwin' },
      basis: { basis: 'code' },
      K: { K: 1 },
      imageSize: { imageSize: 224 },
      stateDim: { stateDim: 5 },
      actionDim: { actionDim: 9 },
      Ns: { Ns: 3 },
      N: { N: 3 },
      interactionHeads: { interactionHeads: 2 },
      H: { H: 7 },
      mode: { mode: 'l_from_v_only' },
      attnTemperature: { attnTemperature: 0.6 },
      seed: { seed: 11 },
    }
    const keys = Object.keys(PRESETS.LIBERO).filter((k) => !FIXED.includes(k))
    expect(keys.sort()).toEqual(Object.keys(variants).sort()) // 새 설정이 생기면 여기에 더해야 한다

    const compare = (changes: Partial<Config>, instruction = BLUE, state?: number[]) => {
      const config = presetConfig('LIBERO', changes)
      const inputs = { instruction, state: state ?? defaultState(config) }
      clearForwardCache()
      forward(presetConfig('LIBERO'), { instruction: BLUE, state: defaultState(presetConfig('LIBERO')) }) // memo를 기본값으로 채운다
      const cached = forward(config, inputs)
      clearForwardCache()
      const fresh = forward(config, inputs)
      const a = tensorsOf(cached)
      const b = tensorsOf(fresh)
      expect(a.length).toBe(b.length)
      a.forEach((x, i) => expect(maxAbsDiff(x, b[i])).toBe(0))
      expect(cached.caveats).toEqual(fresh.caveats)
      expect(cached.tokens.text.map((t) => t.name)).toEqual(fresh.tokens.text.map((t) => t.name))
    }
    for (const changes of Object.values(variants)) compare(changes as Partial<Config>)
    compare({}, STACK) // 지시문만 바꿈
    const state = defaultState(presetConfig('LIBERO'))
    for (let i = 0; i < state.length; i++) compare({}, BLUE, state.map((v, j) => (j === i ? v + 0.7 : v))) // state 칸 하나씩
  })

  it(`두 설정을 오가면 돌아갈 때 다시 계산하지 않는다 (단계마다 최근 ${MEMO_SIZE}개, LRU)`, () => {
    clearForwardCache()
    const a = run('LIBERO')
    const b = run('RoboTwin')
    const c = run('LIBERO', { basis: 'code' })
    // 돌아가면 같은 tensor를 그대로 쓴다
    expect(run('LIBERO').memory).toBe(a.memory)
    expect(run('RoboTwin').Zv).toBe(b.Zv)
    expect(run('LIBERO', { basis: 'code' }).memory).toBe(c.memory)
    // 기억하는 수를 넘으면 가장 오래 쓰지 않은 것부터 잊는다: LIBERO, RoboTwin, code를 쓴 뒤 새 설정 하나를 더하면 LIBERO(가장 오래됨)가 빠진다
    run('LIBERO', { seed: 99 })
    expect(run('LIBERO').memory).not.toBe(a.memory)
    // 다시 계산해도 값은 같다
    expect(maxAbsDiff(run('LIBERO').memory, a.memory)).toBe(0)
  })

  it('H만 바꾸면 encoder와 interaction 결과를 다시 쓴다', () => {
    const a = run('LIBERO', {}, BLUE)
    const b = run('LIBERO', { H: 10 }, BLUE)
    expect(b.Zv).toBe(a.Zv)
    expect(b.layers).toBe(a.layers)
    expect(b.Qa.rows).toBe(10)
  })
})

describe('technical caveats', () => {
  it('기준, 모드, 지시문, 프로필에 따라 해당 항목만 고른다', () => {
    const paper = run('LIBERO').caveats
    expect(paper).toContain('epos-values')
    expect(paper).toContain('real-robot-shapes')
    expect(paper).not.toContain('gamma-virtual')
    const code = run('RoboTwin', { basis: 'code' }, BLUE).caveats
    expect(code).toEqual(expect.arrayContaining(['gamma-virtual', 'subsentence-mask', 'robotwin-execution']))
    expect(code).not.toContain('real-robot-shapes')
    // "섞지 않음": interaction 층이 없으므로 residual, γ(LIBERO), 문장 mask 주의는 꺼진다. RoboTwin E_pos scale 때문에 γ 주의는 남는다
    const noneRobo = run('RoboTwin', { basis: 'code', mode: 'none' }, BLUE).caveats
    expect(noneRobo).toEqual(expect.arrayContaining(['gamma-virtual', 'interaction-modes']))
    expect(noneRobo).not.toContain('subsentence-mask')
    expect(run('LIBERO', { basis: 'code', mode: 'none' }).caveats).not.toContain('gamma-virtual')
    const nonePaper = run('LIBERO', { mode: 'none' }).caveats
    expect(nonePaper).not.toContain('residual-placement')
    expect(nonePaper).not.toContain('text-block-omitted')
    expect(nonePaper).toContain('epos-values')
    for (const id of [...paper, ...code]) expect(CAVEAT_IDS).toContain(id)
    expect(REAL_ROBOT_INSTRUCTION).toBe(STACK.toLowerCase())
  })
})

describe('계산 시간 (기록용)', () => {
  it('forward 한 번: 전체 재계산, H만 바꿨을 때', { timeout: 60000 }, () => {
    const times: Record<string, string> = {}
    for (const preset of ['LIBERO', 'RoboTwin'] as const) {
      for (const basis of ['paper', 'code'] as Basis[]) {
        run(preset, { basis }) // JIT 예열
        let full = 0
        let onlyH = 0
        const reps = 3
        for (let i = 0; i < reps; i++) {
          clearForwardCache()
          const t0 = performance.now()
          run(preset, { basis }, BLUE)
          const t1 = performance.now()
          run(preset, { basis, H: preset === 'LIBERO' ? 10 : 40 }, BLUE)
          full += t1 - t0
          onlyH += performance.now() - t1
        }
        times[`${preset} ${basis}`] = `full ${Math.round(full / reps)} ms, H only ${Math.round(onlyH / reps)} ms`
      }
    }
    console.info('forward ms', times)
    // 화면 갱신 100 ms에는 그리기도 들어가므로, 엔진은 넉넉한 상한만 검사한다 (CI 기계 차이 고려)
    for (const v of Object.values(times)) expect(Number(v.split(' ')[1])).toBeLessThan(400)
  })
})
