<script lang="ts">
  // Action Decoder 단계 (Key Idea 3).
  // action query Q_a(H × d)가 Q, memory [V^N ; L^N ; Z^s]가 K·V. 층과 head를 고르고, query 하나를 고르면
  // 그 query가 memory의 이미지 / 지시 / state 구간에 attention을 얼마나 나눴는지 세 막대로 요약한다.
  import { copyFor, fmt, joinList, num } from '../../content/i18n'
  import { headGroups } from '../../engine/concepts'
  import { shapeOf } from '../../engine/tensor'
  import { maxOf, segmentSums, sliceCols } from '../../state/attention'
  import { ui } from '../../state/store.svelte'
  import { hl } from '../../state/highlight.svelte'
  import CaveatMark from '../CaveatMark.svelte'
  import InfoMark from '../InfoMark.svelte'
  import NumberPicker from '../NumberPicker.svelte'
  import Sym from '../Sym.svelte'
  import MatrixCanvas from '../viz/MatrixCanvas.svelte'

  /**
   * cross-attention을 memory 구간마다 따로 그리는 폭 (Memory 단계처럼 구간마다 다른 비율).
   * 열 수 비율대로 그리면 state 열 2개가 1px 남짓이라 보이지 않는다.
   */
  const SEG_W = { visual: 250, text: 44, state: 28 } as const
  const CROSS_W = SEG_W.visual + SEG_W.text + SEG_W.state + 4
  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  const cfg = $derived(t.config)
  const Qa = $derived(ui.trace.Qa)
  const layer = $derived(t.decoder[ui.decLayer - 1])
  const h = $derived(ui.decHead - 1)
  const cross = $derived(layer.crossAttn[h])
  const selfA = $derived(layer.selfAttn[h])
  const q = $derived(ui.decQuery)
  const seg = $derived(t.memorySegments)
  const height = $derived(Math.max(96, Math.min(150, cfg.H * 10)))
  // 색 끝값은 행렬의 최댓값(세 구간 공통): 99 백분위수로 자르면 토큰 2개뿐인 state 열(합의 대부분)이 이미지 열과 같은 색이 된다
  const crossLimit = $derived(maxOf(cross.data))
  const crossParts = $derived(
    (['visual', 'text', 'state'] as const).map((key) => ({
      key,
      tensor: sliceCols(cross, ...seg[key], `cross ${key}`),
      width: SEG_W[key],
    })),
  )
  const selfLimit = $derived(maxOf(selfA.data))

  const roles = $derived(headGroups(cfg.decoderHeads, 'decoder'))
  const roleText = $derived.by(() => {
    const groups = roles[ui.decHead - 1] ?? []
    return groups.length ? joinList(groups.map((g) => c.viz.groups[g]), ui.lang) : c.decoder.noRole
  })

  /** 고른 query 행을 memory 구간별로 더한다 (행 합이 1이므로 세 값의 합도 1) */
  const split = $derived.by(() => {
    const [v, l, s] = segmentSums(cross, q, [seg.visual, seg.text, seg.state])
    return [
      { key: 'visual', label: c.memory.segVisual, value: v, count: seg.visual[1] - seg.visual[0], color: 'var(--vision)' },
      { key: 'text', label: c.memory.segText, value: l, count: seg.text[1] - seg.text[0], color: 'var(--language)' },
      { key: 'state', label: c.memory.segState, value: s, count: seg.state[1] - seg.state[0], color: 'var(--state)' },
    ]
  })


  /** 고른 query가 가장 많이 준 구간. 이미지가 아니면 설명을 바꾼다 (state head 등) */
  const top = $derived(split.reduce((a, b) => (b.value > a.value ? b : a)))
  const splitNote = $derived(
    top.key === 'visual'
      ? fmt(c.decoder.splitNote, { n: top.count })
      : fmt(c.decoder.splitNoteSmall, { seg: top.label, n: top.count }),
  )

  const queryText = (k: number) => fmt(c.decoder.queryText, { k: k + 1, off: k })
  const pick = (k: number) => (ui.decQueryPick = k)
  const steps = $derived([
    { ln: true, name: 'self-attention' },
    { ln: true, name: 'cross-attention', memory: true },
    { ln: true, name: `FFN 256 → ${cfg.decoderFFNDim.toLocaleString('en-US')} → 256` },
  ])
</script>

<div class="decoder">
  <div class="controls">
    <NumberPicker label={c.decoder.layer} groupLabel={c.decoder.layerLabel} count={cfg.decoderLayers} value={ui.decLayer} onPick={(n) => (ui.decLayerPick = n)} />
    <div class="group">
      <NumberPicker label={c.decoder.head} groupLabel={c.decoder.headLabel} count={cfg.decoderHeads} value={ui.decHead} onPick={(n) => (ui.decHeadPick = n)} />
      <span class="role">{fmt(c.decoder.headRole, { roles: roleText })}</span>
      <CaveatMark id="head-roles" />
    </div>
    <div class="roles">
      <span class="chip action"><b>{c.decoder.q}</b> {c.decoder.qRole}</span>
      <span class="chip memory"><b>{c.decoder.kv}</b> {c.decoder.kvRole}</span>
    </div>
  </div>
  <p class="lead">{c.decoder.lead} <CaveatMark id="designed-queries" /></p>

  <div class="cols">
    <!-- Q_a: 학습되는 parameter -->
    <section class="qa" {@attach hl('Qa')}>
      <header>
        <Sym k="Qa" kind />
        <span class="shape">{shapeOf(Qa)}</span>
      </header>
      <p class="small strong">{c.decoder.qaTitle}</p>
      <p class="small">{c.decoder.qaNote}</p>
      <MatrixCanvas
        tensor={Qa}
        width={150}
        {height}
        zoom={false}
        selectedRow={q}
        onRowSelect={pick}
        rowText={queryText}
        label="{c.decoder.queryLabel}: {fmt(c.decoder.qaLabel, { shape: shapeOf(Qa) })}"
      />
    </section>

    <!-- cross-attention H × M: action query가 Q, memory가 K·V -->
    <section class="cross">
      <header>
        <span class="title">{c.decoder.crossTitle}</span>
        <span class="shape">{shapeOf(cross)}</span>
        <span class="small">{c.decoder.rowSum}, {fmt(c.decoder.colorEnd, { x: num(crossLimit) })}</span>
      </header>
      <!-- memory 구간마다 따로 그린다(구간마다 다른 폭, 2px 틈, 같은 색 범위). 위의 띠가 구간 색이다 -->
      <div class="segments" style:width="{CROSS_W}px">
        {#each crossParts as part, i (part.key)}
          <div class="segment">
            <span class="band" style:background={split[i].color} title={split[i].label}></span>
            <MatrixCanvas
              tensor={part.tensor}
              width={part.width}
              {height}
              scale="action"
              limit={crossLimit}
              zoom={false}
              selectedRow={q}
              onRowSelect={i === 0 ? pick : undefined}
              rowText={queryText}
              label={i === 0
                ? `${c.decoder.queryLabel}: ${fmt(c.decoder.crossLabel, { shape: shapeOf(cross) })}. ${c.decoder.rowSum}`
                : `${split[i].label}, ${shapeOf(part.tensor)}`}
            />
          </div>
        {/each}
      </div>
      <!-- 구간 이름과 토큰 수는 한 줄 범례로 (좁은 구간 밑에 글자를 두면 줄이 깨진다) -->
      <p class="small legend">
        {#each split as s (s.key)}<span class="key" style:--key={s.color}>{s.label} <b>{s.count}</b></span>{/each}
      </p>
    </section>

    <!-- 고른 query의 구간 요약 -->
    <section class="split">
      <h4>{c.decoder.splitTitle}</h4>
      <p class="picked"><Sym k="q" tex={`q_{${q + 1}}`} /> {queryText(q)}</p>
      <ul class="bars">
        {#each split as s (s.key)}
          <li>
            <span class="bar-label">{s.label}</span>
            <span class="track"><span class="fill" style:width="{Math.max(0, Math.min(1, s.value)) * 100}%" style:background={s.color}></span></span>
            <span class="value">{(s.value * 100).toFixed(1)}%</span>
            <span class="count">{fmt(c.decoder.splitCount, { n: s.count })}</span>
          </li>
        {/each}
      </ul>
      <p class="small">{splitNote}</p>

      <div class="self">
        <MatrixCanvas
          tensor={selfA}
          width={96}
          height={96}
          scale="action"
          limit={selfLimit}
          zoom={false}
          selectedRow={q}
          label={fmt(c.decoder.selfLabel, { shape: shapeOf(selfA) })}
        />
        <div>
          <p class="title">{c.decoder.selfTitle} <span class="shape">{shapeOf(selfA)}</span></p>
          <p class="small">{c.decoder.selfNote}</p>
        </div>
      </div>
    </section>
  </div>

  <!-- 층 하나의 구조 (공식 코드: pre-norm, mask 없음) -->
  <div class="flow-wrap">
    <span class="small-title">{c.decoder.flowTitle}</span>
    <ol class="flow">
      {#each steps as s, i (i)}
        <li>
          {#if i > 0}<span class="arrow" aria-hidden="true"></span>{/if}
          <span class="ln">LN</span><span class="box" class:mem={s.memory}>{s.name}</span><span class="plus">+</span>
        </li>
      {/each}
    </ol>
    <span class="times">× {cfg.decoderLayers}</span>
    <InfoMark label={c.decoder.flowInfoLabel} title={c.decoder.flowTitle} body={fmt(c.decoder.flowRepeat, { n: cfg.decoderLayers })} />
    <CaveatMark id="internals-from-code" />
  </div>
</div>

<style>
  .decoder {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 18px;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .role {
    margin-left: 6px;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .roles {
    display: flex;
    gap: 4px;
  }

  .chip {
    padding: 0 8px;
    border: 1.5px solid;
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    line-height: 1.6;
    white-space: nowrap;
  }

  .chip.action {
    border-color: var(--accent);
    background: var(--accent-fill);
    color: var(--accent-ink);
  }

  .chip.memory {
    border-color: var(--line-strong);
    background: var(--card);
    color: var(--ink);
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .cols {
    display: flex;
    gap: 18px;
    align-items: flex-start;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: none;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    font-size: var(--fs-sm);
  }

  .title {
    font-weight: 700;
  }

  .small {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.4;
  }

  .qa {
    width: 160px;
  }

  /* 머리 글이 길어도(색 끝값 등) 열 폭이 행렬 폭을 넘지 않게 한다 */
  .cross {
    width: 330px;
  }

  .segments {
    display: flex;
    gap: 2px;
  }

  .segment {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
  }

  .band {
    align-self: stretch;
    height: 6px;
    border-radius: 2px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .key::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--key);
  }

  .key b {
    color: var(--ink);
  }

  .strong {
    color: var(--ink);
    font-weight: 700;
  }

  .split {
    width: 380px;
    gap: 6px;
  }

  h4 {
    margin: 0;
    font-size: var(--fs-sm);
  }

  .picked {
    margin: 0;
    font-size: var(--fs-xs);
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .bars li {
    display: grid;
    grid-template-columns: 112px 1fr 48px 76px;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-xs);
  }

  .track {
    height: 12px;
    border-radius: 2px;
    background: var(--sunken);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: 0 4px 4px 0;
  }

  .value {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .count {
    color: var(--muted);
  }

  .self {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-top: 4px;
  }

  .self .title {
    margin: 0 0 2px;
    font-size: var(--fs-xs);
  }

  .flow-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
  }

  .small-title {
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .flow li {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .arrow {
    position: relative;
    width: 18px;
    height: 18px;
  }

  .arrow::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 4px;
    width: 7px;
    height: 7px;
    border-top: 1.5px solid var(--muted);
    border-right: 1.5px solid var(--muted);
    transform: translateY(-50%) rotate(45deg);
  }

  .times {
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .ln,
  .plus {
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .box {
    padding: 2px 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    font-size: var(--fs-xs);
    white-space: nowrap;
  }

  .box.mem {
    border-color: var(--accent);
  }
</style>
