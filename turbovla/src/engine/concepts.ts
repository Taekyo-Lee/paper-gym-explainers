// 개념 채널과 차원 배치 (caveat concept-channels).
// 실제 모델의 feature에는 이런 구획이 없다. 설명을 위해 d = 256을 아래처럼 나눠 쓴다.

export const D = 256

/** 0–23: 사람이 읽을 수 있는 개념 채널 */
export const CONCEPT_SLOTS = 24
/** 32–127: 질감 (물체와 단어의 고유 무늬) */
export const TEXTURE_RANGE: readonly [number, number] = [32, 128]
/** 128–223: 위치 (E_pos) */
export const POSITION_RANGE: readonly [number, number] = [128, 224]
/** 224–255: 카메라 (e_view) */
export const VIEW_RANGE: readonly [number, number] = [224, 256]

export type ConceptGroup = 'object' | 'color' | 'spatial' | 'action' | 'relation' | 'state'

export interface Concept {
  name: string
  group: ConceptGroup
}

/** 개념 채널 목록. 순서가 곧 채널 번호다. */
export const CONCEPTS: readonly Concept[] = [
  { name: 'bowl', group: 'object' },
  { name: 'plate', group: 'object' },
  { name: 'table', group: 'object' },
  { name: 'gripper', group: 'object' },
  { name: 'pink', group: 'color' },
  { name: 'blue', group: 'color' },
  { name: 'green', group: 'color' },
  { name: 'white', group: 'color' },
  { name: 'left', group: 'spatial' },
  { name: 'right', group: 'spatial' },
  { name: 'far', group: 'spatial' },
  { name: 'near', group: 'spatial' },
  { name: 'stack', group: 'action' },
  { name: 'pick', group: 'action' },
  { name: 'place', group: 'action' },
  { name: 'push', group: 'action' },
  { name: 'on', group: 'relation' },
  { name: 'in', group: 'relation' },
  { name: 'many', group: 'relation' },
  { name: 'proprio', group: 'state' },
]

if (CONCEPTS.length > CONCEPT_SLOTS) throw new Error('too many concepts for the concept slots')

const INDEX = new Map(CONCEPTS.map((c, i) => [c.name, i]))

export function conceptIndex(name: string): number {
  const index = INDEX.get(name)
  if (index === undefined) throw new Error(`unknown concept ${name}`)
  return index
}

export function conceptsInGroups(groups: readonly ConceptGroup[]): number[] {
  return CONCEPTS.flatMap((c, i) => (groups.includes(c.group) ? [i] : []))
}

/** 단어 → 개념 (소문자 기준). 사전에 없는 단어는 개념 없이 질감만 갖는다. */
const LEXICON: Record<string, Record<string, number>> = {
  bowl: { bowl: 1 },
  bowls: { bowl: 1, many: 0.6 },
  plate: { plate: 1 },
  plates: { plate: 1, many: 0.6 },
  table: { table: 1 },
  gripper: { gripper: 1 },
  pink: { pink: 1 },
  blue: { blue: 1 },
  green: { green: 1 },
  white: { white: 1 },
  left: { left: 1 },
  right: { right: 1 },
  back: { far: 1 },
  far: { far: 1 },
  front: { near: 1 },
  near: { near: 1 },
  stack: { stack: 1 },
  pick: { pick: 1 },
  grab: { pick: 1 },
  up: { pick: 0.4 },
  place: { place: 1 },
  put: { place: 1 },
  move: { place: 0.6 },
  push: { push: 1 },
  on: { on: 1 },
  onto: { on: 1 },
  top: { on: 0.6, far: 0.4 },
  in: { in: 1 },
  into: { in: 1 },
  inside: { in: 1 },
  three: { many: 1 },
  all: { many: 0.8 },
}

export function wordConcepts(word: string): Record<string, number> {
  return LEXICON[word] ?? {}
}

/** 개념 묶음을 head에 나눠 주는 규칙 (caveat head-roles). 빈 배열이면 잡음만 보는 head다. */
export function headGroups(heads: number, kind: 'interaction' | 'decoder'): ConceptGroup[][] {
  if (kind === 'decoder') {
    // decoder 8 heads: 물체, 색, 동작, 관계, 위치, state, 잡음 두 개
    const roles: ConceptGroup[][] = [['object'], ['color'], ['action'], ['relation'], ['spatial'], ['state'], [], []]
    return Array.from({ length: heads }, (_, h) => roles[h % roles.length])
  }
  switch (heads) {
    case 1:
      return [['object', 'color', 'spatial', 'action', 'relation']]
    case 2:
      return [['object', 'color'], ['spatial', 'action', 'relation']]
    case 4:
      return [['object', 'color'], ['spatial'], ['action', 'relation'], []]
    case 8:
      return [['object'], ['color'], ['spatial'], ['action'], ['relation'], [], [], []]
    default:
      throw new Error(`unsupported head count ${heads}`)
  }
}
