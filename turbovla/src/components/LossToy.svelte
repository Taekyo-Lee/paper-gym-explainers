<script lang="ts">
  // Loss 장난감 창. 같은 장면의 시연 5개가 조금씩 다른 정답 action chunk를 준다.
  // 한 시연에 튀는 값(outlier)을 넣으면, 시연 전체에 대해 loss 합이 가장 작은 예측이
  // L1이면 step마다 중앙값, L2면 평균이 되어 L2 쪽이 튀는 값에 끌려간다.
  // 논문은 ℓ1을 쓴다고만 한다(§3.4, App. A.3). L2 비교와 중앙값 설명은 세미나 설명이라고 밝힌다.
  // dataviz: 선 2px, 격자 1px, 범례와 직접 이름표, 고른 step의 세로선(crosshair), 값 표.
  import { DIALOG_TEX } from '../content/equations'
  import { copyFor, fmt, num } from '../content/i18n'
  import { AMP_MAX, bestPrediction, column, demoChunks, mean, median, OUTLIER_DEMO, SPIKE_STEP, TOY_DEMOS, TOY_H } from '../engine/lossToy'
  import { ui } from '../state/store.svelte'
  import Tex from './Tex.svelte'

  const W = 460
  const H = 220
  const PAD_L = 34
  const PAD_R = 40
  const PAD_T = 10
  const PAD_B = 24
  const Y_MIN = -0.8
  const Y_MAX = 1.05
  const LINE_W = 340
  const LINE_PAD = 14

  const c = $derived(copyFor(ui.lang))
  let amp = $state(0.6)
  let step = $state(SPIKE_STEP)

  const chunks = $derived(demoChunks(amp))
  const calm = demoChunks(0)
  const l1Pred = $derived(bestPrediction(chunks, 'l1'))
  const l2Pred = $derived(bestPrediction(chunks, 'l2'))
  const ys = $derived(column(chunks, step))
  const med = $derived(median(ys))
  const avg = $derived(mean(ys))
  /** 튀는 값이 없을 때와 비교해 얼마나 움직였나 (고른 step) */
  const medShift = $derived(med - median(column(calm, step)))
  const avgShift = $derived(avg - mean(column(calm, step)))

  const x = (k: number) => PAD_L + (k / (TOY_H - 1)) * (W - PAD_L - PAD_R)
  const y = (v: number) => PAD_T + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - PAD_T - PAD_B)
  const path = (vals: readonly number[]) => vals.map((v, k) => `${k ? 'L' : 'M'}${x(k)},${y(v)}`).join('')
  const GRID = [-0.5, 0, 0.5, 1]

  /**
   * 오른쪽 끝 직접 이름표. 두 선의 끝이 가까우면 이름표를 위아래로 벌리고, 짧은 지시선으로 제 선의 끝과 잇는다.
   * end: 선의 끝 높이, label: 이름표 높이
   */
  const LABEL_GAP = 16
  const ends = $derived.by(() => {
    const a = y(l1Pred[TOY_H - 1])
    const b = y(l2Pred[TOY_H - 1])
    const spread = Math.max(0, (LABEL_GAP - Math.abs(a - b)) / 2)
    const [la, lb] = a <= b ? [a - spread, b + spread] : [a + spread, b - spread]
    return { l1: { end: a, label: la }, l2: { end: b, label: lb } }
  })
  const LABEL_X = W - PAD_R + 16

  /** 수직선 위 위치 (고른 step의 값들) */
  const lx = (v: number) => LINE_PAD + ((v - Y_MIN) / (Y_MAX - Y_MIN)) * (LINE_W - 2 * LINE_PAD)
  const LINE_TICKS = [-0.5, 0, 0.5, 1]
  const AXIS_Y = 70
  /** 시연 점을 놓는 줄 (축 위로 쌓는다) */
  const DOT_ROWS = [59, 47, 35]
  /** 점 지름 9px + 바탕색 테두리 2px */
  const DOT_PITCH = 11

  /** 값 순서대로 훑으며, 앞 점과 DOT_PITCH 이상 떨어진 가장 낮은 줄에 점을 놓는다 (겹치지 않게) */
  const dotY = $derived.by(() => {
    const xs = ys.map(lx)
    const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b])
    const last = DOT_ROWS.map(() => -Infinity)
    const out: number[] = new Array(xs.length)
    for (const i of order) {
      let row = last.findIndex((px) => xs[i] - px >= DOT_PITCH)
      if (row < 0) row = last.indexOf(Math.min(...last))
      last[row] = xs[i]
      out[i] = DOT_ROWS[row]
    }
    return out
  })

  /** 그래프 위 마우스 x → 가장 가까운 step */
  function pick(event: PointerEvent) {
    const svg = event.currentTarget as SVGSVGElement
    const r = svg.getBoundingClientRect()
    const px = ((event.clientX - r.left) / r.width) * W
    const k = Math.round(((px - PAD_L) / (W - PAD_L - PAD_R)) * (TOY_H - 1))
    step = Math.max(0, Math.min(TOY_H - 1, k))
  }
</script>

<p class="lead">{c.loss.lead}</p>

<div class="controls">
  <label class="slider">
    <span>{c.loss.ampLabel}</span>
    <input type="range" min="0" max={AMP_MAX} step="0.05" bind:value={amp} aria-valuetext={num(amp)} />
    <span class="value" aria-hidden="true">{num(amp)}</span>
  </label>
  <label class="slider">
    <span>{c.loss.stepLabel}</span>
    <input type="range" min="0" max={TOY_H - 1} step="1" bind:value={step} aria-valuetext={fmt(c.loss.stepName, { k: step })} />
    <span class="value" aria-hidden="true">{fmt(c.loss.stepName, { k: step })}</span>
  </label>
</div>

<div class="charts">
  <figure class="chunk" style:--chunk-w="{W}px">
    <figcaption>{c.loss.chunkTitle}</figcaption>
    <ul class="legend">
      <li><span class="sw demo"></span>{fmt(c.loss.legendDemos, { n: TOY_DEMOS - 1 })}</li>
      <li><span class="sw outlier"></span>{c.loss.legendOutlier}</li>
      <li><span class="sw l1"></span>{c.loss.legendL1}</li>
      <li><span class="sw l2"></span>{c.loss.legendL2}</li>
    </ul>
    <svg
      width={W}
      height={H}
      role="img"
      aria-label={fmt(c.loss.chartLabel, { k: step, l1: num(l1Pred[step]), l2: num(l2Pred[step]) })}
      onpointermove={pick}
      onpointerdown={pick}
    >
      {#each GRID as g (g)}
        <line class="grid" class:zero={g === 0} x1={PAD_L} x2={W - PAD_R} y1={y(g)} y2={y(g)} />
        <text class="tick" x={PAD_L - 6} y={y(g) + 4} text-anchor="end">{num(g, 1)}</text>
      {/each}
      <line class="cross" x1={x(step)} x2={x(step)} y1={PAD_T} y2={H - PAD_B} />
      {#each chunks as chunk, i (i)}
        <path class="demo" class:outlier={i === OUTLIER_DEMO} d={path(chunk)} />
      {/each}
      <path class="pred l2" d={path(l2Pred)} />
      <path class="pred l1" d={path(l1Pred)} />
      <circle class="pt l2" cx={x(step)} cy={y(l2Pred[step])} r="4" />
      <circle class="pt l1" cx={x(step)} cy={y(l1Pred[step])} r="4" />
      <!-- 직접 이름표 (오른쪽 끝)와 제 선의 끝으로 가는 지시선 -->
      <line class="leader l1" x1={x(TOY_H - 1) + 4} y1={ends.l1.end} x2={LABEL_X - 3} y2={ends.l1.label} />
      <line class="leader l2" x1={x(TOY_H - 1) + 4} y1={ends.l2.end} x2={LABEL_X - 3} y2={ends.l2.label} />
      <text class="direct" x={LABEL_X} y={ends.l1.label + 4.5}>{c.loss.directL1}</text>
      <text class="direct" x={LABEL_X} y={ends.l2.label + 4.5}>{c.loss.directL2}</text>
      <text class="tick" x={x(0)} y={H - 6} text-anchor="middle">t</text>
      <text class="tick" x={x(TOY_H - 1)} y={H - 6} text-anchor="middle">t+{TOY_H - 1}</text>
    </svg>
  </figure>

  <figure class="numberline">
    <figcaption>{fmt(c.loss.lineTitle, { k: step })}</figcaption>
    <svg width={LINE_W} height="132" role="img" aria-label={fmt(c.loss.lineLabel, { l1: num(med), l2: num(avg) })}>
      <!-- 그리는 순서: 표시선 → 축 → 시연 점 → 눈금 글자. 점과 글자가 표시선 위에 오도록 -->
      <!-- L1: 중앙값 (위), L2: 평균 (아래) -->
      <line class="mark l1" x1={lx(med)} x2={lx(med)} y1="24" y2={AXIS_Y} />
      <text class="mark-label" x={lx(med)} y="17" text-anchor="middle">{fmt(c.loss.markL1, { v: num(med) })}</text>
      <line class="mark l2" x1={lx(avg)} x2={lx(avg)} y1={AXIS_Y} y2="108" />
      <text class="mark-label" x={lx(avg)} y="124" text-anchor="middle">{fmt(c.loss.markL2, { v: num(avg) })}</text>
      <line class="axis" x1={LINE_PAD} x2={LINE_W - LINE_PAD} y1={AXIS_Y} y2={AXIS_Y} />
      {#each LINE_TICKS as g (g)}
        <line class="axis" x1={lx(g)} x2={lx(g)} y1={AXIS_Y - 3} y2={AXIS_Y + 3} />
      {/each}
      <!-- 시연 값: 값 순서대로 겹치지 않는 줄에 쌓는다 -->
      {#each ys as v, i (i)}
        <circle class="demo-dot" class:outlier={i === OUTLIER_DEMO} cx={lx(v)} cy={dotY[i]} r="4.5" />
      {/each}
      {#each LINE_TICKS as g (g)}
        <text class="tick halo" x={lx(g)} y={AXIS_Y + 19} text-anchor="middle">{num(g, 1)}</text>
      {/each}
    </svg>
    <p class="shift">{fmt(c.loss.shift, { l1: num(medShift), l2: num(avgShift) })}</p>
    <div class="formulas">
      <span><strong>L1</strong> <Tex display={false} tex={DIALOG_TEX.lossL1} /></span>
      <span><strong>L2</strong> <Tex display={false} tex={DIALOG_TEX.lossL2} /></span>
    </div>
    <p class="note">{c.loss.formulaNote}</p>
  </figure>
</div>

<div class="notes">
  <p><strong>{c.loss.paperLabel}</strong> {c.loss.paperNote}</p>
  <p>{c.loss.whyRegression}</p>
  <p>{c.loss.gripperNote}</p>
</div>

<details>
  <summary>{c.loss.tableToggle}</summary>
  <table>
    <caption>{c.loss.tableCaption}</caption>
    <thead>
      <tr>
        <th scope="col">{c.loss.colStep}</th>
        {#each chunks as _, i (i)}<th scope="col">{fmt(c.loss.demoName, { i: i + 1 })}{i === OUTLIER_DEMO ? ' *' : ''}</th>{/each}
        <th scope="col">{c.loss.colL1}</th>
        <th scope="col">{c.loss.colL2}</th>
      </tr>
    </thead>
    <tbody>
      {#each { length: TOY_H } as _, k (k)}
        <tr class:picked={k === step}>
          <th scope="row">{fmt(c.loss.stepName, { k })}</th>
          {#each chunks as chunk, i (i)}<td>{num(chunk[k])}</td>{/each}
          <td>{num(l1Pred[k])}</td>
          <td>{num(l2Pred[k])}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</details>

<style>
  .lead {
    margin: 0 0 10px;
    font-size: var(--fs-sm);
    line-height: 1.55;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 28px;
    margin-bottom: 10px;
  }

  .slider {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .slider input {
    width: 200px;
    accent-color: var(--accent);
  }

  .slider .value {
    min-width: 44px;
    font-variant-numeric: tabular-nums;
  }

  /* 왼쪽: chunk 그래프 (그래프 폭에 맞춤), 오른쪽: 고른 step의 수직선 */
  .charts {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
  }

  .chunk {
    width: fit-content;
    max-width: calc(var(--chunk-w) + 30px);
  }

  figure {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 10px 14px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg);
  }

  figcaption {
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .sw {
    display: inline-block;
    width: 18px;
    height: 0;
    border-top: 2px solid;
  }

  .sw.demo {
    border-top: 1px solid var(--muted);
  }

  .sw.outlier {
    border-top: 1.5px dashed var(--muted);
  }

  .sw.l1 {
    border-top-color: var(--accent);
  }

  .sw.l2 {
    border-top: 2px dashed var(--ink);
  }

  svg {
    overflow: visible;
    touch-action: none;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .grid.zero {
    stroke: var(--line-strong);
  }

  .tick {
    fill: var(--muted);
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
  }

  /* 표시선이 지나가도 글자가 읽히게 바탕색 테두리를 두른다 */
  .tick.halo {
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  /* 고른 step: 실선 hairline (점선은 시연과 L2 선이 이미 쓴다) */
  .cross {
    stroke: var(--muted);
    stroke-width: 1;
    opacity: 0.55;
  }

  .demo {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1;
    opacity: 0.6;
  }

  .demo.outlier {
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
    opacity: 1;
  }

  .pred {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .pred.l1 {
    stroke: var(--accent);
  }

  .pred.l2 {
    stroke: var(--ink);
    stroke-dasharray: 6 4;
  }

  .pt {
    stroke: var(--bg);
    stroke-width: 2;
  }

  .pt.l1 {
    fill: var(--accent);
  }

  .pt.l2 {
    fill: var(--ink);
  }

  .direct {
    fill: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .leader {
    stroke-width: 1;
  }

  .leader.l1 {
    stroke: var(--accent);
  }

  .leader.l2 {
    stroke: var(--ink);
  }

  .axis {
    stroke: var(--line-strong);
    stroke-width: 1;
  }

  .demo-dot {
    fill: var(--muted);
    stroke: var(--bg);
    stroke-width: 2;
  }

  .demo-dot.outlier {
    fill: var(--bg);
    stroke: var(--muted);
    stroke-width: 1.5;
    stroke-dasharray: 2 2;
  }

  .mark {
    stroke-width: 2;
  }

  .mark.l1 {
    stroke: var(--accent);
  }

  .mark.l2 {
    stroke: var(--ink);
    stroke-dasharray: 4 3;
  }

  .mark-label {
    fill: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .shift {
    margin: 0;
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  .formulas {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    font-size: 15px;
  }

  .formulas strong {
    font-size: var(--fs-xs);
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
    font-size: var(--fs-xs);
    line-height: 1.55;
  }

  .notes p {
    margin: 0;
  }

  details {
    margin-top: 10px;
    font-size: var(--fs-xs);
  }

  summary {
    color: var(--accent-ink);
    cursor: pointer;
  }

  table {
    margin-top: 6px;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  caption {
    padding-bottom: 4px;
    color: var(--muted);
    text-align: left;
  }

  th,
  td {
    padding: 2px 8px;
    border-bottom: 1px solid var(--line);
    text-align: right;
  }

  thead th {
    color: var(--muted);
  }

  tr.picked {
    background: var(--accent-fill);
  }
</style>
