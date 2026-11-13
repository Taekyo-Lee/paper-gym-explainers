// 화면의 action 그래프용 스크립트 (caveat action-script).
// decoder의 실제 출력은 가상 가중치라 의미가 없다. 그래서 그래프는 "지시문의 첫 물체 구가 Query일 때(L←V, 첫 층)
// attention이 가장 많이 간 물체로 그리퍼가 다가가 잡는" 단순한 궤적으로 만든다. 값의 범위는 논문의 정규화를 따른다 (App. A.2).

import { rng } from './prng'
import { objectArea, objectById, SCENE } from './scene'
import { tensor, type Tensor } from './tensor'
import type { Config, DecoderLayerTrace, InteractionLayerTrace, ObjectId, TokenMeta } from './types'

const TARGETS: ObjectId[] = ['pinkBowl', 'blueBowl', 'greenBowl', 'plate']

/** 마지막 decoder 층의 cross-attention이 물체마다 간 양 (물체 넓이로 나눔) */
export function attentionPerObject(last: DecoderLayerTrace, visual: TokenMeta[]): Record<ObjectId, number> {
  const nv = visual.length
  // 먼저 head와 query에 걸쳐 memory 토큰별 attention을 더한 뒤, 물체 면적 비율과 곱한다
  const perToken = new Float64Array(nv)
  for (const A of last.crossAttn) {
    for (let q = 0; q < A.rows; q++) {
      const o = q * A.cols
      for (let i = 0; i < nv; i++) perToken[i] += A.data[o + i]
    }
  }
  const mass = Object.fromEntries(TARGETS.map((id) => [id, 0])) as Record<ObjectId, number>
  for (const id of TARGETS) {
    let sum = 0
    for (let i = 0; i < nv; i++) sum += perToken[i] * (visual[i].coverage?.[id] ?? 0)
    const object = objectById(id)
    mass[id] = object ? sum / objectArea(object) : sum
  }
  return mass
}

export function pickTarget(mass: Record<ObjectId, number>): ObjectId {
  return TARGETS.reduce((best, id) => (mass[id] > mass[best] ? id : best), TARGETS[0])
}

const OBJECT_WORDS = new Set(['bowl', 'bowls', 'plate', 'plates'])
const COLOR_WORDS = new Set(['pink', 'blue', 'green', 'white'])

/**
 * 지시문의 첫 물체 구에서 목표를 가장 잘 가리키는 단어의 토큰 번호. 색 단어가 붙어 있으면 색 단어("blue bowl" → blue),
 * 아니면 물체 단어("bowls"). 물체 단어가 없으면 null.
 * (patch의 attention은 단어들에 대한 softmax라 행 합이 1이다. 색 단어와 물체 단어를 더하면 색이 다른 그릇과의 차이가 작아진다.)
 */
export function firstObjectPhrase(text: TokenMeta[]): number[] | null {
  const o = text.findIndex((t) => t.kind === 'word' && OBJECT_WORDS.has(t.name))
  if (o < 0) return null
  return o > 0 && COLOR_WORDS.has(text[o - 1].name) ? [o - 1] : [o]
}

/**
 * 첫 물체 구의 단어가 Query일 때(L←V) attention이 물체마다 얼마나 갔는지 (첫 interaction 층, 모든 head 합).
 * 지시가 Q일 때의 질문 "그게 어디 있어?"의 답이다. 단어 하나의 행은 모든 patch 위의 분포라서,
 * 그 단어가 가리키는 물체에 몰린다. 첫 층을 쓰는 이유: 층이 깊어질수록 residual로 개념이 섞여 대비가 흐려진다.
 */
export function phraseAttentionPerObject(
  layers: InteractionLayerTrace[],
  visual: TokenMeta[],
  phrase: number[],
): Record<ObjectId, number> {
  const nv = visual.length
  const perToken = new Float64Array(nv)
  for (const A of layers[0].A_l_from_v) {
    for (const j of phrase) {
      const o = j * A.cols
      for (let i = 0; i < nv; i++) perToken[i] += A.data[o + i]
    }
  }
  // 물체가 보인 patch당 평균을 쓴다. 합을 쓰면 의미와 무관한 head의 거의 균등한 attention이
  // patch 수만큼 쌓여, 카메라에 크게 잡힌 물체가 유리해진다.
  const mass = Object.fromEntries(TARGETS.map((id) => [id, 0])) as Record<ObjectId, number>
  for (const id of TARGETS) {
    let sum = 0
    let seen = 0
    for (let i = 0; i < nv; i++) {
      const cov = visual[i].coverage?.[id] ?? 0
      sum += perToken[i] * cov
      seen += cov
    }
    mass[id] = seen > 0 ? sum / seen : 0
  }
  return mass
}

/**
 * 스크립트의 목표 물체 (caveat action-script).
 * 지시문의 첫 물체 구가 있고 interaction이 있으면 그 단어의 L←V attention으로, 아니면 decoder cross-attention으로 고른다.
 */
export function scriptTarget(
  layers: InteractionLayerTrace[],
  decoderLast: DecoderLayerTrace,
  visual: TokenMeta[],
  text: TokenMeta[],
): ObjectId {
  const phrase = firstObjectPhrase(text)
  if (phrase && layers.length) return pickTarget(phraseAttentionPerObject(layers, visual, phrase))
  return pickTarget(attentionPerObject(decoderLast, visual))
}

const smoothstep = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))

export function scriptActions(config: Config, state: number[], target: ObjectId): Tensor {
  const H = config.H
  const dA = config.actionDim
  const out = tensor(H, dA, 'Â_t (스크립트)')
  const object = objectById(target) ?? SCENE[0]
  const gripper = objectById('gripper') ?? SCENE[SCENE.length - 1]
  const progress = (k: number) => (H > 1 ? k / (H - 1) : 1)
  const closeFrom = H - Math.max(1, Math.round(H * 0.2))

  if (dA === 14) {
    // RoboTwin: [왼팔 관절 6, 오른팔 관절 6, 왼 gripper, 오른 gripper], 관절 [−1, 1], gripper {0, 1} (1 = 열림으로 둔다)
    const r = rng(config.seed, 'actions.joint_map')
    const map = Array.from({ length: 6 }, () => [r.normal(), r.normal(), r.normal() * 0.3])
    const useLeft = object.center[0] < 0.5
    const goal = map.map(([a, b, c]) => Math.tanh(a * (object.center[0] - 0.5) * 2 + b * (object.center[1] - 0.5) * 2 + c))
    for (let k = 0; k < H; k++) {
      const s = smoothstep(progress(k))
      for (let j = 0; j < 6; j++) {
        const left0 = state[j] ?? 0
        const right0 = state[6 + j] ?? 0
        out.data[k * dA + j] = clamp1(useLeft ? left0 + (goal[j] - left0) * s : left0)
        out.data[k * dA + 6 + j] = clamp1(useLeft ? right0 : right0 + (goal[j] - right0) * s)
      }
      const closing = k >= closeFrom ? 0 : 1
      out.data[k * dA + 12] = useLeft ? closing : (state[12] ?? 1) >= 0.5 ? 1 : 0
      out.data[k * dA + 13] = useLeft ? ((state[13] ?? 1) >= 0.5 ? 1 : 0) : closing
    }
    return out
  }

  // LIBERO 방식: [dx, dy, dz, droll, dpitch, dyaw, gripper], 팔 [−1, 1], gripper {−1 열림, +1 닫힘}
  const start: [number, number] = [gripper.center[0] + 0.08 * (state[0] ?? 0), gripper.center[1] + 0.08 * (state[1] ?? 0)]
  const delta = [object.center[0] - start[0], object.center[1] - start[1]]
  const armDims = Math.min(6, dA - 1)
  for (let k = 0; k < H; k++) {
    const t = progress(k)
    const bell = Math.sin(Math.PI * Math.min(1, (k + 0.5) / H))
    const values = [
      delta[0] * 4 * bell,
      -delta[1] * 4 * bell,
      -0.8 * smoothstep((t - 0.4) / 0.5),
      0.15 * Math.sin(2 * Math.PI * t),
      0.1 * Math.sin(2 * Math.PI * t + 1),
      0.1 * Math.cos(2 * Math.PI * t),
    ]
    for (let j = 0; j < armDims; j++) out.data[k * dA + j] = clamp1(values[j])
    out.data[k * dA + dA - 1] = k >= closeFrom ? 1 : -1
  }
  return out
}
