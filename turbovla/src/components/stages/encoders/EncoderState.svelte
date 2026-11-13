<script lang="ts">
  // state encoder f_state (Eq. 5). 구조는 공식 코드를 따른다 (caveat internals-from-code).
  // 마지막 Linear의 출력 하나(1 × N_s·256)를 256칸씩 잘라 토큰 N_s개가 되는 모습을 띠로 보여 준다.
  import { copyFor, fmt, num } from '../../../content/i18n'
  import { conceptIndex } from '../../../engine/concepts'
  import { rowView, shapeOf } from '../../../engine/tensor'
  import { ui } from '../../../state/store.svelte'
  import { hl } from '../../../state/highlight.svelte'
  import CaveatMark from '../../CaveatMark.svelte'
  import Sym from '../../Sym.svelte'
  import { robustLimit } from '../../viz/color'
  import MatrixCanvas from '../../viz/MatrixCanvas.svelte'
  import VectorStrip from '../../viz/VectorStrip.svelte'

  const WIDTH = 380
  const SPLIT_WIDTH = 520
  const CUT = 10
  const c = $derived(copyFor(ui.lang))
  const cfg = $derived(ui.trace.config)
  const s = $derived(ui.trace.state.s)
  const split = $derived(ui.trace.state.split)
  const Zs = $derived(ui.trace.state.Zs)
  const Ns = $derived(Zs.rows)
  const D = $derived(Zs.cols)
  const limit = $derived(robustLimit(Zs.data))
  const splitLimit = $derived(robustLimit(split.data))
  const sLimit = $derived(Math.max(1, ...Array.from(s.data, Math.abs)))
  const pieceWidth = $derived(Math.floor((SPLIT_WIDTH - (Ns - 1) * CUT) / Ns))
  const pieces = $derived(Array.from({ length: Ns }, (_, i) => i))
  const proprio = conceptIndex('proprio')
  const steps = $derived([
    { name: 'LayerNorm', shape: `[1 × ${cfg.stateDim}]` },
    { name: 'Linear', shape: `[1 × ${cfg.stateDim}] → [1 × ${D}]` },
    { name: 'GELU', shape: `[1 × ${D}]` },
    { name: 'Linear', shape: `[1 × ${D}] → [1 × ${Ns * D}]` },
    { name: fmt(c.encoders.flowSplit, { n: Ns }), shape: `[${Ns} × ${D}]` },
    { name: c.encoders.flowPos, shape: `[${Ns} × ${D}]` },
    { name: 'LayerNorm', shape: `[${Ns} × ${D}]` },
  ])
  const proprioValues = $derived(
    pieces.map((i) => `${fmt(c.encoders.stateToken, { i: i + 1 })} = ${num(rowView(Zs, i)[proprio])}`).join(', '),
  )
</script>

<div class="state">
  <p class="lead">{fmt(c.encoders.stateLead, { n: Ns })} <CaveatMark id="internals-from-code" /></p>

  <div class="cols">
    <div class="left">
      <section {@attach hl('s')}>
        <h4>{c.encoders.stInput} <Sym k="s" kind /> <span class="shape">{shapeOf(s)}</span></h4>
        <div class="cells">
          {#each Array.from(s.data) as v, i (i)}
            <span class="cell" style:--w={Math.min(1, Math.abs(v) / sLimit)}>{num(v)}</span>
          {/each}
        </div>
      </section>

      <section {@attach hl('fstate')}>
        <h4><Sym k="fstate" kind /> {c.encoders.fstateTitle}</h4>
        <ol class="flow">
          {#each steps as step, i (i)}
            <li>
              {#if i > 0}<span class="arrow" aria-hidden="true"></span>{/if}
              <span class="step">
                <span class="box">{step.name}</span>
                <span class="shape">{step.shape}</span>
              </span>
            </li>
          {/each}
        </ol>
      </section>

      <!-- 출력 하나를 잘라 토큰 N_s개가 되는 모습 -->
      <section {@attach hl('fstate')}>
        <h4>{c.encoders.splitTitle} <span class="shape">[1 × {Ns * D}]</span></h4>
        <div class="pieces">
          {#each pieces as i (i)}
            {#if i > 0}<span class="cut" style:width="{CUT}px" aria-hidden="true"></span>{/if}
            <div class="piece">
              <VectorStrip values={rowView(split, i)} width={pieceWidth} limit={splitLimit} label={fmt(c.encoders.splitPart, { from: i * D, to: (i + 1) * D - 1, i: i + 1 })} />
              <span class="piece-label">{fmt(c.encoders.splitPart, { from: i * D, to: (i + 1) * D - 1, i: i + 1 })}</span>
            </div>
          {/each}
        </div>
        <p class="note">{fmt(c.encoders.splitNote, { total: Ns * D, n: Ns, d: D })}</p>
      </section>
    </div>

    <div class="right">
      <section {@attach hl('Zs')}>
        <div class="head">
          <h4>
            <Sym k="Zs" kind /> <span class="shape">{shapeOf(Zs)}</span>
            <span class="small">{c.encoders.zsCaption}</span>
          </h4>
          <CaveatMark id="designed-queries" />
        </div>
        <p class="note">{c.encoders.zsAfter}</p>
        <MatrixCanvas tensor={Zs} width={WIDTH} height={Ns * 16} label={fmt(c.encoders.zsLabel, { shape: shapeOf(Zs) })} />
        {#each pieces as i (i)}
          <div class="token">
            <span class="name">{fmt(c.encoders.stateToken, { i: i + 1 })}</span>
            <VectorStrip values={rowView(Zs, i)} width={WIDTH} {limit} label={fmt(c.encoders.stateToken, { i: i + 1 })} />
          </div>
        {/each}
        <p class="note">{fmt(c.encoders.proprioNote, { dim: proprio, values: proprioValues })}</p>
      </section>
    </div>
  </div>
</div>

<style>
  .state {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .cols {
    display: flex;
    gap: 28px;
    align-items: flex-start;
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 520px;
    flex: none;
  }

  .right {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 380px;
    flex: none;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  h4 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 0;
    font-size: var(--fs-sm);
  }

  .small {
    color: var(--muted);
    font-weight: 400;
    font-size: var(--fs-xs);
  }

  .cells {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  /* 값이 클수록 칸을 진하게. 섞는 비율은 50%까지만: dark 테마에서 글자 대비 4.5:1을 지킨다 */
  .cell {
    min-width: 44px;
    padding: 2px 4px;
    border: 1px solid var(--state);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--state-fill) calc((1 - var(--w)) * 100%), var(--state) calc(var(--w) * 50%));
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-align: center;
  }

  /* 줄이 바뀌면 화살표가 새 줄의 맨 앞에 오도록 화살표를 단계 앞에 붙인다 */
  .flow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .flow li {
    display: flex;
    align-items: flex-start;
  }

  .arrow {
    position: relative;
    flex: none;
    width: 20px;
    height: 26px;
  }

  .arrow::after {
    content: '';
    position: absolute;
    top: 13px;
    left: 5px;
    width: 7px;
    height: 7px;
    border-top: 1.5px solid var(--muted);
    border-right: 1.5px solid var(--muted);
    transform: translateY(-50%) rotate(45deg);
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .box {
    padding: 3px 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    font-size: var(--fs-xs);
    font-weight: 500;
    white-space: nowrap;
  }

  .pieces {
    display: flex;
    align-items: flex-start;
  }

  .piece {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .piece-label {
    color: var(--state-ink);
    font-size: var(--fs-xs);
  }

  /* 자르는 곳: 점선 */
  .cut {
    align-self: stretch;
    flex: none;
    background: linear-gradient(var(--muted) 50%, transparent 50%) center / 1.5px 6px repeat-y;
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .token {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .token .name {
    color: var(--state-ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }
</style>
