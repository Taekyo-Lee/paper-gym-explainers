import { describe, expect, it } from 'vitest'
import { robustLimit, selectKth, valueColor } from './color'

describe('color', () => {
  it('robustLimit은 모든 값의 절댓값 99 백분위수다 (열 간격과 맞물리지 않는다)', () => {
    // 512 × 256: 32의 배수 열만 작고 나머지 열은 큰 행렬. 간격 32로 뽑으면 작은 열만 본다.
    const rows = 512
    const cols = 256
    const data = new Float32Array(rows * cols)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) data[r * cols + c] = (c % 32 === 0 ? 0.1 : 2) * (((r + c) % 7) / 7 + 0.5)
    const sorted = Array.from(data, Math.abs).sort((a, b) => a - b)
    const exact = sorted[Math.floor(sorted.length * 0.99)]
    expect(robustLimit(data)).toBeCloseTo(exact, 5)
    expect(robustLimit(data)).toBeGreaterThan(1)
  })

  it('selectKth는 정렬한 배열의 k번째 값과 같다 (무작위, 같은 값이 많은 배열, 정렬된 배열)', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const cases = [
      Float32Array.from({ length: 1001 }, () => rand() * 10 - 5),
      Float32Array.from({ length: 777 }, () => Math.floor(rand() * 4)),
      Float32Array.from({ length: 500 }, (_, i) => i),
      Float32Array.from({ length: 500 }, (_, i) => 500 - i),
      Float32Array.from([3]),
    ]
    for (const data of cases) {
      const sorted = Float32Array.from(data).sort()
      for (const k of [0, 1, data.length >> 1, Math.floor(data.length * 0.99), data.length - 1]) {
        if (k >= data.length) continue
        expect(selectKth(Float32Array.from(data), k)).toBe(sorted[k])
      }
    }
  })

  it('robustLimit: 빈 배열과 0뿐인 배열은 1', () => {
    expect(robustLimit(new Float32Array(0))).toBe(1)
    expect(robustLimit(new Float32Array(10))).toBe(1)
  })

  it('valueColor: 0은 zero 색, 끝값 이상은 끝 색', () => {
    const scale = { neg: [0, 0, 255] as [number, number, number], zero: [255, 255, 255] as [number, number, number], pos: [0, 0, 0] as [number, number, number], limit: 2 }
    expect(valueColor(0, scale)).toEqual([255, 255, 255])
    expect(valueColor(5, scale)).toEqual([0, 0, 0])
    expect(valueColor(-2, scale)).toEqual([0, 0, 255])
  })
})
