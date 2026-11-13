<script lang="ts">
  // 토큰 수가 적은 attention 행렬(예: 지시 토큰끼리의 self-attention, N_l × N_l)을 칸마다 그린다.
  // 행과 열에 토큰 이름을 달고, mask로 가린 칸은 빗금으로 구분한다 (값이 0에 가까운 칸과 다르다).
  import { copyFor, fmt } from '../../content/i18n'
  import type { Tensor } from '../../engine/tensor'
  import { ui } from '../../state/store.svelte'
  import { rgbString, valueColor, valueScale, type ScaleKind } from './color'

  let {
    values,
    labels,
    allowed = null,
    selectedRow = null,
    label,
    size = 220,
    scale = 'language',
    showColLabels = false,
  }: {
    values: Tensor
    labels: string[]
    /** 1 = 볼 수 있는 칸 (행 우선). 없으면 모두 볼 수 있음 */
    allowed?: Uint8Array | null
    selectedRow?: number | null
    /** 화면 낭독기용 설명 */
    label: string
    /** 칸 영역의 최대 한 변 (px) */
    size?: number
    scale?: ScaleKind
    /** 열 이름을 기울여 단다 (높이가 56px 더 든다). 없으면 열 순서가 행과 같다고 옆 설명에 적는다 */
    showColLabels?: boolean
  } = $props()

  const c = $derived(copyFor(ui.lang))
  const n = $derived(values.rows)
  /**
   * 칸 한 변. 15px 아래로는 줄이지 않는다: 행 이름(13px 글자)이 칸 높이보다 크면 글자가 잘리거나 겹친다.
   * 토큰이 많으면 그리드가 size보다 커지고, 패널 안에서 세로로 스크롤된다.
   */
  const cell = $derived(Math.max(15, Math.min(26, Math.floor(size / n))))
  /** 행 이름이 길면 줄인다 (세로로 자르지 않고 가로로만) */
  const short = (name: string) => (name.length > 10 ? `${name.slice(0, 9)}…` : name)
  /** 열 이름은 요청했고 칸이 충분히 클 때만 단다 (열 순서는 행과 같다) */
  const colLabels = $derived(showColLabels && cell >= 16)
  // attention은 0–1이므로 끝값을 1로 고정한다: 색의 진하기가 곧 attention 값이다
  const colors = $derived.by(() => {
    void ui.theme
    const s = valueScale(1, scale)
    return Array.from(values.data, (v) => rgbString(valueColor(v, s)))
  })
</script>

<div class="grid" style:--cell="{cell}px" style:--n={n} role="img" aria-label={label}>
  {#if colLabels}
    <span></span>
    {#each labels as l, ci (ci)}
      <span class="col-label" lang="en" aria-hidden="true"><span>{short(l)}</span></span>
    {/each}
  {/if}
  {#each labels as l, r (r)}
    <span class="row-label" class:selected={r === selectedRow} lang="en" aria-hidden="true">{short(l)}</span>
    {#each labels as _, col (col)}
      {@const i = r * n + col}
      <span
        class="cell"
        class:masked={allowed !== null && allowed[i] === 0}
        class:row-selected={r === selectedRow}
        style:background={allowed !== null && allowed[i] === 0 ? undefined : colors[i]}
        title={fmt(c.interaction.cellTip, { row: labels[r], col: labels[col], v: values.data[i].toFixed(2) })}
        aria-hidden="true"
      ></span>
    {/each}
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: max-content repeat(var(--n), var(--cell));
    grid-auto-rows: var(--cell);
    align-items: center;
    width: max-content;
  }

  .col-label {
    position: relative;
    align-self: end;
    height: 56px;
  }

  .col-label span {
    position: absolute;
    bottom: 4px;
    left: 50%;
    color: var(--muted);
    font-size: var(--fs-xs);
    white-space: nowrap;
    transform: rotate(-55deg);
    transform-origin: left bottom;
  }

  /* 세로로 자르지 않는다 (overflow: hidden이면 13px 글자의 아래쪽이 잘린다). 긴 이름은 short()가 줄인다 */
  .row-label {
    padding-right: 6px;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: var(--cell);
    text-align: right;
    white-space: nowrap;
  }

  .row-label.selected {
    color: var(--ink);
    font-weight: 700;
  }

  .cell {
    width: var(--cell);
    height: var(--cell);
    box-shadow: inset 0 0 0 0.5px var(--card);
  }

  /* 가린 칸: 글자색(--muted) 빗금이라 값이 0에 가까운 칸과 확실히 구분된다 */
  .cell.masked {
    background: repeating-linear-gradient(135deg, var(--muted) 0 1px, var(--card) 1px 4px);
  }

  .cell.row-selected {
    box-shadow:
      inset 0 2px 0 var(--accent),
      inset 0 -2px 0 var(--accent);
  }
</style>
