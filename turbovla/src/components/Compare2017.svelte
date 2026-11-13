<script lang="ts">
  // 2017 비교 창. 같은 H개 출력을 두 방식으로 낼 때 나오는 순서를 애니메이션으로 비교한다.
  // - autoregressive (2017 Transformer decoder): decoder를 한 번 돌릴 때마다 한 step. 뒤 자리를 mask로 가린다.
  // - parallel (TurboVLA Action Chunk Decoder): action query H개, mask 없음, 한 번에 H step.
  // 선은 Action chunk 단계의 첫 차원 값이다. 두 방식이 같은 출력을 낸다고 놓고 순서만 비교한다.
  // 지연 시간은 Tab. 1 숫자를 모델 이름과 출처와 함께 쓰고, 전체 경로의 차이라고 밝힌다.
  import { copyFor, fmt, num } from '../content/i18n'
  import { DIALOG_TEX } from '../content/equations'
  import { canAttend, passesNeeded, revealedCount, type DecodingMode } from '../engine/decoding'
  import { ui } from '../state/store.svelte'
  import Tex from './Tex.svelte'

  const MODES: DecodingMode[] = ['autoregressive', 'parallel']
  const ROWS = ['input', 'mask', 'cross', 'runs'] as const
  const CHART_W = 318
  const CHART_H = 92
  const PAD = 8
  const MASK = 108

  const c = $derived(copyFor(ui.lang))
  const uid = $props.id()
  const actions = $derived(ui.trace.actions)
  const H = $derived(actions.rows)
  const robotwin = $derived(ui.config.profile === 'robotwin' && actions.cols === 14)
  /** 그릴 차원: gripper를 뺀 팔 차원 중 값이 가장 많이 바뀌는 것 (LIBERO 0–5, RoboTwin 0–11) */
  const dim = $derived.by(() => {
    const armDims = robotwin ? 12 : Math.max(1, actions.cols - 1)
    let best = 0
    let bestRange = -1
    for (let d = 0; d < armDims; d++) {
      let lo = Infinity
      let hi = -Infinity
      for (let k = 0; k < H; k++) {
        const v = actions.data[k * actions.cols + d]
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
      if (hi - lo > bestRange + 1e-9) {
        best = d
        bestRange = hi - lo
      }
    }
    return best
  })
  const values = $derived(Float32Array.from({ length: H }, (_, k) => actions.data[k * actions.cols + dim]))
  const dimName = $derived(
    robotwin
      ? fmt(dim < 6 ? c.compare.leftJoint : c.compare.rightJoint, { i: (dim % 6) + 1 })
      : fmt(c.output.armDim, { i: dim + 1 }),
  )

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  /** 지금까지 decoder를 몇 번 돌렸나 (0 … H) */
  let pass = $state(0)
  let playing = $state(!reducedMotion)
  /** 한 번 실행의 길이: 전체가 2.4초 안팎이 되게 (H = 50이면 빠르게) */
  const tickMs = $derived(Math.round(Math.max(60, Math.min(320, 2400 / H))))

  $effect(() => {
    if (!playing) return
    const id = setInterval(() => {
      if (pass >= H) playing = false
      else pass += 1
    }, tickMs)
    return () => clearInterval(id)
  })

  // H가 바뀌면(창이 열린 채로는 바뀌지 않지만) 범위 안으로
  $effect(() => {
    if (pass > H) pass = H
  })

  function toggle() {
    if (playing) {
      playing = false
      return
    }
    if (pass >= H) pass = 0
    playing = true
  }

  const playLabel = $derived(playing ? c.compare.pause : pass >= H ? c.compare.replay : pass === 0 ? c.compare.play : c.compare.resume)

  const x = (k: number) => PAD + (H > 1 ? (k / (H - 1)) * (CHART_W - 2 * PAD) : (CHART_W - 2 * PAD) / 2)
  /** 세로 범위는 값에 맞춘다 (폭이 0.5보다 좁으면 0.5로) */
  const yRange = $derived.by(() => {
    let lo = Infinity
    let hi = -Infinity
    for (const v of values) {
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
    const mid = (lo + hi) / 2
    const half = Math.max(0.25, (hi - lo) / 2) * 1.15
    return { lo: mid - half, hi: mid + half }
  })
  const y = (v: number) => PAD + ((yRange.hi - v) / (yRange.hi - yRange.lo)) * (CHART_H - 2 * PAD)

  function linePath(n: number): string {
    if (n < 1) return ''
    let d = `M${x(0)},${y(values[0])}`
    for (let k = 1; k < n; k++) d += `L${x(k)},${y(values[k])}`
    return d
  }

  /** mask 행렬의 한 줄: 볼 수 있는 칸의 폭 (autoregressive는 자기 자리까지) */
  const cell = $derived(MASK / H)
  const allowedWidth = (mode: DecodingMode, i: number) => {
    let n = 0
    for (let j = 0; j < H; j++) if (canAttend(mode, i, j)) n++
    return n * cell
  }

  /**
   * mask 행렬을 상태마다 path 하나로 그린다 (줄마다 rect를 그리면 H = 50에서 줄 사이에 틈이 보인다).
   * done: 계산한 줄의 볼 수 있는 칸, masked: 가린 칸(빗금), outline: 볼 수 있는 칸 전체의 테두리(아직 계산하지 않은 줄도 보이게)
   */
  function maskPaths(mode: DecodingMode, revealed: number) {
    let done = ''
    let masked = ''
    let outline = 'M0,0'
    for (let i = 0; i < H; i++) {
      const w = allowedWidth(mode, i)
      const top = i * cell
      if (i < revealed) done += `M0,${top}H${w}V${top + cell}H0Z`
      if (w < MASK - 1e-6) masked += `M${w},${top}H${MASK}V${top + cell}H${w}Z`
      outline += `H${w}V${top + cell}`
    }
    return { done, masked, outline: `${outline}H0Z` }
  }

  const lanes = $derived(
    MODES.map((mode) => {
      const revealed = revealedCount(mode, pass, H)
      const runs = Math.min(pass, passesNeeded(mode, H))
      return { mode, revealed, runs, copy: c.compare.lanes[mode], paths: maskPaths(mode, revealed) }
    }),
  )

  const LATENCY = [
    { key: 'turbovla', ms: 31.2 },
    { key: 'openvla', ms: 202.9 },
    { key: 'pi05', ms: 238.8 },
  ] as const
  const LAT_MAX = 250
</script>

<p class="lead">{fmt(c.compare.lead, { H })}</p>

<div class="controls">
  <button type="button" class="play" onclick={toggle}>
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {#if playing}<path d="M5 3.5v9M11 3.5v9" />{:else}<path d="M5 3l8 5-8 5z" />{/if}
    </svg>
    {playLabel}
  </button>
  <label class="scrub">
    <span>{c.compare.scrubLabel}</span>
    <input
      type="range"
      min="0"
      max={H}
      step="1"
      value={pass}
      aria-valuetext={fmt(c.compare.passText, { p: pass })}
      oninput={(e) => {
        playing = false
        pass = Number(e.currentTarget.value)
      }}
    />
    <!-- 보이는 숫자일 뿐이다. 값은 슬라이더의 aria-valuetext로 알린다 (재생 중에 화면 낭독기가 숫자를 쏟아내지 않게) -->
    <span class="pass" aria-hidden="true">{fmt(c.compare.passText, { p: pass })}</span>
  </label>
</div>

<div class="lanes">
  {#each lanes as lane (lane.mode)}
    <section class="lane {lane.mode}" aria-labelledby="lane-{uid}-{lane.mode}">
      <header>
        <h3 id="lane-{uid}-{lane.mode}">{lane.copy.name} <span class="method">{lane.copy.method}</span></h3>
        <p class="count">{fmt(c.compare.count, { r: lane.revealed, H, p: lane.runs, n: passesNeeded(lane.mode, H) })}</p>
      </header>

      <div class="lane-body">
        <svg class="mask" width={MASK} height={MASK} aria-hidden="true">
          <defs>
            <pattern id="hatch-{uid}-{lane.mode}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="2.5" y1="0" x2="2.5" y2="5" class="hatch-line" />
            </pattern>
          </defs>
          <rect class="frame" x="0" y="0" width={MASK} height={MASK} />
          {#if lane.paths.masked}<path d={lane.paths.masked} fill="url(#hatch-{uid}-{lane.mode})" />{/if}
          {#if lane.paths.done}<path class="done" d={lane.paths.done} />{/if}
          <path class="outline" d={lane.paths.outline} />
          {#if lane.mode === 'autoregressive' && lane.revealed > 0 && lane.revealed <= H}
            <rect class="current" x="0.75" y={(lane.revealed - 1) * cell + 0.75} width={allowedWidth(lane.mode, lane.revealed - 1) - 1.5} height={Math.max(1, cell - 1.5)} />
          {/if}
        </svg>
        <!-- 같은 H개 출력이 나오는 순서. 아직 안 나온 step은 빈 점 -->
        <svg class="chart" viewBox="0 0 {CHART_W} {CHART_H + 18}" style:max-width="{CHART_W}px" role="img" aria-label={fmt(c.compare.chartLabel, { name: lane.copy.name, r: lane.revealed, H })}>
          {#if yRange.lo < 0 && yRange.hi > 0}<line class="grid" x1={PAD} x2={CHART_W - PAD} y1={y(0)} y2={y(0)} />{/if}
          <path class="line" d={linePath(lane.revealed)} />
          {#each values as v, k (k)}
            <circle class="dot" class:on={k < lane.revealed} class:newest={lane.mode === 'autoregressive' && k === lane.revealed - 1} cx={x(k)} cy={y(v)} r={H > 24 ? 2.2 : 3.4} />
          {/each}
          {#if H > 1}
            <text class="tick" x={PAD} y={CHART_H + 15}>t</text>
            <text class="tick" x={CHART_W - PAD} y={CHART_H + 15} text-anchor="end">t+{H - 1}</text>
          {:else}
            <text class="tick" x={x(0)} y={CHART_H + 15} text-anchor="middle">t</text>
          {/if}
        </svg>
      </div>
      <p class="mask-text"><strong>{c.compare.maskTitle}:</strong> {lane.copy.maskCaption}</p>
    </section>
  {/each}
</div>
<!-- mask 행렬 읽는 법 (색만으로 알리지 않게 채움, 테두리, 빗금으로 나눈다) -->
<ul class="mask-key">
  <li><svg width="14" height="14" aria-hidden="true"><rect class="key-done" x="0.5" y="0.5" width="13" height="13" /></svg>{c.compare.maskKey.done}</li>
  <li><svg width="14" height="14" aria-hidden="true"><rect class="key-pending" x="0.5" y="0.5" width="13" height="13" /></svg>{c.compare.maskKey.pending}</li>
  <li><svg width="14" height="14" aria-hidden="true"><defs><pattern id="key-hatch-{uid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="2.5" y1="0" x2="2.5" y2="5" class="hatch-line" /></pattern></defs><rect class="key-masked" x="0.5" y="0.5" width="13" height="13" fill="url(#key-hatch-{uid})" /></svg>{c.compare.maskKey.masked}</li>
</ul>
<p class="note">{fmt(c.compare.valueNote, { dim: dimName })} {c.compare.maskAxes}</p>

<div class="lower">
  <section aria-labelledby="cmp-table-{uid}">
    <h3 id="cmp-table-{uid}">{c.compare.tableTitle}</h3>
    <table>
      <thead>
        <tr><th scope="col"><span class="visually-hidden">{c.compare.aspect}</span></th><th scope="col">{c.compare.lanes.autoregressive.name}</th><th scope="col">TurboVLA</th></tr>
      </thead>
      <tbody>
        {#each ROWS as key (key)}
          {@const row = c.compare.rows[key]}
          <tr>
            <th scope="row">{fmt(row.label, { H })}</th>
            <td>{fmt(row.ar, { H })}</td>
            <td>{fmt(row.par, { H })}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="eq">
      <Tex display={false} tex={DIALOG_TEX.maskedAttention} />
      <span class="eq-cases">
        <span>{c.compare.lanes.autoregressive.name}: <Tex display={false} tex={DIALOG_TEX.mask2017} /></span>
        <span>TurboVLA: <Tex display={false} tex={DIALOG_TEX.maskTurbo} /></span>
      </span>
    </div>
    <p class="note">{c.compare.eqNote}</p>
  </section>

  <section aria-labelledby="cmp-latency-{uid}">
    <h3 id="cmp-latency-{uid}">{c.compare.latencyTitle}</h3>
    <p class="source">{c.compare.latencySource}</p>
    <ul class="bars">
      {#each LATENCY as m (m.key)}
        <li>
          <span class="bar-label"><strong>{c.compare.models[m.key].name}</strong> <span>{c.compare.models[m.key].kind}</span></span>
          <!-- 값은 막대 끝에 붙인다. 막대 폭은 값 이름표 자리(72px)를 뺀 폭에 비례한다 -->
          <span class="bar-track">
            <span class="bar" class:ours={m.key === 'turbovla'} style:width="calc((100% - 72px) * {m.ms / LAT_MAX})"></span>
            <span class="bar-value">{num(m.ms, 1)} ms</span>
          </span>
        </li>
      {/each}
    </ul>
    <p class="note">{c.compare.latencyNote}</p>
    <p class="note seminar">{c.compare.seminarNote}</p>
  </section>
</div>

<style>
  .lead {
    margin: 0 0 10px;
    font-size: var(--fs-sm);
    line-height: 1.55;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .play {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 116px;
    padding: 6px 14px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-pill);
    background: var(--accent-fill);
    color: var(--accent-ink);
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .play svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linejoin: round;
  }

  .scrub {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    font-size: var(--fs-xs);
    color: var(--muted);
  }

  .scrub input {
    flex: 1;
    max-width: 360px;
    accent-color: var(--accent);
  }

  .scrub .pass {
    min-width: 64px;
    color: var(--ink);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .lanes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .lane {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 14px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg);
  }

  .lane header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  h3 {
    margin: 0;
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .method {
    color: var(--muted);
    font-weight: 500;
  }

  .count {
    margin: 0;
    color: var(--ink);
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
  }

  /* 좁은 화면에서는 줄어든다 (viewBox) */
  .chart {
    flex: 1 1 0;
    min-width: 0;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  /* 아직 나오지 않은 step: 속이 빈 점 (테두리는 3:1 이상) */
  .dot {
    fill: var(--card);
    stroke: var(--muted);
    stroke-width: 1;
  }

  .dot.on {
    fill: var(--accent);
    stroke: var(--card);
    stroke-width: 1.5;
  }

  .dot.newest {
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .tick {
    fill: var(--muted);
    font-size: var(--fs-xs);
  }

  .lane-body {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .mask {
    flex: none;
  }

  .mask .frame {
    fill: var(--card);
    stroke: var(--line-strong);
    stroke-width: 1;
  }

  .mask .done,
  .key-done {
    fill: color-mix(in srgb, var(--accent) 45%, var(--card));
  }

  /* 볼 수 있는 칸 전체의 테두리: 아직 계산하지 않은 줄도 보인다 */
  .mask .outline,
  .key-pending {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1;
  }

  .key-done {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .key-masked {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .hatch-line {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .mask-key {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .mask-key li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .mask .current {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.5;
  }

  .mask-text {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  .mask-text strong {
    color: var(--ink);
  }

  .note {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.55;
  }

  .lower {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    gap: 14px;
    margin-top: 14px;
  }

  .lower section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  table {
    border-collapse: collapse;
    font-size: var(--fs-xs);
  }

  th,
  td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }

  thead th {
    color: var(--muted);
    font-weight: 700;
  }

  tbody th {
    color: var(--muted);
    font-weight: 500;
    white-space: nowrap;
  }

  .eq {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
    margin-top: 6px;
    font-size: 15px;
  }

  .eq-cases {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-xs);
  }

  .source {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }

  .bars li {
    display: grid;
    grid-template-columns: 150px 1fr;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-xs);
  }

  .bar-label {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  .bar-label span {
    color: var(--muted);
  }

  .bar-track {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 14px;
  }

  .bar {
    display: block;
    flex: none;
    height: 100%;
    border-radius: 0 4px 4px 0;
    background: var(--muted);
  }

  .bar.ours {
    background: var(--accent);
  }

  .bar-value {
    color: var(--ink);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .seminar {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }
</style>
