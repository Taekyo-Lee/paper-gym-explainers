// 단계별 수식. 논문 번호와 표기를 그대로 쓴다 (PDF와 대조함).
// - 매 시점 값에는 t를 붙이고, 지시문 feature Z^l에만 t가 없다.
// - 논문은 Â_t와 A*_t를 굵게 쓴다.
// - 기호 ↔ 그림 하이라이트: 기호를 \htmlClass{hl hl-<id>}{…}로 감싼다. 그림은 {@attach hl('<id>')}로 같은 id를 단다.
// - 공식 코드 기준: 계산이 다른 식(Eq. 3의 N_l, Eq. 4의 E_pos, Eq. 7의 residual)은
//   논문 식 옆에 코드가 하는 식을 두고, 다른 곳을 \htmlClass{diff}{…}(빨간 펜)로 표시한다.
import type { Profile } from '../engine/types'
import { g, type GlossKey } from './glossary'
import type { StageId } from './stages'

/** 수식의 출처. 화면에서 출처 표시를 다르게 한다. */
export type EquationSource =
  /** 논문의 번호 붙은 수식 */
  | { kind: 'paperEq'; number: string; section: string }
  /** 논문 본문에 있지만 번호가 없는 식 */
  | { kind: 'paperText'; section: string }
  /** 논문에는 문장으로만 있고, 우리가 식으로 옮긴 것 */
  | { kind: 'paperProse'; section: string }
  /** TurboVLA 논문에는 없는 식 (예: 2017 Transformer의 attention) */
  | { kind: 'external' }

export interface Equation {
  id: string
  source: EquationSource
  tex: string
  /** 식 안에 감싸지 않았지만 기호 표에 넣을 풀이 key (예: 모든 기호에 붙는 첨자 t) */
  extra?: GlossKey[]
}

/** 공식 코드가 실제로 하는 식. note는 copy의 equations 아래 key */
export interface CodeEquation {
  tex: string
  note: 'codeEq3' | 'codeEq4Libero' | 'codeEq4Robotwin' | 'codeEq7Libero' | 'codeEq7Robotwin'
}

/** 기호 하이라이트 id → 그림이 있는 곳 (기호를 누르면 그곳으로 간다) */
export interface SymbolHome {
  stage: StageId
  encoderTab?: 'vision' | 'text' | 'state'
  interTab?: 'attention' | 'residual' | 'text'
}

export const SYMBOLS = {
  O: { stage: 'inputs' },
  x: { stage: 'inputs' },
  s: { stage: 'inputs' },
  Zv: { stage: 'encoders', encoderTab: 'vision' },
  Zvi: { stage: 'encoders', encoderTab: 'vision' },
  Pv: { stage: 'encoders', encoderTab: 'vision' },
  Epos: { stage: 'encoders', encoderTab: 'vision' },
  eview: { stage: 'encoders', encoderTab: 'vision' },
  Zl: { stage: 'encoders', encoderTab: 'text' },
  Zs: { stage: 'encoders', encoderTab: 'state' },
  fstate: { stage: 'encoders', encoderTab: 'state' },
  Vprev: { stage: 'interaction', interTab: 'residual' },
  Lprev: { stage: 'interaction', interTab: 'residual' },
  Vnext: { stage: 'interaction', interTab: 'residual' },
  Lnext: { stage: 'interaction', interTab: 'residual' },
  Lmid: { stage: 'interaction', interTab: 'residual' },
  AttnVL: { stage: 'interaction', interTab: 'attention' },
  AttnLV: { stage: 'interaction', interTab: 'attention' },
  Zvl: { stage: 'memory' },
  VN: { stage: 'memory' },
  LN: { stage: 'memory' },
  memory: { stage: 'memory' },
  Qa: { stage: 'decoder' },
  Ahat: { stage: 'output' },
} as const satisfies Record<string, SymbolHome>

export type SymbolId = keyof typeof SYMBOLS

/** interaction 층의 기호. "섞지 않음" 모드에서는 이 층을 건너뛰므로 그림이 없다 */
export const INTERACTION_SYMBOLS: readonly SymbolId[] = ['Vprev', 'Lprev', 'Vnext', 'Lnext', 'Lmid', 'AttnVL', 'AttnLV']

/**
 * 기호의 그림이 있는 곳. 공식 코드 기준에서 L^ℓ_t는 텍스트 블록을 거친 값이라 텍스트 블록 탭에 있다
 * (residual 탭의 지시 쪽 마지막 줄은 그 전 값 L′).
 */
export function symbolHome(id: SymbolId, basis: 'paper' | 'code'): SymbolHome {
  if (id === 'Lnext' && basis === 'code') return { stage: 'interaction', interTab: 'text' }
  return SYMBOLS[id]
}

/** 하이라이트 id → 풀이 key (대부분 같다. Pv 하이라이트는 P_v(f_img(I)) 전체, LN은 마지막 층의 L^N) */
const HL_GLOSS: Record<SymbolId, GlossKey> = {
  O: 'O', x: 'x', s: 's', Zv: 'Zv', Zvi: 'Zvi', Pv: 'Pvf', Epos: 'Epos', eview: 'eview', Zl: 'Zl', Zs: 'Zs', fstate: 'fstate',
  Vprev: 'Vprev', Lprev: 'Lprev', Vnext: 'Vnext', Lnext: 'Lnext', Lmid: 'Lmid', AttnVL: 'AttnVL', AttnLV: 'AttnLV',
  Zvl: 'Zvl', VN: 'VN', LN: 'LNout', memory: 'memory', Qa: 'Qa', Ahat: 'Ahat',
}

/** 기호를 하이라이트 id로 감싼다. 같은 기호의 풀이 key도 함께 단다 (마우스를 올리면 풀이가 뜬다) */
function h(id: SymbolId, tex: string): string {
  return String.raw`\htmlClass{hl hl-${id} gl gl-${HL_GLOSS[id]}}{${tex}}`
}

/** 공식 코드가 논문과 다르게 하는 부분 (빨간 펜) */
function diff(tex: string): string {
  return String.raw`\htmlClass{diff}{${tex}}`
}

/** ℝ^{a × b} 모양 표기. 안의 크기 기호도 각자 풀이가 있다 */
function shape(rows: string, cols: string): string {
  return g('R', String.raw`\mathbb{R}^{${rows} \times ${cols}}`)
}

const THETA = g('theta', String.raw`\theta`)
const A_HAT = h('Ahat', String.raw`\hat{\mathbf{A}}_t`)
const ZV = h('Zv', 'Z^{v}_t')
const ZL = h('Zl', 'Z^{l}')
const ZS = h('Zs', 'Z^{s}_t')
const ZVL = h('Zvl', 'Z^{vl}_t')
/** decoder memory. 안쪽 기호도 각자 풀이가 있다 (안쪽은 g: hl이 겹치면 수식 패널의 하이라이트가 바깥 기호를 찾지 못한다) */
const MEMORY = h('memory', String.raw`\left[${g('Zvl', 'Z^{vl}_t')} ; ${g('Zs', 'Z^{s}_t')}\right]`)
const QA = h('Qa', 'Q_a')
const VPREV = h('Vprev', String.raw`V^{\ell-1}_t`)
const LPREV = h('Lprev', String.raw`L^{\ell-1}_t`)
const VNEXT = h('Vnext', String.raw`V^{\ell}_t`)
const LNEXT = h('Lnext', String.raw`L^{\ell}_t`)
const ATTN_VL = h('AttnVL', String.raw`\text{Attn}_{v \leftarrow l}`)
const ATTN_LV = h('AttnLV', String.raw`\text{Attn}_{l \leftarrow v}`)
const PV = h('Pv', String.raw`${g('Pv', 'P_v')}\!\left(${g('fimg', String.raw`f_{\text{img}}`)}\!\left(${g('I', String.raw`I^{(i)}_t`)}\right)\right)`)
const EVIEW = h('eview', String.raw`e^{(i)}_{\text{view}}`)
const ZVI = h('Zvi', String.raw`Z^{v,(i)}_t`)
const H_ = g('H', 'H')
const DA = g('da', String.raw`d_{\scriptstyle a}`)
const D_ = g('d', 'd')
const D_THETA = g('Dtheta', String.raw`D_{${THETA}}`)
const ELL = g('ell', String.raw`\ell`)
const Q_ = g('Qm', 'Q')
const K_ = g('Km', 'K')
const V_ = g('Vm', 'V')
const SOFTMAX = g('softmax', String.raw`\operatorname{softmax}`)
const QKT = String.raw`${Q_}${K_}^{${g('transpose', String.raw`\top`)}}/\sqrt{${g('dk', 'd_k')}}`
const ASTAR = g('Astar', String.raw`\mathbf{A}^{*}_t`)

const EQ = {
  policy: {
    id: 'policy',
    source: { kind: 'paperText', section: '§3.1' },
    tex: String.raw`${A_HAT} = ${g('pi', String.raw`\pi_{${THETA}}`)}\!\left(${h('O', String.raw`\mathcal{O}_t`)},\, ${h('x', 'x')},\, ${h('s', 's_t')}\right) \in ${shape(H_, DA)}`,
    extra: ['t'],
  },
  eq2: {
    id: 'eq2',
    source: { kind: 'paperEq', number: '2', section: '§3.1' },
    tex: String.raw`${ZVL} = ${g('Phi', String.raw`\Phi_{vl}`)}\!\left(${ZV},\, ${ZL}\right), \qquad ${A_HAT} = ${D_THETA}\!\left(${QA},\, ${MEMORY}\right)`,
    extra: ['t'],
  },
  eq3: {
    id: 'eq3',
    source: { kind: 'paperEq', number: '3', section: '§3.2' },
    tex: String.raw`${ZL} = ${g('Pl', 'P_l')}\!\left(${g('ftext', String.raw`f_{\text{text}}`)}(${h('x', 'x')})\right) \in ${shape(g('Nl', String.raw`N_{\scriptstyle l}`), D_)}`,
  },
  eq4: {
    id: 'eq4',
    source: { kind: 'paperEq', number: '4', section: '§3.2' },
    tex: String.raw`${ZVI} = ${PV} + ${h('Epos', String.raw`E^{(i)}_{\text{pos}}`)} + ${EVIEW}, \qquad ${ZV} = ${g('concat', String.raw`\left[${g('Zvi', 'Z^{v,(1)}_t')} ; \dots ; ${g('Zvi', String.raw`Z^{v,(${g('K', 'K')})}_t`)}\right]`)}`,
    extra: ['i', 't'],
  },
  eq5: {
    id: 'eq5',
    source: { kind: 'paperEq', number: '5', section: '§3.2' },
    tex: String.raw`${ZS} = ${h('fstate', String.raw`f_{\text{state}}`)}(${h('s', 's_t')}) \in ${shape(g('Ns', String.raw`N_{\scriptstyle s}`), D_)}`,
    extra: ['t'],
  },
  eq6: {
    id: 'eq6',
    source: { kind: 'paperEq', number: '6', section: '§3.3' },
    tex: String.raw`\left(${VNEXT},\, ${LNEXT}\right) = ${g('Fusion', String.raw`\text{FusionLayer}_{\ell}`)}\!\left(${VPREV},\, ${LPREV}\right), \quad ${ELL} = 1, \dots, ${g('N', 'N')}`,
    extra: ['t'],
  },
  eq7: {
    id: 'eq7',
    source: { kind: 'paperEq', number: '7', section: '§3.3' },
    tex: String.raw`${VNEXT} = ${VPREV} + ${ATTN_VL}\!\left(${VPREV},\, ${LPREV}\right), \qquad ${LNEXT} = ${LPREV} + ${ATTN_LV}\!\left(${LPREV},\, ${VPREV}\right)`,
    extra: ['ell', 't'],
  },
  eq8: {
    id: 'eq8',
    source: { kind: 'paperEq', number: '8', section: '§3.3' },
    tex: String.raw`${ZVL} = ${g('concat', String.raw`\left[${h('VN', 'V^{N}_t')} ; ${h('LN', 'L^{N}_t')}\right]`)}`,
    extra: ['t'],
  },
  eq9: {
    id: 'eq9',
    source: { kind: 'paperEq', number: '9', section: '§3.4' },
    tex: String.raw`${A_HAT} = ${D_THETA}\!\left(${QA},\, ${MEMORY}\right) \in ${shape(H_, DA)}`,
    extra: ['t'],
  },
  qa: {
    // Q_a의 정의는 Eq. 9 뒤 "where …" 문장에 있다 (번호 없음, p.6)
    id: 'qa',
    source: { kind: 'paperText', section: '§3.4' },
    tex: String.raw`${QA} = \left[${g('q', 'q_1')}, \dots, ${g('q', `q_{${H_}}`)}\right]`,
  },
  attention2017: {
    id: 'attention2017',
    source: { kind: 'external' },
    tex: String.raw`${g('attnFn', String.raw`\text{Attention}`)}(${Q_}, ${K_}, ${V_}) = ${SOFTMAX}\!\left(${QKT}\right) ${V_}`,
  },
  l1: {
    // 논문: "an ℓ1 loss between the predicted chunk Â_t and the expert sequence A*_t" (§3.4, App. A.3).
    // loss 식 자체는 논문에 없다 (문장을 식으로 옮긴 것).
    id: 'l1',
    source: { kind: 'paperProse', section: '§3.4' },
    tex: String.raw`${g('L1', String.raw`\mathcal{L}_{\ell_{\scriptstyle 1}}`)}\!\left(${A_HAT},\, ${ASTAR}\right)`,
    extra: ['t'],
  },
  astar: {
    // 정답 chunk의 정의는 §3.4 본문에 식으로 있다 (번호 없음)
    id: 'astar',
    source: { kind: 'paperText', section: '§3.4' },
    tex: String.raw`${ASTAR} = \left[${g('astar', 'a^{*}_t')}, \dots, ${g('astar', `a^{*}_{t+${H_}-1}`)}\right]`,
    extra: ['t'],
  },
} satisfies Record<string, Equation>

/**
 * 하단 바 창의 식 (번호 없음, 수식 패널 밖).
 * - 2017 비교: 2017 Transformer의 attention에 mask M을 더한 꼴. TurboVLA 논문에는 없는 식이다.
 * - Loss 장난감: 한 step에서 예측 p와 시연 5개의 정답 값의 loss 합. 논문은 ℓ1을 쓴다고만 하므로 세미나 설명이다.
 */
const M_ = g('M', 'M')
const P_ = g('p', 'p')
const I_DEMO = g('iDemo', 'i')
const AI = g('ai', String.raw`a^{*}_{${I_DEMO}}`)
export const DIALOG_TEX = {
  maskedAttention: String.raw`${SOFTMAX}\!\left(${QKT} + ${M_}\right) ${V_}`,
  mask2017: String.raw`${M_}_{${g('ij', 'ij')}} = -\infty \quad (${g('ij', 'j')} > ${g('ij', 'i')})`,
  maskTurbo: String.raw`${M_} = 0`,
  lossL1: String.raw`\sum_{${I_DEMO}=1}^{5} \left| ${P_} - ${AI} \right|`,
  lossL2: String.raw`\sum_{${I_DEMO}=1}^{5} \left( ${P_} - ${AI} \right)^{2}`,
} as const

export const STAGE_EQUATIONS: Record<StageId, Equation[]> = {
  inputs: [EQ.policy, EQ.eq2],
  encoders: [EQ.eq3, EQ.eq4, EQ.eq5],
  interaction: [EQ.eq6, EQ.eq7, EQ.attention2017],
  // Eq. 9의 두 번째 인자 [Z^{vl}_t ; Z^s_t]가 decoder memory다 (App. A.1).
  memory: [EQ.eq8, EQ.eq9],
  decoder: [EQ.eq9, EQ.qa, EQ.attention2017],
  output: [EQ.eq9, EQ.l1, EQ.astar],
}

/**
 * 공식 코드 기준에서 논문 식과 계산이 다른 식. 없으면 null.
 * Eq. 3: LIBERO만 N_l = 21 ([PAD]). Eq. 4: LIBERO는 E_pos 없음, RoboTwin은 view별 scale × 위치표.
 * Eq. 7: residual을 더하는 값(LIBERO는 LN을 거친 값)과 γ, 지시 쪽 텍스트 블록. attention 입력은 두 기준 모두 LN을 거친 값이다.
 */
export function codeEquation(id: string, profile: Profile): CodeEquation | null {
  const libero = profile === 'libero'
  if (id === 'eq3' && libero) {
    return {
      tex: String.raw`${ZL} = ${g('Pl', 'P_l')}\!\left(${g('ftext', String.raw`f_{\text{text}}`)}(${h('x', 'x')})\right) \in ${shape(g('Nl', diff('21')), D_)}`,
      note: 'codeEq3',
    }
  }
  if (id === 'eq4') {
    const pos = libero
      ? g('Epos', diff(String.raw`\cancel{+\, E^{(i)}_{\text{pos}}}`))
      : String.raw`+ ${diff(String.raw`${g('posScale', 's^{(i)}')} \cdot`)}\, ${h('Epos', String.raw`E^{(i)}_{\text{pos}}`)}`
    return { tex: String.raw`${ZVI} = ${PV} ${pos} + ${EVIEW}`, note: libero ? 'codeEq4Libero' : 'codeEq4Robotwin' }
  }
  if (id === 'eq7') {
    const base = (x: string) => (libero ? diff(String.raw`${g('LNop', String.raw`\mathrm{LN}`)}(${x})`) : x)
    const scale = diff(String.raw`${g('gamma', String.raw`\gamma`)} ${g('hadamard', String.raw`\odot`)}`)
    const lmid = h('Lmid', String.raw`L'^{\ell}_t`)
    const tex = String.raw`${VNEXT} = ${base(VPREV)} + ${scale}\, ${ATTN_VL}(\cdot), \quad ${lmid} = ${base(LPREV)} + ${scale}\, ${ATTN_LV}(\cdot), \quad ${LNEXT} = ${diff(g('TextBlock', String.raw`\text{TextBlock}`))}(${lmid})`
    return { tex, note: libero ? 'codeEq7Libero' : 'codeEq7Robotwin' }
  }
  return null
}
