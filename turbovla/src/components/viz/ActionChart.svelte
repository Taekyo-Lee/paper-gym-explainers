<script lang="ts">
  // action 차원 하나의 작은 선 그래프 (small multiple). 가로축은 step t … t+H−1, 세로축은 값.
  // gripper는 두 값 사이의 계단 그래프다. 마우스와 키보드는 부모(OutputStage)가 그래프 묶음 전체에서 받는다.
  // 선은 action 색(주황) 2px, 격자는 1px hairline (dataviz 규칙). 가로축 끝(t, t+H−1)은 그래프마다 단다.
  import { num } from '../../content/i18n'
  let {
    values,
    label,
    step = false,
    yMin = -1,
    yMax = 1,
    width,
    height = 84,
    hover = null,
    selected = null,
    xEnd = '',
  }: {
    values: Float32Array
    label: string
    /** 계단 그래프 (gripper) */
    step?: boolean
    yMin?: number
    yMax?: number
    width: number
    height?: number
    hover?: number | null
    selected?: number | null
    /** 가로축 오른쪽 끝 이름 (예: t+11). 왼쪽 끝은 t */
    xEnd?: string
  } = $props()

  const PAD = 5
  const n = $derived(values.length)
  const w = $derived(width - 2 * PAD)
  const h = $derived(height - 2 * PAD)
  const x = (k: number) => PAD + (n > 1 ? (k / (n - 1)) * w : w / 2)
  const y = (v: number) => PAD + ((yMax - Math.max(yMin, Math.min(yMax, v))) / (yMax - yMin)) * h

  const path = $derived.by(() => {
    if (!n) return ''
    let d = `M${x(0)},${y(values[0])}`
    for (let k = 1; k < n; k++) {
      d += step ? `H${x(k)}V${y(values[k])}` : `L${x(k)},${y(values[k])}`
    }
    return d
  })
  const gridValues = $derived([yMax, ...(yMin < 0 && yMax > 0 ? [0] : []), yMin])
  const focus = $derived(hover ?? selected)
</script>

<div class="panel">
  <div class="head">
    <span class="name">{label}</span>
    {#if focus !== null && focus < n}<span class="value">{num(values[focus])}</span>{/if}
  </div>
  <svg {width} {height} data-plot data-pad={PAD} aria-hidden="true">
    {#each gridValues as g (g)}
      <line class="grid" class:zero={g === 0} x1={PAD} x2={width - PAD} y1={y(g)} y2={y(g)} />
    {/each}
    {#if selected !== null && selected < n}
      <line class="sel" x1={x(selected)} x2={x(selected)} y1={PAD} y2={height - PAD} />
    {/if}
    {#if hover !== null && hover < n}
      <line class="cross" x1={x(hover)} x2={x(hover)} y1={PAD} y2={height - PAD} />
    {/if}
    <path class="line" d={path} />
    {#if focus !== null && focus < n}
      <circle class="dot" cx={x(focus)} cy={y(values[focus])} r="4" />
    {/if}
  </svg>
  {#if xEnd}
    <div class="xaxis" aria-hidden="true"><span>t</span><span>{xEnd}</span></div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* 값을 제 이름 바로 뒤에 둔다 (오른쪽 끝에 두면 다음 그래프의 이름과 더 가까워 보인다) */
  .head {
    display: flex;
    justify-content: flex-start;
    gap: 6px;
    font-size: var(--fs-xs);
    line-height: 1.3;
    white-space: nowrap;
  }

  .name {
    overflow: hidden;
    color: var(--muted);
    text-overflow: ellipsis;
  }

  .value {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .xaxis {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.2;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .grid.zero {
    stroke: var(--line-strong);
  }

  .sel {
    stroke: var(--accent);
    stroke-width: 1;
  }

  .cross {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .dot {
    fill: var(--accent);
    stroke: var(--card);
    stroke-width: 2;
  }
</style>
