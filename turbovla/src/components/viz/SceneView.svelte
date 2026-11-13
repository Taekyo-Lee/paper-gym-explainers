<script lang="ts">
  // 장면을 카메라 view 하나로 그린다.
  // viewBox를 엔진의 view 정의(중심, 한 변 길이)와 같게 잡아서, 그림의 patch 격자가 엔진이 계산한 patch와 정확히 겹친다.
  // 같은 컴포넌트 위에 attention heatmap을 겹친다 (heat, 투명도 = attention 값).
  import { SCENE } from '../../engine/scene'
  import type { ViewInfo } from '../../engine/types'

  let {
    view,
    size,
    grid = false,
    selected = null,
    heat = null,
    heatColor = 'var(--accent)',
    onPatch,
    label,
    valueText,
    roleDescription,
  }: {
    view: ViewInfo
    size: number
    grid?: boolean
    selected?: { gx: number; gy: number } | null
    /** patch마다 0–1 값 (grid × grid, 행 우선). attention overlay */
    heat?: Float32Array | null
    /** heatmap 색. attention은 Query 쪽 모달리티 색 (예: var(--vision)) */
    heatColor?: string
    onPatch?: (gx: number, gy: number) => void
    label: string
    /** 고를 수 있을 때: 지금 고른 patch를 말로 (화면 낭독기용) */
    valueText?: string
    /** 고를 수 있을 때: "patch 격자"처럼 이 조작이 무엇인지 */
    roleDescription?: string
  } = $props()

  const x0 = $derived(view.center[0] - view.span / 2)
  const y0 = $derived(view.center[1] - view.span / 2)
  const cell = $derived(view.span / view.grid)
  const lines = $derived(Array.from({ length: view.grid - 1 }, (_, i) => (i + 1) * cell))
  let svg: SVGSVGElement | undefined = $state()

  function patchAt(event: MouseEvent): [number, number] | null {
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
    const gx = Math.floor((p.x - x0) / cell)
    const gy = Math.floor((p.y - y0) / cell)
    if (gx < 0 || gy < 0 || gx >= view.grid || gy >= view.grid) return null
    return [gx, gy]
  }

  function onclick(event: MouseEvent) {
    const p = patchAt(event)
    if (p && onPatch) onPatch(p[0], p[1])
  }

  /** 화살표 키로 고른 patch를 옮긴다 */
  function onkeydown(event: KeyboardEvent) {
    if (!onPatch) return
    const g = view.grid
    const cur = selected ?? { gx: Math.floor(g / 2), gy: Math.floor(g / 2) }
    const move: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const d = move[event.key]
    if (!d) return
    event.preventDefault()
    onPatch(Math.max(0, Math.min(g - 1, cur.gx + d[0])), Math.max(0, Math.min(g - 1, cur.gy + d[1])))
  }
</script>

{#if onPatch}
  <svg
    bind:this={svg}
    class="scene pickable"
    width={size}
    height={size}
    viewBox="{x0} {y0} {view.span} {view.span}"
    role="slider"
    aria-roledescription={roleDescription}
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={view.grid * view.grid - 1}
    aria-valuenow={selected ? selected.gy * view.grid + selected.gx : 0}
    aria-valuetext={valueText ?? (selected ? `(${selected.gx}, ${selected.gy})` : undefined)}
    tabindex="0"
    data-arrow-keys
    {onclick}
    {onkeydown}
  >
    {@render content()}
  </svg>
{:else}
  <svg class="scene" width={size} height={size} viewBox="{x0} {y0} {view.span} {view.span}" role="img" aria-label={label}>
    {@render content()}
  </svg>
{/if}

{#snippet content()}
  <rect class="table" x={x0 - 1} y={y0 - 1} width={view.span + 2} height={view.span + 2} />
  <rect class="table-edge" x="0" y="0" width="1" height="1" />
  {#each SCENE as o (o.id)}
    {#if o.kind === 'plate'}
      <circle class="plate" cx={o.center[0]} cy={o.center[1]} r={o.radius} />
      <circle class="plate-inner" cx={o.center[0]} cy={o.center[1]} r={(o.radius ?? 0) * 0.68} />
    {:else if o.kind === 'bowl'}
      <circle class="bowl {o.color}" cx={o.center[0]} cy={o.center[1]} r={o.radius} />
      <circle class="bowl-inside" cx={o.center[0]} cy={o.center[1]} r={(o.radius ?? 0) * 0.66} />
    {:else if o.size}
      {@const [w, h] = o.size}
      <rect class="gripper" x={o.center[0] - w / 2} y={o.center[1] - h / 2} width={w} height={h} rx={0.012} />
      <rect class="finger" x={o.center[0] - w * 0.38} y={o.center[1] - h / 2} width={w * 0.16} height={h * 0.62} rx={0.006} />
      <rect class="finger" x={o.center[0] + w * 0.22} y={o.center[1] - h / 2} width={w * 0.16} height={h * 0.62} rx={0.006} />
    {/if}
  {/each}

  {#if heat}
    {#each heat as value, i (i)}
      {#if value > 0.02}
        <rect
          class="heat"
          x={x0 + (i % view.grid) * cell}
          y={y0 + Math.floor(i / view.grid) * cell}
          width={cell}
          height={cell}
          style:opacity={Math.min(0.85, value)}
          style:fill={heatColor}
        />
      {/if}
    {/each}
  {/if}

  {#if grid}
    <g class="grid">
      {#each lines as l (l)}
        <line x1={x0 + l} y1={y0} x2={x0 + l} y2={y0 + view.span} />
        <line x1={x0} y1={y0 + l} x2={x0 + view.span} y2={y0 + l} />
      {/each}
    </g>
  {/if}

  {#if selected}
    <rect class="selected" x={x0 + selected.gx * cell} y={y0 + selected.gy * cell} width={cell} height={cell} />
  {/if}
{/snippet}

<style>
  .scene {
    display: block;
    flex: none;
    border-radius: var(--radius-sm);
    outline: 1px solid var(--line);
  }

  .pickable {
    cursor: pointer;
  }

  /* 위의 얇은 테두리(outline)가 base.css의 :focus-visible을 덮지 않게 한다 */
  .pickable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .table {
    fill: var(--scene-table);
  }

  .table-edge {
    fill: none;
    stroke: var(--scene-table-edge);
    stroke-width: 0.01;
  }

  .plate {
    fill: var(--scene-plate);
    stroke: var(--scene-plate-rim);
    stroke-width: 0.008;
  }

  .plate-inner {
    fill: none;
    stroke: var(--scene-plate-rim);
    stroke-width: 0.004;
    opacity: 0.7;
  }

  .bowl.pink {
    fill: var(--scene-pink);
  }

  .bowl.blue {
    fill: var(--scene-blue);
  }

  .bowl.green {
    fill: var(--scene-green);
  }

  .bowl-inside {
    fill: var(--scene-shine);
    opacity: 0.28;
  }

  .gripper {
    fill: var(--scene-gripper);
  }

  .finger {
    fill: var(--scene-shine);
    opacity: 0.22;
  }

  .heat {
    fill: var(--accent);
  }

  .grid line {
    stroke: var(--ink);
    stroke-opacity: 0.18;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .selected {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
  }
</style>
