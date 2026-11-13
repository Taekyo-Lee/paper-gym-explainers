import { en } from './copy.en'
import { ko, type Copy } from './copy.ko'

export type Lang = 'ko' | 'en'

export const LANGS: readonly Lang[] = ['ko', 'en']

const COPIES: Record<Lang, Copy> = { ko, en }

export function copyFor(lang: Lang): Copy {
  return COPIES[lang]
}

/** 중첩된 문구 객체의 key 경로를 모두 뽑는다 (두 언어의 key 비교 테스트용). */
export function flattenKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object' ? flattenKeys(value, path) : [path]
  })
}

/**
 * 문구 안의 {name}을 값으로 바꾼다.
 * 영어 단수/복수: {name|하나일 때|여럿일 때}. 값이 1이면 앞의 꼴을 쓰고, 꼴 안의 #은 값으로 바꾼다.
 * 예: fmt('{n|# token|# tokens}', { n: 1 }) → '1 token'. 한국어 문구는 그냥 {name}을 쓴다.
 */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g, (match, key: string, one?: string, many?: string) => {
    if (!(key in values)) return match
    const value = values[key]
    if (one === undefined || many === undefined) return String(value)
    return (Number(value) === 1 ? one : many).replace(/#/g, String(value))
  })
}

/**
 * 한국어로 읽을 때 받침으로 끝나는 영어 낱말 (와/과 고르기). 화면 문구에 나오는 낱말만 둔다.
 * 예: horizon(호라이즌), token(토큰), attention(어텐션). 이 밖의 영어 낱말은 받침이 없는 것으로 본다(seed → 시드, head → 헤드).
 */
const LATIN_WITH_FINAL = new Set(['horizon', 'token', 'tokens', 'action', 'attention', 'interaction', 'vision', 'step'])

/** 마지막 글자(영어면 마지막 낱말)에 받침이 있는가 (와/과 고르기) */
function hasFinalConsonant(word: string): boolean {
  const w = word.trim()
  const latin = /([A-Za-z]+)$/.exec(w)
  if (latin) return LATIN_WITH_FINAL.has(latin[1].toLowerCase())
  const code = w.charCodeAt(w.length - 1)
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
}

/** 낱말 목록을 문장 속 나열로: ko "물체와 색", "위치, 동작과 관계" / en "object and color", "a, b, and c" */
export function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items[0] ?? ''
  const head = items.slice(0, -1)
  const last = items[items.length - 1]
  if (lang === 'ko') {
    const before = head[head.length - 1]
    return `${head.join(', ')}${hasFinalConsonant(before) ? '과' : '와'} ${last}`
  }
  return items.length === 2 ? `${head[0]} and ${last}` : `${head.join(', ')}, and ${last}`
}

/** 숫자를 화면용으로: 음수는 '−'(U+2212)로 쓰고, 반올림해서 0이 되는 음수는 '0.00'으로 (−0.00이라고 읽히지 않게) */
export function num(value: number, digits = 2): string {
  const s = value.toFixed(digits)
  const n = Number(s)
  if (n === 0) return (0).toFixed(digits)
  return n < 0 ? `−${s.slice(1)}` : s
}
