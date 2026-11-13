// Encoders: Eq. 3 (지시문), Eq. 4 (이미지), Eq. 5 (state).
// DINOv3와 BERT는 실행하지 않는다 (caveat encoders-not-run). P_v(f_img(I))와 P_l(f_text(x))를
// 장면과 단어 사전에서 바로 만든다. f_state는 공식 코드 구조 그대로 계산한다 (가중치만 가상).

import {
  CONCEPTS,
  D,
  POSITION_RANGE,
  TEXTURE_RANGE,
  VIEW_RANGE,
  conceptIndex,
  wordConcepts,
} from './concepts'
import { randomTensor } from './lowrank'
import { rng } from './prng'
import { dominantObject, objectById, patchesOf, viewsFor } from './scene'
import { add, addRowVector, gelu, layerNorm, matmul, tensor, type Tensor } from './tensor'
import type { Config, ObjectId, TokenMeta, ViewInfo } from './types'

const CONCEPT_GAIN = 3
const TABLE_GAIN = 1.5
const SPATIAL_GAIN = 2

/** 공식 코드 기준 + LIBERO에서 지시문을 채우는 칸 수 (online_text_layout.json) */
export const LIBERO_TEXT_SLOTS = 21

/** 공식 코드 기준에서 γ와 E_pos scale에 쓰는 가상 값 (caveat gamma-virtual) */
export const VIRTUAL_SCALE = 0.5

function addConcept(row: Float32Array, name: string, value: number): void {
  row[conceptIndex(name)] += value
}

function addTexture(row: Float32Array, signature: Float32Array, weight: number): void {
  const [start] = TEXTURE_RANGE
  for (let i = 0; i < signature.length; i++) row[start + i] += signature[i] * weight
}

const TEXTURE_DIMS = TEXTURE_RANGE[1] - TEXTURE_RANGE[0]

function signature(seed: number, name: string, std: number): Float32Array {
  return rng(seed, `texture.${name}`).normalArray(TEXTURE_DIMS, std)
}

function activeConcepts(row: Float32Array, threshold = 0.5): string[] {
  const names: string[] = []
  for (let c = 0; c < CONCEPTS.length; c++) if (row[c] > threshold) names.push(CONCEPTS[c].name)
  return names
}

// ---------------------------------------------------------------------------------------------
// Eq. 4: Z^{v,(i)}_t = P_v(f_img(I^{(i)}_t)) + E^{(i)}_pos + e^{(i)}_view

export interface VisionResult {
  views: ViewInfo[]
  tokens: TokenMeta[]
  content: Tensor
  pos: Tensor | null
  posScale: number[] | null
  view: Tensor
  Zv: Tensor
}

/**
 * 격자 크기마다 한 번만 만드는 2D sinusoidal 표 (grid² × POSITION 폭). seed와 관계없는 값이라 다시 쓴다.
 * 표의 값은 sinusoid2d가 그 자리에 쓰는 값과 같다 (Float32Array에 쓴 같은 값).
 */
const sinusoidTables = new Map<number, Float32Array>()
function sinusoidTable(grid: number): Float32Array {
  let table = sinusoidTables.get(grid)
  if (table) return table
  const width = POSITION_RANGE[1] - POSITION_RANGE[0]
  const row = new Float32Array(D)
  table = new Float32Array(grid * grid * width)
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      row.fill(0)
      sinusoid2d(row, gx, gy, grid)
      table.set(row.subarray(POSITION_RANGE[0], POSITION_RANGE[1]), (gy * grid + gx) * width)
    }
  }
  sinusoidTables.set(grid, table)
  return table
}

/** 2D sinusoidal 위치 인코딩 (논문 기준의 설명용 E_pos, caveat epos-values) */
function sinusoid2d(row: Float32Array, gx: number, gy: number, grid: number): void {
  const [start, end] = POSITION_RANGE
  const half = (end - start) / 2
  const freqs = half / 2
  const encode = (offset: number, coordinate: number) => {
    for (let f = 0; f < freqs; f++) {
      const omega = Math.PI * Math.pow(grid, f / freqs) / grid
      row[offset + 2 * f] = Math.sin(coordinate * omega)
      row[offset + 2 * f + 1] = Math.cos(coordinate * omega)
    }
  }
  encode(start, gx)
  encode(start + half, gy)
}

export function encodeVision(config: Config): VisionResult {
  const views = viewsFor(config)
  const P = views[0].grid * views[0].grid
  const total = views.length * P
  const content = tensor(total, D, 'P_v(f_img(I))')
  const view = tensor(total, D, 'e_view')
  const usePos = config.basis === 'paper' || config.profile === 'robotwin'
  const pos = usePos ? tensor(total, D, 'E_pos') : null
  const posScale = config.basis === 'code' && config.profile === 'robotwin' ? views.map(() => VIRTUAL_SCALE) : null
  const tokens: TokenMeta[] = []
  const sigs = new Map<string, Float32Array>()
  const sigOf = (name: string, std: number) => {
    if (!sigs.has(name)) sigs.set(name, signature(config.seed, name, std))
    return sigs.get(name) as Float32Array
  }

  views.forEach((v, vi) => {
    const patches = patchesOf(v)
    const viewVector = rng(config.seed, `vision.view_embedding.${v.name}`).normalArray(VIEW_RANGE[1] - VIEW_RANGE[0], 1)
    const posTable =
      posScale !== null ? rng(config.seed, `vision.pos_table.${v.name}`).noiseArray(P * (POSITION_RANGE[1] - POSITION_RANGE[0]), 0.6) : null
    const noise = rng(config.seed, `vision.patch_noise.${v.name}`).noiseArray(P * (TEXTURE_RANGE[1] - TEXTURE_RANGE[0]), 0.15)

    patches.forEach((p, pi) => {
      const index = vi * P + pi
      const row = content.data.subarray(index * D, (index + 1) * D)
      for (const [id, cov] of Object.entries(p.coverage) as [ObjectId, number][]) {
        if (id === 'table') {
          addConcept(row, 'table', TABLE_GAIN * cov)
          addTexture(row, sigOf('table', 0.5), cov)
          continue
        }
        const o = objectById(id)
        if (!o) continue
        addConcept(row, o.kind, CONCEPT_GAIN * cov)
        if (o.color) addConcept(row, o.color, CONCEPT_GAIN * cov)
        addTexture(row, sigOf(`${o.kind}.${o.color ?? 'none'}`, 0.8), cov)
      }
      const [x, y] = p.center
      const clamp = (value: number) => Math.max(0, Math.min(1, value))
      addConcept(row, 'left', SPATIAL_GAIN * clamp((0.5 - x) * 2))
      addConcept(row, 'right', SPATIAL_GAIN * clamp((x - 0.5) * 2))
      addConcept(row, 'far', SPATIAL_GAIN * clamp((0.5 - y) * 2))
      addConcept(row, 'near', SPATIAL_GAIN * clamp((y - 0.5) * 2))
      for (let i = 0; i < TEXTURE_DIMS; i++) row[TEXTURE_RANGE[0] + i] += noise[pi * TEXTURE_DIMS + i]

      view.data.set(viewVector, index * D + VIEW_RANGE[0])

      if (pos) {
        const posRow = pos.data.subarray(index * D, (index + 1) * D)
        if (posTable && posScale) {
          const width = POSITION_RANGE[1] - POSITION_RANGE[0]
          for (let i = 0; i < width; i++) posRow[POSITION_RANGE[0] + i] = posScale[vi] * posTable[pi * width + i]
        } else {
          const width = POSITION_RANGE[1] - POSITION_RANGE[0]
          const at = (p.gy * v.grid + p.gx) * width
          posRow.set(sinusoidTable(v.grid).subarray(at, at + width), POSITION_RANGE[0])
        }
      }

      tokens.push({
        kind: 'patch',
        name: `${v.name}(${p.gx},${p.gy})`,
        index,
        view: vi,
        gx: p.gx,
        gy: p.gy,
        object: dominantObject(p.coverage),
        coverage: p.coverage,
        concepts: activeConcepts(row),
      })
    })
  })

  let Zv = add(content, view, 'Z^v')
  if (pos) Zv = add(Zv, pos, 'Z^v')
  return { views, tokens, content, pos, posScale, view, Zv }
}

// ---------------------------------------------------------------------------------------------
// Eq. 3: Z^l = P_l(f_text(x)) ∈ R^{N_l × d}

export interface TextResult {
  tokens: TokenMeta[]
  Zl: Tensor
  /** 1 = [PAD] */
  keyPadding: Uint8Array
  /** 문장 단위 self-attention 허용 mask (N_l × N_l, 1 = 허용). 공식 코드의 텍스트 블록에서 쓴다. */
  subSentence: Uint8Array
}

const SPECIAL = new Set(['[CLS]', '[SEP]', '.', '?'])

/** 소문자 + 공백 단위 + [CLS], [SEP] (caveat tokenizer) */
export function tokenize(instruction: string, config: Config): string[] {
  const words = instruction.toLowerCase().match(/[a-z0-9]+|[^\sa-z0-9]/g) ?? []
  const padTo = config.basis === 'code' && config.profile === 'libero' ? LIBERO_TEXT_SLOTS : null
  const body = padTo ? words.slice(0, padTo - 2) : words
  const tokens = ['[CLS]', ...body, '[SEP]']
  if (padTo) while (tokens.length < padTo) tokens.push('[PAD]')
  return tokens
}

/**
 * Grounding DINO의 generate_masks_with_special_tokens와 같은 규칙 (공식 코드가 그대로 쓴다).
 * special token 사이를 한 블록으로 묶는다. 맨 앞이나 맨 끝에 있는 special token은 자기 자신만 본다.
 */
export function subSentenceMask(tokens: string[]): Uint8Array {
  const n = tokens.length
  const mask = new Uint8Array(n * n)
  for (let i = 0; i < n; i++) mask[i * n + i] = 1
  let previous = 0
  tokens.forEach((token, col) => {
    if (!SPECIAL.has(token)) return
    if (col !== 0 && col !== n - 1) {
      for (let r = previous + 1; r <= col; r++) for (let c = previous + 1; c <= col; c++) mask[r * n + c] = 1
    }
    previous = col
  })
  return mask
}

export function encodeText(config: Config, instruction: string): TextResult {
  const words = tokenize(instruction, config)
  const Zl = tensor(words.length, D, 'Z^l')
  const keyPadding = new Uint8Array(words.length)
  const padRow = rng(config.seed, 'text.pad_bias').normalArray(D, 0.1)
  const tokens: TokenMeta[] = words.map((word, index) => {
    const row = Zl.data.subarray(index * D, (index + 1) * D)
    if (word === '[PAD]') {
      // 설명용 단순화: 모든 [PAD] 칸을 지시문과 무관한 같은 가상 벡터로 둔다.
      // 공식 코드(LIBERO): 이 페이지의 지시문들은 online_text_layout.json에 없어서 BERT가 21칸까지 [PAD]를 붙여 돈다.
      // [PAD]는 문장 mask에서 자기 자신만 보고 position id가 0이라, 모든 [PAD] 칸이 같은 값 P_l(BERT([PAD]))가 된다.
      // (layout에 있는 벤치마크 지시문 40개 중 suite 길이 밖의 칸만 0 hidden에서 시작해 P_l의 bias가 된다.)
      row.set(padRow)
      keyPadding[index] = 1
      return { kind: 'pad', name: word, index }
    }
    const kind = word === '[CLS]' ? 'cls' : word === '[SEP]' ? 'sep' : 'word'
    const concepts = wordConcepts(word)
    for (const [name, weight] of Object.entries(concepts)) addConcept(row, name, CONCEPT_GAIN * weight)
    addTexture(row, signature(config.seed, `word.${word}`, kind === 'word' ? 0.6 : 0.8), 1)
    const context = rng(config.seed, `text.context.${index}`).noiseArray(D, 0.05)
    for (let i = 0; i < D; i++) row[i] += context[i]
    return { kind, name: word, index, concepts: Object.keys(concepts) }
  })
  return { tokens, Zl, keyPadding, subSentence: subSentenceMask(words) }
}

// ---------------------------------------------------------------------------------------------
// Eq. 5: Z^s_t = f_state(s_t) ∈ R^{N_s × d}
// 공식 코드 StateProjection: LN(D_s) → Linear(D_s→256) → GELU → Dropout → Linear(256→N_s·256)
//   → N_s개로 자름 → + 학습 위치 벡터 → LN(256)

export const STATE_HIDDEN = 256

export interface StateResult {
  tokens: TokenMeta[]
  s: Tensor
  /** 마지막 Linear의 출력을 N_s개로 자른 것 (N_s × 256, 위치 벡터를 더하기 전). 한 행 = 출력 벡터의 256칸 한 토막 */
  split: Tensor
  Zs: Tensor
}

export function encodeState(config: Config, state: number[]): StateResult {
  if (state.length !== config.stateDim) throw new Error(`state has ${state.length} values, expected ${config.stateDim}`)
  const r = rng(config.seed, 'state.f_state')
  const s = tensor(1, config.stateDim, 's_t', Float32Array.from(state))
  const w1 = randomTensor(r, config.stateDim, STATE_HIDDEN, 1 / Math.sqrt(config.stateDim))
  const b1 = r.noiseArray(STATE_HIDDEN, 0.1)
  const w2 = randomTensor(r, STATE_HIDDEN, config.Ns * D, 0.6 / Math.sqrt(STATE_HIDDEN))
  // 설명용 설계: 마지막 Linear가 개념 칸 'proprio'에 크게 쓰게 해서 decoder의 state head가 state 토큰을 찾게 한다
  const proprio = conceptIndex('proprio')
  for (let n = 0; n < config.Ns; n++) {
    for (let h = 0; h < STATE_HIDDEN; h++) w2.data[h * config.Ns * D + n * D + proprio] += 0.12
  }
  const position = randomTensor(r, config.Ns, D, 0.02)

  const hidden = gelu(addRowVector(matmul(layerNorm(s), w1), b1))
  const flat = matmul(hidden, w2)
  // [1, N_s·256] → [N_s, 256]: 앞 256개가 토큰 1, 다음 256개가 토큰 2 (공식 코드의 view와 같다)
  const tokensTensor = tensor(config.Ns, D, 'f_state 출력', flat.data)
  const Zs = layerNorm(add(tokensTensor, position), 'Z^s')
  const tokens: TokenMeta[] = Array.from({ length: config.Ns }, (_, i) => ({ kind: 'state', name: `state ${i + 1}`, index: i }))
  return { tokens, s, split: tokensTensor, Zs }
}
