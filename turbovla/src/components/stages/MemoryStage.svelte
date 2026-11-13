<script lang="ts">
  // Memory 단계 (Eq. 8–9). decoder memory = [V^N ; L^N ; Z^s]를 세로 행렬 하나로 보인다.
  // 구간마다 토큰 수가 크게 달라서(512 / 6 / 2) 같은 비율로 줄이면 지시와 state가 안 보인다.
  // 그래서 구간마다 다른 높이로 그리고(2px 틈), 실제 비율은 아래 막대로 따로 보인다.
  import { copyFor, fmt } from '../../content/i18n'
  import { shapeOf, sliceRows } from '../../engine/tensor'
  import { ui } from '../../state/store.svelte'
  import { hl } from '../../state/highlight.svelte'
  import BasisTag from '../BasisTag.svelte'
  import Sym from '../Sym.svelte'
  import { g, type GlossKey } from '../../content/glossary'
  import { robustLimit } from '../viz/color'
  import MatrixCanvas from '../viz/MatrixCanvas.svelte'
  import SegmentBar from '../viz/SegmentBar.svelte'

  const WIDTH = 170
  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  const memory = $derived(ui.trace.memory)
  const seg = $derived(t.memorySegments)
  const none = $derived(t.config.mode === 'none')
  const pads = $derived(t.textKeyPadding.reduce((n, v) => n + v, 0))
  /** 논문 기준 + LIBERO: 공식 코드라면 지시 구간이 21칸이 되어 memory 행 수가 달라진다 ("논문" 표시) */
  const paperLibero = $derived(t.config.basis === 'paper' && t.config.profile === 'libero')
  const codeRows = $derived(seg.visual[1] - seg.visual[0] + 21 + (seg.state[1] - seg.state[0]))
  // 세 구간이 같은 색 범위를 써야 한 행렬로 읽힌다
  const limit = $derived(robustLimit(memory.data))

  /** [Z^vl ; Z^s]. 안쪽 기호도 각자 풀이가 있다 */
  const MEMORY_TEX = String.raw`\left[\,${g('Zvl', 'Z^{vl}_t')} \,;\, ${g('Zs', 'Z^s_t')}\,\right]`

  const parts = $derived([
    {
      key: 'visual',
      hl: ['VN', 'Zvl', 'memory'],
      tensor: sliceRows(memory, seg.visual[0], seg.visual[1], 'V^N'),
      height: 108,
      color: 'var(--vision)',
      sym: (none ? 'Zv' : 'VN') as GlossKey,
      name: c.memory.segVisual,
      from: none ? c.memory.fromEncoder : fmt(c.memory.fromInteraction, { n: t.config.N }),
    },
    {
      key: 'text',
      hl: ['LN', 'Zvl', 'memory'],
      tensor: sliceRows(memory, seg.text[0], seg.text[1], 'L^N'),
      height: Math.max(24, Math.min(40, (seg.text[1] - seg.text[0]) * 4)),
      color: 'var(--language)',
      sym: (none ? 'Zl' : 'LNout') as GlossKey,
      name: c.memory.segText,
      from: none ? c.memory.fromEncoder : fmt(c.memory.fromInteraction, { n: t.config.N }),
    },
    {
      key: 'state',
      hl: ['Zs', 'memory'],
      tensor: sliceRows(memory, seg.state[0], seg.state[1], 'Z^s'),
      height: 16,
      color: 'var(--state)',
      sym: 'Zs' as GlossKey,
      name: c.memory.segState,
      from: c.memory.fromState,
    },
  ])

  const counts = $derived([
    { label: c.memory.segVisual, value: seg.visual[1] - seg.visual[0], color: 'var(--vision)' },
    { label: c.memory.segText, value: seg.text[1] - seg.text[0], color: 'var(--language)' },
    { label: c.memory.segState, value: seg.state[1] - seg.state[0], color: 'var(--state)' },
  ].map((s) => ({ ...s, text: fmt(c.memory.countUnit, { n: s.value }) })))
</script>

<div class="memory">
  <header>
    <!-- 이어 붙인 결과를 논문은 decoder memory라고 부른다 (기호, 종류, 이름을 보인다) -->
    <Sym k="memory" tex={MEMORY_TEX} kind name />
    <span class="shape">{shapeOf(memory)}</span>
  </header>
  <p class="note">{c.memory.order}</p>

  <div class="stack" role="group" aria-label={fmt(c.memory.matrixLabel, { shape: shapeOf(memory) })}>
    {#each parts as p (p.key)}
      <div class="row" {@attach hl(...p.hl)}>
        <MatrixCanvas
          tensor={p.tensor}
          width={WIDTH}
          height={p.height}
          rowGroups={[{ start: 0, end: p.tensor.rows, color: p.color, label: p.name }]}
          {limit}
          zoom={false}
          label="{p.name}, {shapeOf(p.tensor)}"
        />
        <!-- 구간 옆에는 기호와 모양만 (한 줄). 구간이 얇아도 행렬이 끊기지 않게 -->
        <span class="label" style:height="{p.height}px"><Sym k={p.sym} /> <span class="shape">{shapeOf(p.tensor)}</span></span>
      </div>
    {/each}
  </div>

  <ul class="sources">
    {#each parts as p (p.key)}
      <li>
        <span class="name" style:--key={p.color}>{p.name}</span>
        <span class="from">{p.from}</span>
        {#if p.key === 'text' && pads > 0}
          <span class="from"><BasisTag kind="code" /> {fmt(c.memory.padNote, { n: pads })}</span>
        {:else if p.key === 'text' && paperLibero}
          <span class="from"><BasisTag kind="paper" /> {fmt(c.memory.paperPadNote, { rows: codeRows })}</span>
        {/if}
      </li>
    {/each}
  </ul>

  <p class="note">{c.memory.scaleNote}</p>
  <SegmentBar segments={counts} width={540} label={c.memory.ratioLabel} />
</div>

<style>
  .memory {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: var(--fs-sm);
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-sm);
    line-height: 16px;
    white-space: nowrap;
  }

  .sources {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--fs-xs);
  }

  .sources li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 8px;
  }

  .name {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 700;
  }

  .name::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--key);
  }

  .from {
    color: var(--muted);
  }
</style>
