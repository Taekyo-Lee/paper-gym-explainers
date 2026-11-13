import { describe, expect, it } from 'vitest'
import { en } from './copy.en'
import { ko } from './copy.ko'
import { flattenKeys } from './i18n'
import { STAGES } from './stages'

describe('UI 문구', () => {
  it('한국어와 영어 문구의 key 집합이 같다', () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(ko).sort())
  })

  it('빈 문구가 없다', () => {
    for (const copy of [ko, en]) {
      const empty = flattenKeys(copy).filter((path) => {
        const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], copy)
        return typeof value !== 'string' || value.trim() === ''
      })
      expect(empty).toEqual([])
    }
  })

  it('모든 단계에 두 언어 문구가 있다', () => {
    for (const stage of STAGES) {
      expect(ko.stages[stage].title).toBeTruthy()
      expect(en.stages[stage].title).toBe(ko.stages[stage].title)
    }
  })

  it('가상 값 고지 문구가 기준(논문 / 공식 코드)마다 출처를 밝힌다', () => {
    for (const copy of [ko, en]) {
      expect(copy.disclaimer.textPaper).toContain('arXiv 2607.27205')
      expect(copy.disclaimer.textCode).toContain('650a288')
    }
  })
})

describe('기술적 주의 문구', () => {
  it('모든 caveat ID에 한국어와 영어 문구가 있다', async () => {
    const { CAVEATS } = await import('./caveats')
    const { CAVEAT_IDS } = await import('../engine/caveats')
    expect(Object.keys(CAVEATS).sort()).toEqual([...CAVEAT_IDS].sort())
    for (const id of CAVEAT_IDS) {
      for (const lang of ['ko', 'en'] as const) {
        expect(CAVEATS[id][lang].title.trim()).not.toBe('')
        expect(CAVEATS[id][lang].body.trim()).not.toBe('')
      }
    }
  })

  it('모든 caveat에 종류(가정, 단순화)가 있고, 조건은 설정에 따라 해당하는 caveat에만 있다', async () => {
    const { CAVEAT_KIND, CAVEAT_WHEN } = await import('./caveats')
    const { ALWAYS, CAVEAT_IDS } = await import('../engine/caveats')
    expect(Object.keys(CAVEAT_KIND).sort()).toEqual([...CAVEAT_IDS].sort())
    for (const id of CAVEAT_IDS) {
      const when = CAVEAT_WHEN[id]
      if (ALWAYS.includes(id)) expect(when).toBeUndefined()
      else {
        expect(when?.ko.trim()).toBeTruthy()
        expect(when?.en.trim()).toBeTruthy()
      }
    }
  })
})

describe('fmt: 영어 단수/복수', () => {
  it('{n|하나|여럿}: 값이 1이면 앞의 꼴, 아니면 뒤의 꼴. #은 값', async () => {
    const { fmt } = await import('./i18n')
    expect(fmt('into {n|# token|# tokens}.', { n: 1 })).toBe('into 1 token.')
    expect(fmt('into {n|# token|# tokens}.', { n: 2 })).toBe('into 2 tokens.')
    expect(fmt('{n|# token|# tokens}', { n: 0 })).toBe('0 tokens')
    expect(fmt('{H}-step, {H|one step|# steps}', { H: '1' })).toBe('1-step, one step')
    expect(fmt('{missing|a|b}', {})).toBe('{missing|a|b}')
  })

  it('영어 문구의 {이름|…|…}은 모두 두 꼴이 있고, 같은 key의 한국어 문구에도 그 이름이 있다', async () => {
    const { en } = await import('./copy.en')
    const { ko } = await import('./copy.ko')
    const { flattenKeys } = await import('./i18n')
    const get = (o: unknown, path: string) => path.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)[k], o) as string
    for (const path of flattenKeys(en)) {
      const text = get(en, path)
      for (const m of text.matchAll(/\{(\w+)\|([^}]*)\}/g)) {
        expect(m[2].split('|'), `${path}: ${m[0]}`).toHaveLength(2)
        expect(get(ko, path), `${path}: 한국어에 {${m[1]}}`).toContain(`{${m[1]}`)
      }
    }
  })
})

describe('fmt', () => {
  it('{name} 자리를 값으로 바꾸고, 없는 이름은 그대로 둔다', async () => {
    const { fmt } = await import('./i18n')
    expect(fmt('{view} 화면의 ({gx}, {gy}) patch', { view: 'primary', gx: 3, gy: 7 })).toBe('primary 화면의 (3, 7) patch')
    expect(fmt('{a} {missing}', { a: 1 })).toBe('1 {missing}')
  })
})

describe('joinList', () => {
  it('한국어는 받침에 따라 와/과, 영어는 and', async () => {
    const { joinList } = await import('./i18n')
    expect(joinList(['물체', '색'], 'ko')).toBe('물체와 색')
    expect(joinList(['동작', '관계'], 'ko')).toBe('동작과 관계')
    expect(joinList(['위치', '동작', '관계'], 'ko')).toBe('위치, 동작과 관계')
    expect(joinList(['물체'], 'ko')).toBe('물체')
    expect(joinList(['action horizon', 'state 토큰 수'], 'ko')).toBe('action horizon과 state 토큰 수')
    expect(joinList(['층 수', 'seed'], 'ko')).toBe('층 수와 seed')
    expect(joinList(['seed', 'attention 온도'], 'ko')).toBe('seed와 attention 온도')
    expect(joinList(['object', 'color'], 'en')).toBe('object and color')
    expect(joinList(['a', 'b', 'c'], 'en')).toBe('a, b, and c')
  })
})

describe('num', () => {
  it('음수는 U+2212, 반올림해서 0인 음수는 0.00', async () => {
    const { num } = await import('./i18n')
    expect(num(-0.001)).toBe('0.00')
    expect(num(-0.25)).toBe('−0.25')
    expect(num(0.5, 1)).toBe('0.5')
    expect(num(0)).toBe('0.00')
  })
})
