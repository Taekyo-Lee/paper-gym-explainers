<script lang="ts">
  // Action chunk 단계. Â_t (H × d_a)를 action 차원마다 작은 그래프(small multiple)로 보인다.
  // 그래프는 decoder 출력이 아니라 목표 물체로 가는 스크립트다(caveat action-script). decoder가 실제로 계산한
  // 출력(가상 가중치라 뜻이 없음)은 아래 행렬로 따로 보인다. 고른 step = Decoder 단계에서 고른 action query.
  import { copyFor, fmt, num } from '../../content/i18n'
  import { shapeOf } from '../../engine/tensor'
  import { ui } from '../../state/store.svelte'
  import { hl } from '../../state/highlight.svelte'
  import CaveatMark from '../CaveatMark.svelte'
  import Sym from '../Sym.svelte'
  import ActionChart from '../viz/ActionChart.svelte'
  import MatrixCanvas from '../viz/MatrixCanvas.svelte'

  const COLS = 7
  const GAP = 8

  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  const cfg = $derived(t.config)
  const actions = $derived(ui.trace.actions)
  const H = $derived(actions.rows)
  const dA = $derived(actions.cols)
  const robotwin = $derived(cfg.profile === 'robotwin' && dA === 14)
  const selected = $derived(ui.decQuery)
  /** 그래프 한 칸의 폭. RoboTwin은 줄 앞에 팔 이름 칸(56px)이 있어서 조금 좁다 */
  const panelW = $derived(robotwin ? 80 : 92)
  /** 그래프 높이. RoboTwin은 팔 두 줄이라 낮춘다 (1440 × 900 패널 안에 들어가게) */
  const chartH = $derived(robotwin ? 64 : 84)
  let hover: number | null = $state(null)

  interface Dim {
    label: string
    /** 표와 화면 낭독기에 쓰는 전체 이름 (예: 왼팔 관절 1) */
    full: string
    index: number
    step: boolean
    yMin: number
  }

  /**
   * 그래프 줄. RoboTwin: [왼팔 6, 오른팔 6, 왼 gripper, 오른 gripper]를 한 줄에 한 팔씩(관절 6 + 그 팔의 gripper).
   * 줄 앞에 팔 이름을 달고 그래프 이름은 짧게 둔다(그래프 폭이 좁아서).
   */
  const rows = $derived.by((): { label: string | null; dims: Dim[] }[] => {
    if (robotwin) {
      const row = (side: 'left' | 'right') => {
        const arm = side === 'left' ? c.output.leftArm : c.output.rightArm
        return {
          label: arm,
          dims: [
            ...Array.from({ length: 6 }, (_, i) => {
              const label = fmt(c.output.joint, { i: i + 1 })
              return { label, full: `${arm} ${label}`, index: (side === 'left' ? 0 : 6) + i, step: false, yMin: -1 }
            }),
            { label: c.output.gripper, full: `${arm} ${c.output.gripper}`, index: side === 'left' ? 12 : 13, step: true, yMin: 0 },
          ],
        }
      }
      return [row('left'), row('right')]
    }
    // LIBERO 방식: 팔 6 + gripper (−1 또는 +1)
    return [
      {
        label: null,
        dims: Array.from({ length: dA }, (_, i) => {
          // LIBERO action 7개의 뜻: 손끝 이동 x, y, z, 세 축 회전, gripper (무엇인지 이름으로)
          const label = i === dA - 1 ? c.output.gripper : dA === 7 ? c.output.liberoDims[i] : fmt(c.output.armDim, { i: i + 1 })
          return { label, full: label, index: i, step: i === dA - 1, yMin: -1 }
        }),
      },
    ]
  })
  /** 표의 열 순서 = action 차원 순서 */
  const dims = $derived(rows.flatMap((r) => r.dims).sort((a, b) => a.index - b.index))

  const columns = $derived.by(() =>
    dims.map((d) => Float32Array.from({ length: H }, (_, k) => actions.data[k * dA + d.index])),
  )
  const columnOf = (index: number) => columns[dims.findIndex((d) => d.index === index)]

  const targetName = $derived(c.objects[t.actionTarget])

  /** 그래프 위 x 위치 → step. 그래프 묶음 하나가 모든 그래프의 마우스를 받는다 */
  function stepAt(event: MouseEvent): number | null {
    const plot = (event.target as Element | null)?.closest('[data-plot]')
    if (!plot) return null
    const rect = plot.getBoundingClientRect()
    const pad = Number(plot.getAttribute('data-pad') ?? 0)
    const f = (event.clientX - rect.left - pad) / Math.max(1, rect.width - 2 * pad)
    return Math.max(0, Math.min(H - 1, Math.round(f * (H - 1))))
  }

  function onkeydown(event: KeyboardEvent) {
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowUp' ? selected + 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? selected - 1
      : event.key === 'Home' ? 0
      : event.key === 'End' ? H - 1
      : null
    if (next === null) return
    event.preventDefault()
    ui.decQueryPick = Math.max(0, Math.min(H - 1, next))
  }

  // 화면 낭독기용: "step t+3: 팔 1: 0.12; 팔 2: −0.30; …" (이름과 값 사이를 콜론으로, 차원 사이를 세미콜론으로)
  const valueText = $derived(
    `${fmt(c.output.stepAt, { k: selected })}: ${dims.map((d, i) => `${d.full}: ${num(columns[i][selected] ?? 0)}`).join('; ')}`,
  )
  /** 그래프 머리의 값이 어느 step인지 (마우스를 올린 step, 없으면 고른 step) */
  const focus = $derived(hover ?? selected)
  const xEnd = $derived(fmt(c.output.stepAt, { k: H - 1 }).replace(/^step /, ''))
</script>

<div class="output">
  <p class="target">
    <span class="label">{c.output.targetLabel}</span>
    <strong>{targetName}</strong>
    <CaveatMark id="action-script" />
  </p>
  <p class="once">
    <Sym k="Ahat" kind />
    <span class="shape">{shapeOf(actions)}</span>
    {fmt(c.output.onceNote, { H })}
    <!-- 실제 실행 방식(매 step 다시 예측, chunk 평균)은 "한 번에 나온다"는 문장 옆에 단다 -->
    {#if robotwin}<CaveatMark id="robotwin-execution" />{/if}
  </p>
  <p class="focus">{fmt(c.output.stepFocus, { step: fmt(c.output.stepAt, { k: focus }) })}</p>

  <div
    class="charts"
    {@attach hl('Ahat')}
    style:--cols={COLS}
    class:labeled={robotwin}
    style:--gap="{GAP}px"
    role="slider"
    tabindex="0"
    data-arrow-keys
    aria-label={c.output.chartsLabel}
    aria-valuemin={0}
    aria-valuemax={H - 1}
    aria-valuenow={selected}
    aria-valuetext={valueText}
    {onkeydown}
    onpointermove={(e) => (hover = stepAt(e))}
    onpointerleave={() => (hover = null)}
    onclick={(e) => {
      const k = stepAt(e)
      if (k !== null) ui.decQueryPick = k
    }}
  >
    {#each rows as row (row.label)}
      {#if row.label}<span class="row-label">{row.label}</span>{/if}
      {#each row.dims as d (d.index)}
        <ActionChart values={columnOf(d.index)} label={d.label} step={d.step} yMin={d.yMin} yMax={1} width={panelW} height={chartH} {hover} {selected} xEnd={xEnd} />
      {/each}
    {/each}
  </div>
  <!-- 아래 줄: 왼쪽은 그래프 설명과 값 표, 오른쪽은 decoder가 실제로 계산한 출력 (세로로 쌓으면 RoboTwin에서 패널이 길어진다) -->
  <div class="below">
  <div class="below-main">
  <p class="small">{robotwin ? c.output.rangeRobotwin : c.output.rangeLibero} {c.output.hoverHint}</p>

  <!-- 그래프(스크립트) 값의 표. decoder 출력 행렬과 섞이지 않게 그래프 바로 아래에 둔다 -->
  <details>
    <summary>{c.output.tableToggle}</summary>
    <div class="table-wrap">
      <table>
        <caption>{c.output.tableCaption}</caption>
        <thead>
          <tr><th scope="col">{c.output.stepAxis}</th>{#each dims as d (d.index)}<th scope="col">{d.full}</th>{/each}</tr>
        </thead>
        <tbody>
          {#each Array.from({ length: H }, (_, k) => k) as k (k)}
            <tr class:sel={k === selected} aria-current={k === selected ? 'step' : undefined}>
              <th scope="row">t+{k}</th>
              {#each columns as col, i (i)}<td>{num(col[k])}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
  </div>

  <!-- Â_t: 위 그래프(스크립트)와 decoder가 실제로 계산한 출력 둘 다 같은 기호다 -->
  <div class="real" {@attach hl('Ahat')}>
    <MatrixCanvas
      tensor={t.decoderOutput}
      width={robotwin ? 112 : Math.min(200, dA * 16)}
      height={Math.max(48, Math.min(96, H * 6))}
      zoom={false}
      selectedRow={selected}
      label={fmt(c.output.decoderOutLabel, { shape: shapeOf(t.decoderOutput) })}
    />
    <div>
      <p class="title">{c.output.decoderOutTitle} <span class="shape">{shapeOf(t.decoderOutput)}</span></p>
      <p class="small">{c.output.decoderOutNote}</p>
    </div>
  </div>
  </div>
</div>

<style>
  .output {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .target {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 0;
    font-size: var(--fs-sm);
  }

  /* 글줄처럼 흐르게 해서 끝의 주의 표시가 문장 바로 뒤에 붙는다 (flex로 두면 따로 한 줄을 차지한다) */
  .once {
    margin: 0;
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  .once .shape {
    margin: 0 4px;
  }

  .target .label {
    color: var(--muted);
  }

  /* 그래프 칸은 고정 폭 (이름이 길어도 칸이 넓어지지 않게). RoboTwin은 줄 앞에 팔 이름 칸이 있다 */
  .charts {
    display: grid;
    grid-template-columns: repeat(var(--cols), 92px);
    gap: 10px var(--gap);
    padding: 4px 0;
    cursor: crosshair;
  }

  .charts.labeled {
    grid-template-columns: 64px repeat(var(--cols), 80px);
  }

  .row-label {
    align-self: center;
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .charts:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: var(--radius-sm);
  }

  .focus {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .small {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  .below {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
    gap: 16px;
    align-items: start;
  }

  /* 값 표를 펼치면 한 열로 쌓아 표가 패널 폭을 다 쓴다 (왼쪽 열에 두면 gripper 열이 잘린다) */
  .below:has(details[open]) {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 텐서 모양(12 × 7)이 두 줄로 갈라지지 않게 */
  .real .shape {
    white-space: nowrap;
  }

  .below-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .real {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .title {
    margin: 0 0 2px;
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  details {
    margin-top: 4px;
    font-size: var(--fs-xs);
  }

  summary {
    cursor: pointer;
    color: var(--accent-ink);
  }

  /* 표가 넓어도(RoboTwin 14열) 패널은 넓어지지 않고 표 상자 안에서 스크롤한다 */
  .table-wrap {
    max-width: 100%;
    max-height: 180px;
    margin-top: 4px;
    overflow: auto;
  }

  table {
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
    padding: 1px 6px;
    border-bottom: 1px solid var(--line);
    text-align: right;
    white-space: nowrap;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--card);
  }

  /* 고른 step: 바탕색만으로 알리지 않고 굵은 글자와 왼쪽 줄로도 표시한다 */
  tr.sel td,
  tr.sel th {
    background: var(--accent-fill);
    font-weight: 700;
  }

  tr.sel th {
    box-shadow: inset 3px 0 0 var(--accent);
  }
</style>
