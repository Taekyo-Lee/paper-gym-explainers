import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { codeEquation, DIALOG_TEX, STAGE_EQUATIONS, SYMBOLS, symbolHome } from './equations'
import { STAGES } from './stages'

const render = (tex: string) =>
  katex.renderToString(tex, {
    throwOnError: true,
    trust: (ctx) => ctx.command === '\\htmlId' || ctx.command === '\\htmlClass',
    strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'warn'),
  })

const allTex = () => {
  const out: string[] = []
  for (const stage of STAGES) {
    for (const eq of STAGE_EQUATIONS[stage]) {
      out.push(eq.tex)
      for (const profile of ['libero', 'robotwin'] as const) {
        const code = codeEquation(eq.id, profile)
        if (code) out.push(code.tex)
      }
    }
  }
  return out
}

describe('수식 패널', () => {
  it('모든 식(논문, 공식 코드)이 KaTeX로 오류 없이 그려진다', () => {
    for (const tex of [...allTex(), ...Object.values(DIALOG_TEX)]) expect(() => render(tex)).not.toThrow()
  })

  it('기호 하이라이트 id는 모두 SYMBOLS에 있고, SYMBOLS의 id는 모두 어느 식에선가 쓰인다', () => {
    const used = new Set<string>()
    for (const tex of allTex()) for (const m of tex.matchAll(/\\htmlClass\{hl hl-(\w+) gl gl-\w+\}/g)) used.add(m[1])
    for (const id of used) expect(Object.keys(SYMBOLS)).toContain(id)
    for (const id of Object.keys(SYMBOLS)) expect(used).toContain(id)
  })

  it('공식 코드 식은 계산이 다른 식에만 있다: Eq. 3(LIBERO), Eq. 4, Eq. 7', () => {
    const ids = new Set(STAGES.flatMap((s) => STAGE_EQUATIONS[s].map((e) => e.id)))
    for (const id of ids) {
      const libero = codeEquation(id, 'libero') !== null
      const robotwin = codeEquation(id, 'robotwin') !== null
      expect(libero).toBe(['eq3', 'eq4', 'eq7'].includes(id))
      expect(robotwin).toBe(['eq4', 'eq7'].includes(id))
    }
    // 다른 부분은 빨간 펜(diff)으로 표시한다
    for (const id of ['eq3', 'eq4', 'eq7']) expect(codeEquation(id, 'libero')!.tex).toContain('\\htmlClass{diff}')
  })

  it('Eq. 7에 V, L, Attn 기호가 하이라이트 id로 들어 있다', () => {
    const eq7 = STAGE_EQUATIONS.interaction.find((e) => e.id === 'eq7')!.tex
    for (const id of ['Vprev', 'Vnext', 'Lprev', 'Lnext', 'AttnVL', 'AttnLV']) expect(eq7).toContain(`hl-${id} `)
  })
})

describe('기호 ↔ 그림 반대 방향: 모든 기호 id에 그림이 붙어 있다', () => {
  it('components 안에서 hl(…) 또는 hl: […]로 모든 SYMBOLS id를 쓴다', () => {
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
    const attached = new Set<string>()
    for (const m of source.matchAll(/hl\(([^)]*)\)|hl: \[([^\]]*)\]/g)) {
      for (const id of (m[1] ?? m[2] ?? '').matchAll(/'(\w+)'/g)) attached.add(id[1])
    }
    for (const id of Object.keys(SYMBOLS)) expect(attached, id).toContain(id)
  })
})

describe('기호의 그림 위치 (기준에 따라)', () => {
  it('공식 코드 기준에서 L^ℓ_t는 텍스트 블록 탭에 있다 (residual 탭의 마지막 줄은 L′)', () => {
    expect(symbolHome('Lnext', 'paper')).toEqual({ stage: 'interaction', interTab: 'residual' })
    expect(symbolHome('Lnext', 'code')).toEqual({ stage: 'interaction', interTab: 'text' })
    expect(symbolHome('Lmid', 'code')).toEqual({ stage: 'interaction', interTab: 'residual' })
  })

  it('Q_a의 정의는 Eq. 9 카드가 아니라 따로 (번호 없는 본문 식)', () => {
    const decoder = STAGE_EQUATIONS.decoder
    expect(decoder.find((e) => e.id === 'eq9')!.tex).not.toContain('q_1')
    expect(decoder.find((e) => e.id === 'qa')!.source.kind).toBe('paperText')
  })
})

describe('기호 표 단추의 이름', () => {
  it('번호 없는 식은 모두 KO/EN 이름이 있다 (같은 단계의 두 단추가 같은 이름이 되지 않게)', async () => {
    const { ko } = await import('./copy.ko')
    const { en } = await import('./copy.en')
    for (const stage of STAGES) {
      const names = STAGE_EQUATIONS[stage].map((eq) =>
        eq.source.kind === 'paperEq' ? `Eq. ${eq.source.number}` : (ko.equations.cardNames as Record<string, string>)[eq.id],
      )
      for (const name of names) expect(name, stage).toBeTruthy()
      expect(new Set(names).size, stage).toBe(names.length)
      for (const eq of STAGE_EQUATIONS[stage]) {
        if (eq.source.kind !== 'paperEq') expect((en.equations.cardNames as Record<string, string>)[eq.id], eq.id).toBeTruthy()
      }
    }
  })
})
