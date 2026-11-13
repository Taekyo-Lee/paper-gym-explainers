// light와 dark 테마가 같은 색 토큰을 모두 정의하고, 작은 글씨 색이 WCAG AA(4.5:1)를 넘는지 확인한다.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`missing ${selector}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2].toLowerCase()]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const themes = {
  light: block(":root[data-theme='light']"),
  dark: block(":root[data-theme='dark']"),
}

/** 작은 글씨에 쓰는 색들 */
const TEXT = ['--ink', '--muted', '--vision-ink', '--language-ink', '--state-ink', '--accent-ink', '--red-pen-ink']
const SURFACES = ['--bg', '--card', '--sunken']

describe('테마 토큰', () => {
  it('두 테마가 같은 색 토큰을 정의한다', () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort())
  })

  for (const [name, t] of Object.entries(themes)) {
    it(`${name}: 작은 글씨 색이 모든 면 위에서 4.5:1 이상이다`, () => {
      for (const fg of TEXT) {
        for (const bg of SURFACES) {
          expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    })

    it(`${name}: 칩 글자와 진한 pill 글자가 4.5:1 이상이다`, () => {
      expect(contrast(t['--on-accent-solid'], t['--accent-solid'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t['--bg'], t['--ink'])).toBeGreaterThanOrEqual(4.5)
    })
  }
})
