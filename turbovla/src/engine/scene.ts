// 설명용 장면: 탁상 위 그릇 세 개와 접시, 그리퍼.
// 좌표: 탁상을 위에서 본 [0, 1] × [0, 1]. x는 왼쪽 → 오른쪽, y는 먼 쪽(0) → 로봇 쪽(1).
// 장면 SVG도 이 좌표와 view 정의를 그대로 써서, 그림과 patch 계산이 어긋나지 않게 한다.

import type { Config, ObjectId, ViewInfo } from './types'

export interface SceneObject {
  id: ObjectId
  kind: 'bowl' | 'plate' | 'gripper'
  color: 'pink' | 'blue' | 'green' | 'white' | null
  center: [number, number]
  /** 원(그릇, 접시)의 반지름 */
  radius?: number
  /** 직사각형(그리퍼)의 가로, 세로 */
  size?: [number, number]
}

export const SCENE: readonly SceneObject[] = [
  { id: 'plate', kind: 'plate', color: 'white', center: [0.5, 0.25], radius: 0.13 },
  { id: 'pinkBowl', kind: 'bowl', color: 'pink', center: [0.22, 0.55], radius: 0.09 },
  { id: 'blueBowl', kind: 'bowl', color: 'blue', center: [0.5, 0.63], radius: 0.09 },
  { id: 'greenBowl', kind: 'bowl', color: 'green', center: [0.78, 0.52], radius: 0.09 },
  { id: 'gripper', kind: 'gripper', color: null, center: [0.64, 0.88], size: [0.12, 0.08] },
]

/** 그리기 순서와 반대: 위에 있는 물체부터 맞춰 본다 */
const HIT_ORDER: readonly SceneObject[] = [...SCENE].reverse()

export function objectById(id: ObjectId): SceneObject | undefined {
  return SCENE.find((o) => o.id === id)
}

export function objectArea(o: SceneObject): number {
  if (o.radius !== undefined) return Math.PI * o.radius * o.radius
  const [w, h] = o.size ?? [0, 0]
  return w * h
}

function hits(o: SceneObject, x: number, y: number): boolean {
  if (o.radius !== undefined) {
    const dx = x - o.center[0]
    const dy = y - o.center[1]
    return dx * dx + dy * dy <= o.radius * o.radius
  }
  const [w, h] = o.size ?? [0, 0]
  return Math.abs(x - o.center[0]) <= w / 2 && Math.abs(y - o.center[1]) <= h / 2
}

/** 장면 한 점에 보이는 물체 (없으면 table) */
export function objectAt(x: number, y: number): ObjectId {
  for (const o of HIT_ORDER) if (hits(o, x, y)) return o.id
  return 'table'
}

interface ViewDef {
  name: string
  center: [number, number]
  span: number
}

const PRIMARY: ViewDef = { name: 'primary', center: [0.5, 0.5], span: 1.05 }
const WRIST: ViewDef = { name: 'wrist', center: [0.6, 0.66], span: 0.5 }
const HEAD: ViewDef = { name: 'head', center: [0.5, 0.48], span: 1.1 }
const LEFT_WRIST: ViewDef = { name: 'left wrist', center: [0.3, 0.55], span: 0.5 }
const RIGHT_WRIST: ViewDef = { name: 'right wrist', center: [0.72, 0.55], span: 0.5 }

/** 카메라 view 목록. LIBERO는 [primary, wrist], RoboTwin은 [head, left wrist, right wrist] 순서다. */
export function viewsFor(config: Config): ViewInfo[] {
  const defs =
    config.K === 3 || config.profile === 'robotwin'
      ? [HEAD, LEFT_WRIST, RIGHT_WRIST].slice(0, config.K)
      : [PRIMARY, WRIST].slice(0, config.K)
  const grid = config.imageSize / config.patchSize
  return defs.map((v) => ({ name: v.name, center: v.center, span: v.span, grid }))
}

/** view 이미지의 (u, v) ∈ [0, 1]² → 장면 좌표 */
export function viewToScene(view: ViewInfo, u: number, v: number): [number, number] {
  return [view.center[0] + (u - 0.5) * view.span, view.center[1] + (v - 0.5) * view.span]
}

export interface PatchInfo {
  gx: number
  gy: number
  /** patch 중심의 장면 좌표 */
  center: [number, number]
  coverage: Partial<Record<ObjectId, number>>
}

const SAMPLES = 4

/** view 하나의 patch 격자. patch마다 4 × 4 점을 찍어 물체별 면적 비율을 잰다. */
export function patchesOf(view: ViewInfo): PatchInfo[] {
  const out: PatchInfo[] = []
  const g = view.grid
  for (let gy = 0; gy < g; gy++) {
    for (let gx = 0; gx < g; gx++) {
      const coverage: Partial<Record<ObjectId, number>> = {}
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const [x, y] = viewToScene(view, (gx + (sx + 0.5) / SAMPLES) / g, (gy + (sy + 0.5) / SAMPLES) / g)
          const id = objectAt(x, y)
          coverage[id] = (coverage[id] ?? 0) + 1 / (SAMPLES * SAMPLES)
        }
      }
      out.push({ gx, gy, center: viewToScene(view, (gx + 0.5) / g, (gy + 0.5) / g), coverage })
    }
  }
  return out
}

/** 면적 비율이 가장 큰 물체. 탁상이 아닌 물체가 30% 넘게 보이면 그 물체를 고른다. */
export function dominantObject(coverage: Partial<Record<ObjectId, number>>): ObjectId {
  let best: ObjectId = 'table'
  let bestValue = 0.3
  for (const [id, value] of Object.entries(coverage) as [ObjectId, number][]) {
    if (id !== 'table' && value > bestValue) {
      best = id
      bestValue = value
    }
  }
  return best
}
