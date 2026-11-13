<script lang="ts">
  // 벡터 하나를 가로 색 띠로 그린다. 칸에 마우스를 올리면 차원 번호, 개념 이름, 값을 보여 준다.
  import { CONCEPTS } from '../../engine/concepts'
  import { copyFor, num } from '../../content/i18n'
  import { ui } from '../../state/store.svelte'
  import { valueColor, valueScale, type RGB } from './color'

  let {
    values,
    width,
    height = 16,
    limit,
    label,
  }: {
    values: Float32Array
    width: number
    height?: number
    /** 색 끝값. 비교할 띠끼리 같은 값을 써야 한다 */
    limit: number
    label: string
  } = $props()

  const c = $derived(copyFor(ui.lang))
  let canvas: HTMLCanvasElement | undefined = $state()
  let hover: number | null = $state(null)

  $effect(() => {
    void ui.theme
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const W = Math.round(width * dpr)
    const H = Math.round(height * dpr)
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = valueScale(limit)
    const color: RGB = [0, 0, 0]
    const n = values.length
    for (let i = 0; i < n; i++) {
      valueColor(values[i], scale, color)
      ctx.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`
      const x0 = Math.floor((i * W) / n)
      const x1 = Math.floor(((i + 1) * W) / n)
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), H)
    }
  })

  function indexAt(event: PointerEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return Math.max(0, Math.min(values.length - 1, Math.floor(((event.clientX - rect.left) / rect.width) * values.length)))
  }

  const tip = $derived.by(() => {
    if (hover === null) return ''
    const concept = hover < CONCEPTS.length ? ` ${CONCEPTS[hover].name}` : ''
    return `${c.viz.dim} ${hover}${concept}: ${num(values[hover])}`
  })
</script>

<div
  class="strip"
  style:width="{width}px"
  role="img"
  aria-label={label}
  onpointermove={(e) => (hover = indexAt(e))}
  onpointerleave={() => (hover = null)}
>
  <canvas bind:this={canvas} style:width="{width}px" style:height="{height}px" aria-hidden="true"></canvas>
  {#if hover !== null}
    <span class="cursor" style:left="{((hover + 0.5) / values.length) * 100}%"></span>
    <span class="tip">{tip}</span>
  {/if}
</div>

<style>
  .strip {
    position: relative;
    flex: none;
  }

  canvas {
    display: block;
    outline: 1px solid var(--line);
    cursor: crosshair;
  }

  .cursor {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    margin-left: -1px;
    background: var(--accent);
    pointer-events: none;
  }

  .tip {
    position: absolute;
    right: 0;
    bottom: calc(100% + 4px);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    background: var(--ink);
    color: var(--bg);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
  }
</style>
