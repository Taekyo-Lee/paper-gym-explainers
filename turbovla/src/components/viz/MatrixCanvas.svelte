<script module lang="ts">
  export interface RowGroup {
    start: number
    end: number
    /** CSS 색 (예: var(--vision)) */
    color: string
    label: string
  }
</script>

<script lang="ts">
  // 큰 행렬을 canvas heatmap으로 그린다. 512 × 256처럼 크면 화면 크기에 맞춰 블록 평균으로 줄여 그리고,
  // 그때는 마우스를 올린 행(없으면 고른 행)을 아래에 확대한 띠로 따로 보여 준다.
  import { copyFor, fmt } from '../../content/i18n'
  import { rowView, type Tensor } from '../../engine/tensor'
  import { ui } from '../../state/store.svelte'
  import { robustLimit, valueColor, valueScale, type RGB, type ScaleKind } from './color'
  import VectorStrip from './VectorStrip.svelte'

  let {
    tensor,
    width,
    height,
    rowGroups = [],
    groupLabels = false,
    selectedRow = null,
    selectedCol = null,
    onRowSelect,
    onCellClick,
    rowText,
    label,
    limit = null,
    scale = 'value',
    zoom = true,
  }: {
    tensor: Tensor
    width: number
    height: number
    rowGroups?: RowGroup[]
    /** 행 그룹 이름(예: view 이름)을 막대 옆에 글자로도 보여 준다 */
    groupLabels?: boolean
    selectedRow?: number | null
    /** 열 표시 (예: attention 행렬에서 고른 단어나 patch) */
    selectedCol?: number | null
    /** 키보드(↑/↓)와 클릭으로 행을 고른다 */
    onRowSelect?: (row: number) => void
    /** 있으면 클릭이 행과 열을 함께 넘긴다 (onRowSelect와 함께 쓴다: 키보드는 행만 옮긴다) */
    onCellClick?: (row: number, col: number) => void
    /** 행 하나를 말로 (화면 낭독기와 확대 띠의 이름). 없으면 행 번호 */
    rowText?: (row: number) => string
    /** 화면 낭독기용 설명 */
    label: string
    /** 색 끝값. 없으면 이 행렬의 절댓값 99 백분위수 */
    limit?: number | null
    /** 색 스케일: 부호 있는 값(value) 또는 attention용 모달리티 단색 */
    scale?: ScaleKind
    /** 줄여 그렸을 때 확대 띠를 보일지 */
    zoom?: boolean
  } = $props()

  const c = $derived(copyFor(ui.lang))
  // 부모가 새 trace를 받아도 같은 텐서면 다시 그리지 않는다 ($derived는 === 로 비교한다)
  const src = $derived(tensor)
  const usedLimit = $derived(limit ?? robustLimit(src.data))
  /** 행이 화면 픽셀보다 많아 줄여 그렸는가 */
  const shrunk = $derived(src.rows > height)

  let canvas: HTMLCanvasElement | undefined = $state()
  let hoverRow: number | null = $state(null)

  $effect(() => {
    void ui.theme // 테마가 바뀌면 토큰 색이 바뀌므로 다시 그린다
    if (canvas) draw(canvas, src, width, height, usedLimit, scale)
  })

  function draw(target: HTMLCanvasElement, t: Tensor, w: number, h: number, colorLimit: number, kind: ScaleKind) {
    const dpr = window.devicePixelRatio || 1
    const W = Math.max(1, Math.round(w * dpr))
    const H = Math.max(1, Math.round(h * dpr))
    target.width = W
    target.height = H
    const ctx = target.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(W, H)
    const colors = valueScale(colorLimit, kind)
    const color: RGB = [0, 0, 0]
    const { rows, cols, data } = t
    for (let y = 0; y < H; y++) {
      const r0 = Math.floor((y * rows) / H)
      const r1 = Math.max(r0 + 1, Math.floor(((y + 1) * rows) / H))
      for (let x = 0; x < W; x++) {
        const c0 = Math.floor((x * cols) / W)
        const c1 = Math.max(c0 + 1, Math.floor(((x + 1) * cols) / W))
        let sum = 0
        let n = 0
        for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++, n++) sum += data[r * cols + c]
        valueColor(sum / n, colors, color)
        const o = (y * W + x) * 4
        image.data[o] = color[0]
        image.data[o + 1] = color[1]
        image.data[o + 2] = color[2]
        image.data[o + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  }

  function rowAt(event: MouseEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return Math.max(0, Math.min(src.rows - 1, Math.floor(((event.clientY - rect.top) / rect.height) * src.rows)))
  }

  function colAt(event: MouseEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return Math.max(0, Math.min(src.cols - 1, Math.floor(((event.clientX - rect.left) / rect.width) * src.cols)))
  }

  function onclick(event: MouseEvent) {
    if (onCellClick) onCellClick(rowAt(event), colAt(event))
    else onRowSelect?.(rowAt(event))
  }

  /** ↑/↓(또는 ←/→), PageUp/PageDown, Home/End로 행을 고른다 (마우스 없이도 쓸 수 있게) */
  function onkeydown(event: KeyboardEvent) {
    if (!onRowSelect) return
    const current = selectedRow ?? 0
    const page = Math.max(1, Math.round(src.rows / 16))
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight' ? current + 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? current - 1
      : event.key === 'PageDown' ? current + page
      : event.key === 'PageUp' ? current - page
      : event.key === 'Home' ? 0
      : event.key === 'End' ? src.rows - 1
      : null
    if (next === null) return
    event.preventDefault()
    onRowSelect(Math.max(0, Math.min(src.rows - 1, next)))
  }

  const describe = (row: number) => (rowText ? rowText(row) : fmt(c.viz.row, { r: row }))
  const rowTop = (row: number) => (row / src.rows) * height
  const rowHeight = $derived(Math.max(2, height / src.rows))
  const colLeft = (col: number) => (col / src.cols) * width
  const colWidth = $derived(Math.max(2, width / src.cols))
  const zoomRow = $derived(hoverRow ?? selectedRow)
</script>

<div class="matrix">
  <div class="main">
    {#if rowGroups.length}
      {#if groupLabels}
        <div class="glabels" style:height="{height}px" aria-hidden="true">
          {#each rowGroups as g (g.start)}
            <span class="glabel" style:top="{rowTop(g.start)}px" style:height="{rowTop(g.end) - rowTop(g.start)}px">{g.label}</span>
          {/each}
        </div>
      {/if}
      <div class="groups" style:height="{height}px">
        {#each rowGroups as g (g.start)}
          <span
            class="group"
            style:top="{rowTop(g.start)}px"
            style:height="{rowTop(g.end) - rowTop(g.start)}px"
            style:background={g.color}
            title={g.label}
          ></span>
        {/each}
      </div>
    {/if}
    {#if onRowSelect}
      <div
        class="plot pickable"
        style:width="{width}px"
        style:height="{height}px"
        role="slider"
        tabindex="0"
        data-arrow-keys
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={src.rows - 1}
        aria-valuenow={selectedRow ?? 0}
        aria-valuetext={selectedRow !== null ? describe(selectedRow) : undefined}
        {onkeydown}
        onpointermove={(e) => (hoverRow = rowAt(e))}
        onpointerleave={() => (hoverRow = null)}
        {onclick}
      >
        <canvas bind:this={canvas} class="clickable" style:width="{width}px" style:height="{height}px"></canvas>
        {@render marks()}
      </div>
    {:else}
      <div class="plot" style:width="{width}px" style:height="{height}px" role="img" aria-label={label}>
        <canvas bind:this={canvas} style:width="{width}px" style:height="{height}px" aria-hidden="true"></canvas>
        {@render marks()}
      </div>
    {/if}
  </div>

  {#if zoom && shrunk}
    <!-- 줄여 그린 행렬에서는 한 행이 1픽셀도 안 되므로, 그 행을 띠로 크게 보여 준다 -->
    <div class="zoom" style:width="{width}px">
      {#if zoomRow !== null}
        <VectorStrip values={rowView(src, zoomRow)} {width} height={12} limit={usedLimit} label={describe(zoomRow)} />
        <span class="zoom-label">{fmt(c.viz.zoomRow, { row: describe(zoomRow) })}</span>
      {/if}
    </div>
  {/if}
</div>

{#snippet marks()}
  {#if hoverRow !== null && onRowSelect}
    <span class="row hover" style:top="{rowTop(hoverRow)}px" style:height="{rowHeight}px"></span>
  {/if}
  {#if selectedRow !== null}
    <span class="row selected" style:top="{rowTop(selectedRow)}px" style:height="{rowHeight}px"></span>
  {/if}
  {#if selectedCol !== null}
    <span class="col selected" style:left="{colLeft(selectedCol)}px" style:width="{colWidth}px"></span>
  {/if}
{/snippet}

<style>
  .matrix {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex: none;
  }

  .main {
    display: flex;
    gap: 4px;
  }

  .groups {
    position: relative;
    width: 6px;
    flex: none;
  }

  .group {
    position: absolute;
    left: 0;
    width: 6px;
    border-radius: 2px;
    border-bottom: 2px solid var(--card);
  }

  .glabels {
    position: relative;
    width: 16px;
    flex: none;
  }

  .glabel {
    position: absolute;
    left: 0;
    width: 16px;
    box-sizing: border-box;
    /* RoboTwin은 view 세 개라 칸이 짧다: 이름이 잘려 "right w…"가 되지 않게 넘쳐도 그대로 보인다 */
    overflow: visible;
    color: var(--vision-ink);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 16px;
    text-align: center;
    white-space: nowrap;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }

  .plot {
    position: relative;
    flex: none;
    outline: 1px solid var(--line);
  }

  /* 위의 얇은 테두리(outline)가 base.css의 :focus-visible을 덮지 않게 한다 */
  .plot.pickable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  canvas {
    display: block;
  }

  .clickable {
    cursor: crosshair;
  }

  .row {
    position: absolute;
    left: -3px;
    right: -3px;
    pointer-events: none;
  }

  .row.hover {
    outline: 1px solid var(--muted);
  }

  .row.selected {
    outline: 2px solid var(--accent);
  }

  .col {
    position: absolute;
    top: -3px;
    bottom: -3px;
    pointer-events: none;
  }

  .col.selected {
    outline: 2px dashed var(--accent);
  }

  .zoom {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 34px;
  }

  .zoom-label {
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.3;
  }
</style>
