// 엔진의 타입. 엔진은 Svelte를 모르는 순수 TypeScript다.

import type { CaveatId } from './caveats'
import type { Tensor } from './tensor'

export type { Tensor } from './tensor'

export type Preset = 'LIBERO' | 'RoboTwin' | 'Custom'
/** 공식 코드 기준에서 어느 구현을 따를지. 프리셋이 정하고 Custom은 이어받는다. */
export type Profile = 'libero' | 'robotwin'
export type Basis = 'paper' | 'code'
export type InteractionMode = 'bidirectional' | 'v_from_l_only' | 'l_from_v_only' | 'none'
export type InteractionHeads = 1 | 2 | 4 | 8

export interface Config {
  preset: Preset
  profile: Profile
  basis: Basis
  /** camera views (1–3) */
  K: number
  imageSize: 224 | 256
  patchSize: 16
  d: 256
  stateDim: number
  actionDim: number
  /** state tokens */
  Ns: number
  /** interaction layers */
  N: number
  interactionHeads: InteractionHeads
  interactionInnerDim: 1024
  textFFNDim: 1024
  decoderLayers: 3
  decoderHeads: 8
  decoderFFNDim: 2048
  outputMLPHidden: 512
  /** action horizon */
  H: number
  mode: InteractionMode
  /** 설명용 attention 온도 (논문에 없음) */
  attnTemperature: number
  seed: number
}

/** Config와 따로 둔다: 바꿔도 가중치는 그대로다. */
export interface ForwardInputs {
  instruction: string
  /** s_t, 길이 = stateDim */
  state: number[]
}

export type ObjectId = 'plate' | 'pinkBowl' | 'blueBowl' | 'greenBowl' | 'gripper' | 'table'

export type TokenKind = 'patch' | 'cls' | 'word' | 'sep' | 'pad' | 'state'

export interface TokenMeta {
  kind: TokenKind
  /** 화면에 보일 이름: 단어, 'primary(3,7)' 같은 patch 좌표, 'state 1' */
  name: string
  /** 자기 토큰 열(visual / text / state) 안에서의 번호 */
  index: number
  view?: number
  gx?: number
  gy?: number
  /** patch에서 가장 넓게 보이는 물체 */
  object?: ObjectId
  /** patch 안 물체별 면적 비율 */
  coverage?: Partial<Record<ObjectId, number>>
  /** 이 토큰에서 켜진 개념 채널 이름 */
  concepts?: string[]
}

export interface ViewInfo {
  name: string
  /** 장면(탁상) 좌표에서 이 view가 보는 영역의 중심 */
  center: [number, number]
  /** 이 view가 보는 영역의 한 변 길이 (장면 좌표) */
  span: number
  /** 한 변의 patch 수 (imageSize / 16) */
  grid: number
}

export interface InteractionLayerTrace {
  /** ℓ (1부터) */
  index: number
  V_in: Tensor
  L_in: Tensor
  V_norm: Tensor
  L_norm: Tensor
  /** head별 score (K·P × N_l). 두 방향이 공유한다 (공식 코드) */
  S: Tensor[]
  /** head별 (K·P × N_l) = 행 softmax(S) */
  A_v_from_l: Tensor[]
  /** head별 (N_l × K·P) = 행 softmax(Sᵀ) */
  A_l_from_v: Tensor[]
  /** cross-attention 출력 (γ 곱하기 전) */
  dV: Tensor
  dL: Tensor
  V_out: Tensor
  /** cross-attention 직후의 L (텍스트 블록 전) */
  L_mid: Tensor
  L_out: Tensor
  /** 공식 코드 기준일 때만: 텍스트 self-attention + FFN */
  textLayer: { A: Tensor[]; afterAttn: Tensor } | null
  active: { vFromL: boolean; lFromV: boolean }
}

export interface DecoderLayerTrace {
  index: number
  selfAttn: Tensor[]
  /** head별 H × M */
  crossAttn: Tensor[]
  out: Tensor
}

export interface ForwardTrace {
  config: Config
  inputs: ForwardInputs
  views: ViewInfo[]
  tokens: { visual: TokenMeta[]; text: TokenMeta[]; state: TokenMeta[] }
  Zv: Tensor
  /** Eq. 4 분해: content = P_v(f_img(I)), pos = E_pos 항 (없으면 null), view = e_view 항 */
  Zv_parts: { content: Tensor; pos: Tensor | null; posScale: number[] | null; view: Tensor }
  Zl: Tensor
  /** 1 = [PAD] */
  textKeyPadding: Uint8Array
  /** 텍스트 self-attention의 문장 mask (N_l × N_l, 행 우선, 1 = 볼 수 있음). 공식 코드 기준의 텍스트 블록이 쓴다 */
  textSubSentence: Uint8Array
  /** split: 마지막 Linear의 출력(1 × N_s·256)을 N_s × 256으로 자른 것, 위치 벡터를 더하기 전 */
  state: { s: Tensor; split: Tensor; Zs: Tensor }
  layers: InteractionLayerTrace[]
  Zvl: Tensor
  memory: Tensor
  memorySegments: { visual: [number, number]; text: [number, number]; state: [number, number] }
  Qa: Tensor
  decoder: DecoderLayerTrace[]
  /** decoder가 실제로 계산한 tanh 출력 (가상 가중치라 의미 없음) */
  decoderOutput: Tensor
  /** 화면 그래프용 스크립트 (caveat action-script) */
  actions: Tensor
  actionTarget: ObjectId
  caveats: CaveatId[]
}
