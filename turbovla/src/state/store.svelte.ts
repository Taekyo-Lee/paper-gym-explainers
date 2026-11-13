// 전역 UI 상태. Svelte 5 runes를 쓰는 store 하나.
// Config와 입력이 바뀌면 trace(forward 결과)를 다시 계산한다. UI의 선택(단계, 층, head 등)은 다시 계산하지 않는다.
import { DEFAULT_INSTRUCTION } from '../content/instructions'
import type { Lang } from '../content/i18n'
import { STAGES, type StageId } from '../content/stages'
import { firstObjectPhrase } from '../engine/actions'
import { forward } from '../engine/forward'
import { paperLookup } from '../engine/paperNumbers'
import { defaultState, presetConfig, withChanges } from '../engine/presets'
import type { CaveatId } from '../engine/caveats'
import type { Basis, Config, ForwardTrace, InteractionMode } from '../engine/types'

export type { Basis } from '../engine/types'
export type PresetName = Config['preset']

/**
 * 수식 기호 ↔ 시각 요소 하이라이트. 기호와 그림이 같은 id를 쓴다 (content/equations.ts의 SYMBOLS).
 * 그림 하나가 기호 여러 개에 해당할 수 있어서(예: memory의 이미지 구간 = V^N = Z^{vl}의 앞부분) id를 목록으로 둔다.
 */
export interface HoverTarget {
  /** symbol: 수식 기호 위에 마우스, tensor: 그림 위에 마우스 */
  kind: 'symbol' | 'tensor'
  ids: string[]
}

export type Theme = 'light' | 'dark'

// index.html의 inline script도 같은 key를 읽는다.
const LANG_KEY = 'paper-gym.turbovla.lang'
const THEME_KEY = 'paper-gym.turbovla.theme'

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ko'
  } catch {
    return 'ko'
  }
}

/** 사용자가 직접 고른 테마. 고른 적이 없으면 null이고 시스템 설정을 따른다. */
function readThemePref(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/**
 * <html data-theme>을 바로 바꾼다. canvas는 그릴 때 CSS 토큰을 읽으므로, canvas의 $effect보다 먼저 바뀌어 있어야 한다.
 * (App의 $effect에서 바꾸면 자식 canvas의 $effect가 먼저 돌아 이전 테마 색으로 그린다.)
 */
function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

/** 하단 바에서 여는 창 */
export type DialogId = 'compare2017' | 'lossToy' | 'caveats' | 'benchmarks'

class UiStore {
  stage = $state<StageId>('inputs')
  lang = $state<Lang>(readLang())
  paramsOpen = $state(true)
  /** 열려 있는 창 (한 번에 하나) */
  dialog = $state<DialogId | null>(null)
  /** 기술적 주의 창을 열 때 보여 줄 항목 (그림 옆 주의 표시를 눌렀을 때) */
  caveatFocus = $state<CaveatId | null>(null)
  /**
   * forward에 넘기는 설정. 깊은 proxy를 만들지 않도록 $state.raw로 두고, 바꿀 때는 객체를 통째로 바꾼다
   * (엔진의 안쪽 루프가 proxy를 거치면 느려진다). 기준(basis)은 기억하지 않는다: 새로 열면 항상 논문 기준.
   */
  config = $state.raw<Config>(presetConfig('LIBERO'))
  instruction = $state(DEFAULT_INSTRUCTION)
  robotState = $state.raw<number[]>(defaultState(presetConfig('LIBERO')))

  /** forward 결과. config, instruction, robotState가 바뀔 때만 다시 계산한다. */
  trace: ForwardTrace = $derived(forward(this.config, { instruction: this.instruction, state: this.robotState }))

  /** 논문 근거 배지: 지금 설정이 논문 실험과 맞으면 그 숫자 */
  paper = $derived(paperLookup(this.config))

  /** Encoders 단계의 하위 탭 */
  encoderTab = $state<'vision' | 'text' | 'state'>('vision')
  /** 사용자가 고른 visual token 번호. null이면 자동으로 고른다 */
  patchPick = $state<number | null>(null)
  /**
   * 사용자가 고른 지시문 토큰. 어떤 지시문에서 고른 것인지 함께 기억해서,
   * 지시문이 바뀌면(프리셋 버튼이든 위쪽 입력칸의 bind:value든) 다른 단어를 가리키지 않게 한다.
   */
  wordPick = $state<{ index: number; instruction: string } | null>(null)

  /** 고른 visual token. 자동: 첫 view에서 스크립트 목표 물체가 가장 넓게 보이는 patch */
  selectedPatch: number = $derived.by(() => {
    const visual = this.trace.tokens.visual
    if (this.patchPick !== null && this.patchPick < visual.length) return this.patchPick
    const target = this.trace.actionTarget
    let best = 0
    let bestCov = -1
    for (const t of visual) {
      if (t.view !== 0) break
      const cov = t.coverage?.[target] ?? 0
      if (cov > bestCov) {
        best = t.index
        bestCov = cov
      }
    }
    return best
  })

  /**
   * 고른 지시문 토큰. 자동: 첫 물체 구의 단어(앞에 색 단어가 있으면 색 단어, action 스크립트와 같은 규칙).
   * 그래서 처음 열면 interaction 단계가 설명하기 좋은 단어("bowls", "blue")로 시작한다. 물체 단어가 없으면 개념 채널이 켜진 첫 단어.
   */
  selectedWord: number = $derived.by(() => {
    const text = this.trace.tokens.text
    const pick = this.wordPick
    if (pick && pick.instruction === this.instruction && pick.index < text.length) return pick.index
    const phrase = firstObjectPhrase(text)
    if (phrase) return phrase[0]
    const meaningful = text.find((t) => t.kind === 'word' && (t.concepts?.length ?? 0) > 0)
    return meaningful?.index ?? Math.min(1, text.length - 1)
  })

  /** V-L Interaction 단계: 고른 층과 head (1부터). 설정이 바뀌어 범위를 벗어나면 끝 값으로 맞춘다 */
  interLayerPick = $state(1)
  interHeadPick = $state(1)
  interLayer: number = $derived(Math.max(1, Math.min(this.config.N, this.interLayerPick)))
  interHead: number = $derived(Math.max(1, Math.min(this.config.interactionHeads, this.interHeadPick)))
  /** V-L Interaction 단계의 하위 탭 */
  interTab = $state<'attention' | 'residual' | 'text'>('attention')

  /** Action Decoder 단계: 고른 층, head (1부터), action query (0부터 = step t+k) */
  decLayerPick = $state(1)
  /** 처음에는 state head(6번)를 보인다: 앞쪽 query가 state 구간을 많이 보는 설계가 구간 요약에 드러난다 (caveat designed-queries) */
  decHeadPick = $state(6)
  decQueryPick = $state(0)
  decLayer: number = $derived(Math.max(1, Math.min(this.config.decoderLayers, this.decLayerPick)))
  decHead: number = $derived(Math.max(1, Math.min(this.config.decoderHeads, this.decHeadPick)))
  /** 고른 action query = Output 단계에서 강조하는 step (q_k가 step t+k를 낸다) */
  decQuery: number = $derived(Math.max(0, Math.min(this.config.H - 1, this.decQueryPick)))
  hoverTarget = $state.raw<HoverTarget | null>(null)
  themePref = $state<Theme | null>(readThemePref())
  systemDark = $state(systemPrefersDark())

  /** 실제로 쓰는 테마 */
  theme = $derived<Theme>(this.themePref ?? (this.systemDark ? 'dark' : 'light'))

  stageIndex = $derived(STAGES.indexOf(this.stage))

  setPreset(preset: 'LIBERO' | 'RoboTwin') {
    const { basis, seed, attnTemperature } = this.config
    this.config = presetConfig(preset, { basis, seed, attnTemperature })
    this.robotState = defaultState(this.config)
    this.patchPick = null
    this.wordPick = null
  }

  /**
   * 다른 프리셋으로 바꿨을 때의 forward를 미리 계산해 memo에 넣는다. 브라우저가 쉴 때 한 번 부른다.
   * 처음 프리셋을 바꿀 때 RoboTwin 전체를 계산하느라 100 ms를 넘던 것을 줄인다(측정함). 입력은 setPreset과 같게 맞춘다.
   */
  warmOtherPreset() {
    const other = this.config.profile === 'libero' ? 'RoboTwin' : 'LIBERO'
    const { basis, seed, attnTemperature } = this.config
    const config = presetConfig(other, { basis, seed, attnTemperature })
    forward(config, { instruction: this.instruction, state: defaultState(config) })
  }

  pickWord(index: number) {
    this.wordPick = { index, instruction: this.instruction }
  }

  setStateValue(index: number, value: number) {
    const next = [...this.robotState]
    next[index] = value
    this.robotState = next
  }

  resetState() {
    this.robotState = defaultState(this.config)
  }

  /**
   * 파라미터 패널에서 값을 바꾼다. 프리셋 값과 하나라도 다르면 Custom이 된다(withChanges).
   * K나 이미지 크기가 바뀌면 patch 번호의 뜻이 달라지므로 고른 patch를 자동으로 되돌린다.
   */
  setParams(changes: Partial<Config>) {
    const prev = this.config
    this.config = withChanges(prev, changes)
    if (this.config.K !== prev.K || this.config.imageSize !== prev.imageSize) this.patchPick = null
  }

  /** 프리셋 값으로 되돌린다. 기준(논문 / 공식 코드)만 그대로 둔다 */
  resetParams() {
    const { basis, profile } = this.config
    const prev = this.config
    this.config = presetConfig(profile === 'robotwin' ? 'RoboTwin' : 'LIBERO', { basis })
    if (this.config.K !== prev.K || this.config.imageSize !== prev.imageSize) this.patchPick = null
  }

  setBasis(basis: Basis) {
    this.config = { ...this.config, basis }
  }

  setHover(kind: HoverTarget['kind'], ids: string[]) {
    this.hoverTarget = { kind, ids }
  }

  /**
   * 마우스가 떠난 쪽이 지금 하이라이트의 주인일 때만 지운다(다른 요소로 바로 옮겨 간 경우를 덮어쓰지 않게).
   * kind까지 같아야 한다: 그림이 다시 붙을 때(언어 변경 등) 기호에서 시작한 하이라이트를 지우지 않게.
   */
  clearHover(kind: HoverTarget['kind'], ids: string[]) {
    const h = this.hoverTarget
    if (h && h.kind === kind && h.ids.length === ids.length && h.ids.every((id, i) => id === ids[i])) this.hoverTarget = null
  }

  /** interaction 모드. 파라미터 패널과 같은 길(withChanges)로 바꿔서 프리셋 이름(Custom)이 맞게 한다 */
  setMode(mode: InteractionMode) {
    this.setParams({ mode })
  }

  goTo(stage: StageId) {
    this.stage = stage
  }

  openDialog(id: DialogId) {
    this.caveatFocus = null
    this.dialog = id
  }

  /** 기술적 주의 창을 그 항목에서 연다 (그림 옆 주의 표시를 누르면 해당 항목으로 간다) */
  openCaveat(id: CaveatId) {
    this.caveatFocus = id
    this.dialog = 'caveats'
  }

  closeDialog() {
    this.dialog = null
  }

  /** delta만큼 단계를 옮긴다. 양 끝에서는 멈춘다. */
  step(delta: number) {
    const next = Math.min(STAGES.length - 1, Math.max(0, this.stageIndex + delta))
    this.stage = STAGES[next]
  }

  setTheme(theme: Theme) {
    this.themePref = theme
    applyTheme(this.theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // 저장이 막혀도 이번 화면에서는 바뀐 테마를 쓴다.
    }
  }

  /** 시스템 테마가 바뀌었을 때 (사용자가 테마를 고르지 않았다면 따라간다) */
  setSystemDark(dark: boolean) {
    this.systemDark = dark
    applyTheme(this.theme)
  }

  setLang(lang: Lang) {
    this.lang = lang
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      // 사생활 보호 모드 등에서 저장이 막혀도 화면은 그대로 동작한다.
    }
  }
}

export const ui = new UiStore()
