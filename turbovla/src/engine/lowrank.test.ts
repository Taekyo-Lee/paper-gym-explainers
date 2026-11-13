import { describe, expect, it } from 'vitest'
import { applyLinear, applyWriter, denseWeight, lowRankMLP, makeWriter, randomLowRank, writeInto } from './lowrank'
import { CONCEPT_SLOTS, D } from './concepts'
import { rng } from './prng'
import { addRowVector, addScaled, matmul, maxAbsDiff, relu, tensor } from './tensor'

describe('빠른 경로 = 기본 계산', () => {
  it('lowRankMLP = applyLinear → ReLU → applyLinear', () => {
    const r = rng(3, 'mlp')
    const w1 = randomLowRank(r, 'f1', 256, 2048, 8, 1, 0.05)
    const w2 = randomLowRank(r, 'f2', 2048, 256, 8, 0.5, 0.05)
    const x = tensor(7, 256, '', r.normalArray(7 * 256))
    expect(maxAbsDiff(lowRankMLP(x, w1, w2), applyLinear(relu(applyLinear(x, w1)), w2))).toBeLessThan(1e-4)
    // 실제 모양의 dense 가중치 (256 × 2,048, 2,048 × 256)로 한 계산과도 같다
    const W1 = denseWeight(w1)
    const W2 = denseWeight(w2)
    expect([W1.rows, W1.cols, W2.rows, W2.cols]).toEqual([256, 2048, 2048, 256])
    const dense = addRowVector(matmul(relu(addRowVector(matmul(x, W1), w1.bias as Float32Array)), W2), w2.bias as Float32Array)
    expect(maxAbsDiff(lowRankMLP(x, w1, w2), dense)).toBeLessThan(1e-3)
  })

  it('writeInto(base, x, W, s) = base + s · (x · W)', () => {
    const r = rng(4, 'w')
    const w = makeWriter(r, 1.3)
    const x = tensor(5, CONCEPT_SLOTS, '', r.normalArray(5 * CONCEPT_SLOTS))
    const base = tensor(5, D, '', r.normalArray(5 * D))
    expect(maxAbsDiff(writeInto(base, x, w, 0.5), addScaled(base, applyWriter(x, w), 0.5))).toBeLessThan(1e-5)
  })
})
