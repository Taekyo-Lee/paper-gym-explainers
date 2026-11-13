<script lang="ts">
  // 지시문 encoder (Eq. 3). 토큰을 누르면 그 토큰의 Z^l 행을 띠로 본다.
  import { copyFor, fmt } from '../../../content/i18n'
  import { rowView, shapeOf } from '../../../engine/tensor'
  import { ui } from '../../../state/store.svelte'
  import { hl } from '../../../state/highlight.svelte'
  import BasisTag from '../../BasisTag.svelte'
  import CaveatMark from '../../CaveatMark.svelte'
  import Sym from '../../Sym.svelte'
  import { robustLimit } from '../../viz/color'
  import MatrixCanvas from '../../viz/MatrixCanvas.svelte'
  import StripAxis from '../../viz/StripAxis.svelte'
  import VectorStrip from '../../viz/VectorStrip.svelte'

  const WIDTH = 520
  const MATRIX = 380
  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  // 텐서를 따로 받아서 같은 객체면 다시 그리지 않게 한다 (EncoderVision 참고)
  const Zl = $derived(ui.trace.Zl)
  const tokens = $derived(t.tokens.text)
  const selected = $derived(ui.selectedWord)
  const token = $derived(tokens[selected])
  const row = $derived(rowView(Zl, selected))
  const limit = $derived(robustLimit(Zl.data))
  const hasPad = $derived(t.textKeyPadding.some((v) => v === 1))
  const concepts = $derived(
    token.kind === 'pad'
      ? c.encoders.conceptsPad
      : token.concepts?.length
        ? fmt(c.encoders.conceptsOn, { names: token.concepts.join(', ') })
        : c.encoders.conceptsNone,
  )
  // 논문 기준 + LIBERO: 공식 코드는 [PAD]로 21칸을 채운다는 것을 "논문" 표시와 함께 밝힌다
  const paperNote = $derived(t.config.basis === 'paper' && t.config.profile === 'libero')
</script>

<div class="text">
  <p class="lead">{c.encoders.textLead} <CaveatMark id="tokenizer" /></p>

  <div class="encoder">
    <span class="name">BERT-base-uncased</span>
    <span class="tag">{c.encoders.frozen}</span>
    <CaveatMark id="encoders-not-run" />
  </div>

  <div class="cols">
  <div class="left">
  <div class="chips" role="group" aria-label={c.encoders.tokensLabel} {@attach hl('x')}>
    {#each tokens as tok (tok.index)}
      <button
        type="button"
        class:special={tok.kind !== 'word'}
        class:pad={tok.kind === 'pad'}
        aria-pressed={tok.index === selected}
        lang="en"
        onclick={() => ui.pickWord(tok.index)}
      >
        {tok.name}
      </button>
    {/each}
  </div>

  <section>
    <h4>
      <span lang="en">“{token.name}”</span>
      <span class="shape">[1 × {Zl.cols}]</span>
    </h4>
    <StripAxis width={WIDTH} />
    <VectorStrip values={row} width={WIDTH} height={20} {limit} label={token.name} />
    <p class="concepts">{concepts}</p>
  </section>
  {#if hasPad}
    <p class="pad-note"><BasisTag kind="code" /> {c.encoders.padNote}</p>
  {:else if paperNote}
    <p class="pad-note"><BasisTag kind="paper" /> {c.encoders.zlPaperNote}</p>
  {/if}
  </div>

  <figure {@attach hl('Zl')}>
    <MatrixCanvas
      tensor={Zl}
      width={MATRIX}
      height={Math.min(260, Zl.rows * 12)}
      selectedRow={selected}
      onRowSelect={(r) => ui.pickWord(r)}
      rowText={(r) => tokens[r]?.name ?? ''}
      label={fmt(c.encoders.zlLabel, { shape: shapeOf(Zl) })}
    />
    <figcaption>
      <Sym k="Zl" kind /> <span class="shape">{shapeOf(Zl)}</span>
      <span class="small">{c.encoders.zlCaption}</span>
    </figcaption>
  </figure>
  </div>
</div>

<style>
  .text {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .encoder {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-xs);
  }

  .encoder .name {
    color: var(--language-ink);
    font-weight: 700;
  }

  .tag {
    padding: 0 7px;
    border-radius: var(--radius-pill);
    background: var(--sunken);
    color: var(--muted);
    font-weight: 700;
  }

  .cols {
    display: flex;
    gap: 28px;
    align-items: flex-start;
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 520px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chips button {
    padding: 2px 9px;
    border: 1.5px solid var(--language);
    border-radius: var(--radius-sm);
    background: var(--language-fill);
    color: var(--ink);
    font-size: var(--fs-sm);
  }

  .chips button.special {
    border-style: dashed;
    color: var(--language-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }

  .chips button.pad {
    border-color: var(--line-strong);
    background: transparent;
    color: var(--muted);
  }

  /* 고른 토큰은 테두리와 굵기로 표시한다. outline은 키보드 focus 표시(base.css)에 남겨 둔다 */
  .chips button[aria-pressed='true'] {
    border-style: solid;
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1.5px var(--accent);
    color: var(--ink);
    font-weight: 700;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  h4 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    font-size: var(--fs-sm);
  }

  .concepts {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  figure {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }

  figcaption {
    font-size: var(--fs-xs);
  }

  .small {
    margin-left: 6px;
    color: var(--muted);
  }

  /* 표시와 문장이 한 문단 안에서 이어지게 한다 */
  .pad-note {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.6;
  }
</style>
