// 기호 풀이 점검: 모든 식의 모든 기호에 풀이가 있는가, 풀이 자체는 빠진 데가 없는가.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { forward } from '../engine/forward'
import { defaultState, presetConfig } from '../engine/presets'
import { codeEquation, DIALOG_TEX, STAGE_EQUATIONS } from './equations'
import { GLOSSARY, glossKeys, glossNote, glossShape, isGlossKey, KIND_LABEL, type GlossEntry } from './glossary'
import type { Basis } from '../engine/types'
import { STAGES } from './stages'

/** 화면에 나오는 모든 식: 단계별 논문 식, 두 프리셋의 공식 코드 식, 창 안의 식 */
function allTex(): { name: string; tex: string }[] {
  const out: { name: string; tex: string }[] = []
  for (const stage of STAGES) {
    for (const eq of STAGE_EQUATIONS[stage]) {
      out.push({ name: eq.id, tex: eq.tex })
      for (const profile of ['libero', 'robotwin'] as const) {
        const code = codeEquation(eq.id, profile)
        if (code) out.push({ name: `${eq.id} (${profile} code)`, tex: code.tex })
      }
    }
  }
  for (const [name, tex] of Object.entries(DIALOG_TEX)) out.push({ name, tex })
  return out
}

type Node = Record<string, unknown>

/** 풀이 없이 써도 되는 표준 표기: 숫자, 괄호, 연산자, 합, 무한대, 점 */
const FREE_TEXTORD = /^(\d+|\\infty|\\ldots|\\dots|\\cdots|[,.;:!?'()[\]|/+\-−=<>*]|\\prime)$/

/**
 * KaTeX 구문 트리를 돌면서 풀이(gl) 밖에 있는 기호를 모은다.
 * 글자(mathord), 글자로 된 textord(\ell 등), \text{…}, \mathrm/\mathbb(font), \operatorname은 모두 풀이 안에 있어야 한다.
 */
function unexplained(tex: string): string[] {
  // KaTeX의 구문 분석기 (공개 API는 아니지만 katex 패키지가 내보낸다)
  const parse = (katex as unknown as { __parse: (tex: string, options: object) => unknown }).__parse
  const tree = parse(tex, { trust: true, strict: false })
  const found: string[] = []
  const visit = (node: unknown, inGl: boolean) => {
    if (Array.isArray(node)) {
      for (const n of node) visit(n, inGl)
      return
    }
    if (!node || typeof node !== 'object') return
    const n = node as Node
    let gl = inGl
    if (n.type === 'html') {
      const cls = String((n.attributes as Record<string, string> | undefined)?.class ?? '')
      if (/\bgl-\w+/.test(cls)) gl = true
    }
    if (!gl) {
      if (n.type === 'mathord') found.push(String(n.text))
      else if (n.type === 'textord' && !FREE_TEXTORD.test(String(n.text))) found.push(String(n.text))
      else if (n.type === 'text' || n.type === 'font' || n.type === 'operatorname') found.push(`<${String(n.type)}>`)
      // 위 셋은 안쪽까지 한 번만 센다
      if (n.type === 'text' || n.type === 'font' || n.type === 'operatorname') return
    }
    for (const [key, value] of Object.entries(n)) if (key !== 'loc') visit(value, gl)
  }
  visit(tree, false)
  return found
}

describe('기호 풀이', () => {
  it('모든 식의 모든 기호가 풀이(gl)로 감싸여 있다 (빠진 기호가 없다)', () => {
    for (const { name, tex } of allTex()) expect(unexplained(tex), name).toEqual([])
  })

  it('점검 함수가 빠진 기호를 실제로 찾는다 (점검이 헛돌지 않는지)', () => {
    expect(unexplained(String.raw`x + \htmlClass{gl gl-x}{x}`)).toEqual(['x'])
    expect(unexplained(String.raw`\operatorname{softmax}(a)`)).toEqual(['<operatorname>', 'a'])
    expect(unexplained(String.raw`\sum_{i=1}^{5} \ell`)).toEqual(['i', '\\ell'])
  })

  it('식 안의 풀이 key는 모두 GLOSSARY에 있다 (오타가 없다)', () => {
    for (const { name, tex } of allTex()) {
      for (const m of tex.matchAll(/\bgl-([A-Za-z0-9_]+)/g)) expect(isGlossKey(m[1]), `${name}: ${m[1]}`).toBe(true)
      expect(glossKeys(tex).length, name).toBeGreaterThan(0)
    }
  })

  it('풀이마다 종류, 한국어와 영어 이름과 뜻이 있다', () => {
    for (const [key, raw] of Object.entries(GLOSSARY)) {
      const e: GlossEntry = raw
      expect(Object.keys(KIND_LABEL), key).toContain(e.kind)
      for (const lang of ['ko', 'en'] as const) {
        expect(e[lang].name.trim(), `${key} ${lang} name`).not.toBe('')
        expect(e[lang].meaning.trim(), `${key} ${lang} meaning`).not.toBe('')
        // 글 안에 TeX 날표기(^, _ , \)를 쓰지 않는다 (풀지 않은 기호를 쓰지 않는다)
        expect(e[lang].meaning, `${key} ${lang}`).not.toMatch(/[\\^]|_[{a-z]/)
      }
      expect(() => katex.renderToString(e.tex, { throwOnError: true }), key).not.toThrow()
    }
  })

  /** 두 프리셋 × 두 기준의 forward */
  const traces = (['LIBERO', 'RoboTwin'] as const).flatMap((preset) =>
    (['paper', 'code'] as Basis[]).map((basis) => {
      const config = presetConfig(preset, { basis })
      return { name: `${preset} ${basis}`, trace: forward(config, { instruction: 'Stack the three bowls', state: defaultState(config) }) }
    }),
  )

  it('모양은 두 프리셋과 두 기준에서 [a × b] 꼴로 계산되고, 주의 문장은 비지 않는다', () => {
    for (const { name, trace } of traces) {
      for (const [key, raw] of Object.entries(GLOSSARY)) {
        const e: GlossEntry = raw
        const shape = glossShape(e, trace)
        if (shape !== null) expect(shape, `${key} (${name})`).toMatch(/^\[\d+( × \d+)+\]$/)
        for (const lang of ['ko', 'en'] as const) {
          const note = glossNote(e, trace, lang)
          if (e.note) expect(note?.trim(), `${key} ${lang} note (${name})`).toBeTruthy()
          if (note) expect(note, `${key} ${lang} note`).not.toMatch(/[\\^]|_[{a-z]/)
        }
      }
    }
  })

  it('E_pos의 모양과 주의 문장은 기준을 따른다 (공식 코드 LIBERO에는 이 항이 없다)', () => {
    const get = (name: string) => traces.find((x) => x.name === name)!.trace
    expect(glossShape(GLOSSARY.Epos, get('LIBERO code'))).toBeNull()
    expect(glossShape(GLOSSARY.Epos, get('LIBERO paper'))).toBe('[256 × 256]')
    expect(glossNote(GLOSSARY.Epos, get('LIBERO paper'), 'en')).toContain('sinusoid')
    expect(glossNote(GLOSSARY.Epos, get('RoboTwin code'), 'en')).not.toContain('sinusoid')
    expect(glossNote(GLOSSARY.Epos, get('RoboTwin code'), 'en')).toContain('0.5')
  })

  it('합쳐진 기호의 안쪽 기호도 풀이가 있다: decoder memory 안의 Z^vl, Z^s', () => {
    const eq9 = STAGE_EQUATIONS.decoder.find((e) => e.id === 'eq9')!.tex
    expect(glossKeys(eq9)).toEqual(expect.arrayContaining(['memory', 'Zvl', 'Zs']))
  })

  it('모든 풀이가 어딘가에 쓰인다 (식 또는 단계 패널)', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (name.endsWith('.svelte')) files.push(readFileSync(path, 'utf-8'))
      }
    }
    walk(join(__dirname, '../components'))
    const source = files.join('\n')
    const used = new Set<string>(allTex().flatMap(({ tex }) => glossKeys(tex)))
    for (const eq of STAGES.flatMap((s) => STAGE_EQUATIONS[s])) for (const k of eq.extra ?? []) used.add(k)
    for (const m of source.matchAll(/\bk="(\w+)"|\bg\('(\w+)'|symbol: '(\w+)'|sym: \(?(?:none \? )?'(\w+)'(?: : '(\w+)')?/g)) {
      for (const k of m.slice(1)) if (k) used.add(k)
    }
    for (const key of Object.keys(GLOSSARY)) expect(used, key).toContain(key)
  })

  it('단계 패널은 TeX 기호를 날것으로 쓰지 않는다 (Sym 또는 g()로 감싼다)', () => {
    const dir = join(__dirname, '../components')
    const offenders: string[] = []
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const path = join(d, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (name.endsWith('.svelte')) {
          const src = readFileSync(path, 'utf-8')
          // tex="…" 글자 그대로, 또는 g( 없이 String.raw로 바로 넘긴 식
          for (const m of src.matchAll(/<Tex[^>]*\btex=("[^"]*"|\{String\.raw`[^`]*`\})/g)) {
            if (!m[1].includes('g(')) offenders.push(`${name}: ${m[0]}`)
          }
        }
      }
    }
    walk(dir)
    expect(offenders).toEqual([])
  })
})
