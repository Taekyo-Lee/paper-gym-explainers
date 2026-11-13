// 값 → 색. canvas는 CSS 변수를 직접 못 쓰므로 그릴 때 토큰 값을 읽어 RGB로 바꾼다.

export type RGB = [number, number, number]

function parseColor(value: string): RGB {
  const v = value.trim()
  if (v.startsWith('#')) {
    const hex = v.length === 4 ? v.slice(1).split('').map((c) => c + c).join('') : v.slice(1, 7)
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  }
  const m = v.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(/[\s,/]+/).map(Number)
    return [r, g, b]
  }
  return [128, 128, 128]
}

/** 지금 테마의 CSS 토큰을 RGB로 읽는다. 테마가 바뀌면 다시 불러야 한다. */
export function readToken(name: string): RGB {
  return parseColor(getComputedStyle(document.documentElement).getPropertyValue(name))
}

export interface ValueScale {
  neg: RGB
  zero: RGB
  pos: RGB
  /** 이 절댓값에서 끝 색이 된다 */
  limit: number
}

/** 색 스케일의 종류. value = 부호 있는 값(diverging), 나머지는 0 이상인 attention용 단색 스케일 */
export type ScaleKind = 'value' | 'vision' | 'language' | 'state' | 'action'

const POS_TOKEN: Record<ScaleKind, string> = {
  value: '--viz-pos',
  vision: '--vision',
  language: '--language',
  state: '--state',
  action: '--accent',
}

/**
 * value: --viz-neg ↔ --viz-zero ↔ --viz-pos (부호 있는 값)
 * 그 밖: --viz-zero → 모달리티 색. attention은 그 방향의 Query 쪽 모달리티 색을 쓴다
 */
export function valueScale(limit: number, kind: ScaleKind = 'value'): ValueScale {
  return { neg: readToken('--viz-neg'), zero: readToken('--viz-zero'), pos: readToken(POS_TOKEN[kind]), limit: limit || 1 }
}

const limitCache = new WeakMap<Float32Array, number>()

/**
 * 절댓값의 99 백분위수 (큰 값 몇 개가 전체 색을 흐리게 하지 않도록).
 * 표본을 뽑지 않고 모든 값을 본다. 일정한 간격으로 뽑으면 간격이 행 길이(256)와 맞물려 특정 열만 보게 된다.
 * 전부 정렬하지 않고 quickselect로 k번째 값만 찾는다(정렬한 값과 같다, color.test.ts). 측정해 보니 정렬이
 * 파라미터 변경 한 번에 30 ms 넘게 걸려서 바꿨다.
 * 같은 배열은 한 번만 계산한다(엔진이 단계별로 memo하므로 테마나 선택만 바뀌면 다시 계산하지 않는다).
 */
export function robustLimit(data: Float32Array): number {
  if (!data.length) return 1
  const cached = limitCache.get(data)
  if (cached !== undefined) return cached
  const abs = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) abs[i] = Math.abs(data[i])
  const value = selectKth(abs, Math.min(abs.length - 1, Math.floor(abs.length * 0.99))) || 1
  limitCache.set(data, value)
  return value
}

/** a를 부분적으로 재배열해 오름차순 k번째(0부터) 값을 돌려준다 (Hoare quickselect, 가운데 세 값의 중앙값을 pivot으로) */
export function selectKth(a: Float32Array, k: number): number {
  let lo = 0
  let hi = a.length - 1
  while (hi > lo) {
    const mid = (lo + hi) >> 1
    // 세 값의 중앙값을 pivot으로 (정렬된 입력에서도 느려지지 않게)
    let x = a[lo]
    let y = a[mid]
    let z = a[hi]
    if (x > y) [x, y] = [y, x]
    if (y > z) [y, z] = [z, y]
    if (x > y) [x, y] = [y, x]
    const pivot = y
    let i = lo
    let j = hi
    while (i <= j) {
      while (a[i] < pivot) i++
      while (a[j] > pivot) j--
      if (i <= j) {
        const t = a[i]
        a[i] = a[j]
        a[j] = t
        i++
        j--
      }
    }
    if (k <= j) hi = j
    else if (k >= i) lo = i
    else return a[k]
  }
  return a[k]
}

export function valueColor(v: number, s: ValueScale, out: RGB = [0, 0, 0]): RGB {
  const t = Math.max(-1, Math.min(1, v / s.limit))
  const to = t >= 0 ? s.pos : s.neg
  const a = Math.abs(t)
  out[0] = s.zero[0] + (to[0] - s.zero[0]) * a
  out[1] = s.zero[1] + (to[1] - s.zero[1]) * a
  out[2] = s.zero[2] + (to[2] - s.zero[2]) * a
  return out
}

export function rgbString([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
}
