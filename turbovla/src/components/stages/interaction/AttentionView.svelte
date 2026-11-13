<script lang="ts">
  // 두 방향 attention. 같은 score 행렬 S를 가운데 두고,
  // 왼쪽은 S를 행마다(지시 축) softmax한 A_{v←l}, 오른쪽은 Sᵀ를 행마다(이미지 축) softmax한 A_{l←v}.
  // 단어를 고르면 A_{v←l}의 그 열을 장면 위 heatmap으로, patch를 고르면 A_{l←v}의 그 열을 단어 칩 아래 막대로 보여 준다.
  import { copyFor, fmt } from '../../../content/i18n'
  import { shapeOf } from '../../../engine/tensor'
  import { heatOpacity, maxOf, patchColumn, wordHeat } from '../../../state/attention'
  import { ui } from '../../../state/store.svelte'
  import { hl } from '../../../state/highlight.svelte'
  import BasisTag from '../../BasisTag.svelte'
  import CaveatMark from '../../CaveatMark.svelte'
  import InfoMark from '../../InfoMark.svelte'
  import Sym from '../../Sym.svelte'
  import { robustLimit } from '../../viz/color'
  import MatrixCanvas from '../../viz/MatrixCanvas.svelte'
  import SceneView from '../../viz/SceneView.svelte'
  import WordChips from './WordChips.svelte'

  /** 세 행렬의 높이 (K·P 행을 줄여 그린다) */
  const TALL = 104

  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  const layer = $derived(t.layers[ui.interLayer - 1])
  const h = $derived(ui.interHead - 1)
  const S = $derived(layer.S[h])
  const Avl = $derived(layer.A_v_from_l[h])
  const Alv = $derived(layer.A_l_from_v[h])
  const active = $derived(layer.active)
  const views = $derived(t.views)
  const grid = $derived(views[0].grid)
  const P = $derived(grid * grid)
  const word = $derived(ui.selectedWord)
  const patch = $derived(ui.selectedPatch)
  const wordTok = $derived(t.tokens.text[word])
  const patchTok = $derived(t.tokens.visual[patch])
  /** 가리지 않은 단어 수 ([PAD]는 V←L에서 가린다) */
  const keys = $derived(t.textKeyPadding.reduce((n, v) => n + (v ? 0 : 1), 0))
  const uniform = $derived(1 / Math.max(1, keys))
  const heat = $derived(heatOpacity(wordHeat(Avl, word, views), uniform))
  /** 칠하는 최대 투명도: 그릇 색이 비쳐 보이도록 0.7까지만 */
  const shade = $derived(heat.opacity.map((v) => Float32Array.from(v, (x) => x * 0.7)))
  const bars = $derived(patchColumn(Alv, patch))
  const barMax = $derived(maxOf(Alv.data))
  /** A_{l←v}의 색 끝값 (행마다 patch K·P개에 나뉘어 값이 작다). 화면에 숫자로 밝힌다 */
  const alvLimit = $derived(robustLimit(Alv.data))
  const hasPad = $derived(t.textKeyPadding.some((v) => v === 1))
  const padWord = $derived(wordTok.kind === 'pad')
  /** 한 방향 모드에서는 꺼진 방향을 머리말에서 밝힌다 (행렬 위에 덮지 않는다) */
  const lead = $derived(!active.vFromL ? c.interaction.leadOffV : !active.lFromV ? c.interaction.leadOffL : c.interaction.attnLead)
  /** 고른 view에서는 그 patch의 heat 값까지, 다른 view에서는 고른 patch가 없다고 읽어 준다 */
  const sceneValue = (i: number) =>
    patchTok.view === i
      ? `${patchText(patch)}, ${fmt(c.interaction.heatValue, { word: wordTok.name, v: Avl.data[patch * Avl.cols + word].toFixed(2) })}`
      : c.interaction.noPatchHere
  const viewSize = $derived(views.length >= 3 ? 76 : 112)
  /** A_{l←v} 카드는 아래에 색 끝값 한 줄이 더 있어서, 두 카드의 높이가 같도록 행렬을 그만큼 낮춘다 */
  const lHeight = $derived(Math.max(48, Math.min(TALL - 18, Alv.rows * 16)))

  const patchText = (r: number) => {
    const tok = t.tokens.visual[r]
    return fmt(c.encoders.patchAt, { view: views[tok.view ?? 0].name, gx: tok.gx ?? 0, gy: tok.gy ?? 0 })
  }
  const wordText = (r: number) => t.tokens.text[r]?.name ?? ''
</script>

<div class="attention">
  <p class="lead">{lead} <CaveatMark id="attention-maps" /></p>

  <!-- 단어 고르기. 막대 = 고른 patch가 단어들에 받은 L←V attention (A_{l←v}의 열 하나) -->
  <div class="words">
    <WordChips
      tokens={t.tokens.text}
      selected={word}
      onPick={(i) => ui.pickWord(i)}
      label={c.interaction.wordsTitle}
      {bars}
      {barMax}
      barText={(v) => fmt(c.interaction.barValue, { v: v.toFixed(3) })}
    >
      {#snippet after()}
        {#if hasPad}
          <span class="pad-mark"><BasisTag kind="code" /><InfoMark label={c.interaction.padBarsLabel} title={c.interaction.padBarsTitle} body={c.interaction.padBarsBody} /></span>
        {/if}
      {/snippet}
    </WordChips>
    <p class="note">{c.interaction.barsNote}. {fmt(c.interaction.patchPicked, { patch: patchText(patch) })}</p>
  </div>

  <div class="cols">
    <!-- 장면: 고른 단어의 V←L heatmap, patch 고르기 -->
    <section class="scene">
      <div class="views">
        {#each views as v, i (v.name)}
          <figure>
            <SceneView
              view={v}
              size={viewSize}
              heat={shade[i]}
              heatColor="var(--vision)"
              selected={patchTok.view === i ? { gx: patchTok.gx ?? 0, gy: patchTok.gy ?? 0 } : null}
              onPatch={(gx, gy) => (ui.patchPick = i * P + gy * grid + gx)}
              label="{c.encoders.patchGrid}: {v.name}"
              roleDescription={c.encoders.patchGrid}
              valueText={sceneValue(i)}
            />
            <figcaption>{v.name}</figcaption>
          </figure>
        {/each}
      </div>
      <div class="legend">
        <span class="swatch" aria-hidden="true"></span>
        <strong>{fmt(c.interaction.heatLegend, { word: wordTok.name })}</strong>
        <InfoMark
          label={c.interaction.heatInfoLabel}
          title={c.interaction.heatInfoTitle}
          body={fmt(c.interaction.heatNote, { n: keys, u: uniform.toFixed(2), top: heat.top.toFixed(2), max: heat.max.toFixed(2) })}
        />
      </div>
      <!-- 칠한 칸이 없을 때는 그 이유를 밝힌다 ([PAD]는 V←L key에서 가린다, 공식 코드) -->
      {#if padWord}
        <p class="note"><BasisTag kind="code" /> {c.interaction.heatPad}</p>
      {:else if !heat.painted}
        <p class="note">{c.interaction.heatEmpty}</p>
      {/if}
    </section>

    <!-- V←L: 이미지가 Q -->
    <section class="dir">
      <header>
        <Sym k="Avl" kind />
        <span class="shape">{shapeOf(Avl)}</span>
        <span class="small">{c.interaction.rowSum}</span>
      </header>
      <div class="roles">
        <!-- Attn_{v←l}(V^{ℓ-1}, L^{ℓ-1})의 두 인자: Q = 이미지 stream, K·V = 지시 stream (수식 하이라이트 Vprev, Lprev) -->
        <span class="chip vision" {@attach hl('Vprev')}><b>{c.interaction.q}</b> {c.modality.vision}</span>
        <span class="chip language" {@attach hl('Lprev')}><b>{c.interaction.kv}</b> {c.modality.language}</span>
        <span class="ask">{c.interaction.askImage}</span>
        <InfoMark label={fmt(c.interaction.dirInfoLabel, { dir: c.interaction.dirVTitle })} title={c.interaction.dirVTitle} body={c.interaction.dirVBody} />
      </div>
      <p class="name" lang="en">Visual Queries Language <span class="src">Tab. 5</span></p>
      <div class="plot" class:inactive={!active.vFromL} {@attach hl('AttnVL')}>
        <MatrixCanvas
          tensor={Avl}
          width={64}
          height={TALL}
          scale="vision"
          limit={1}
          zoom={false}
          selectedRow={patch}
          selectedCol={word}
          onRowSelect={(r) => (ui.patchPick = r)}
          onCellClick={(r, col) => {
            ui.patchPick = r
            ui.pickWord(col)
          }}
          rowText={patchText}
          label="{fmt(c.interaction.matrixVLabel, { shape: shapeOf(Avl) })}. {fmt(c.interaction.colorEnd, { x: '1.00' })}"
        />
      </div>
    </section>

    <!-- 공유 score S: 왼쪽으로 행마다 softmax, 오른쪽으로 뒤집어 행마다 softmax -->
    <section class="score">
      <header>
        <Sym k="S" kind />
        <span class="shape">{shapeOf(S)}</span>
        <CaveatMark id="internals-from-code" />
      </header>
      <p class="small">{c.interaction.sCaption}</p>
      <div class="s-row">
        <p class="arrow left"><span aria-hidden="true">←</span> {c.interaction.toVfromL}</p>
        <MatrixCanvas
          tensor={S}
          width={64}
          height={TALL}
          zoom={false}
          selectedRow={patch}
          selectedCol={word}
          label={fmt(c.interaction.matrixSLabel, { shape: shapeOf(S) })}
        />
        <p class="arrow right">{c.interaction.toLfromV} <span aria-hidden="true">→</span></p>
      </div>
    </section>

    <!-- L←V: 지시가 Q -->
    <section class="dir wide">
      <header>
        <Sym k="Alv" kind />
        <span class="shape">{shapeOf(Alv)}</span>
        <span class="small">{c.interaction.rowSum}</span>
      </header>
      <div class="roles">
        <span class="chip language" {@attach hl('Lprev')}><b>{c.interaction.q}</b> {c.modality.language}</span>
        <span class="chip vision" {@attach hl('Vprev')}><b>{c.interaction.kv}</b> {c.modality.vision}</span>
        <span class="ask">{c.interaction.askText}</span>
        <InfoMark label={fmt(c.interaction.dirInfoLabel, { dir: c.interaction.dirLTitle })} title={c.interaction.dirLTitle} body={c.interaction.dirLBody} />
      </div>
      <p class="name" lang="en">Language Queries Visual <span class="src">Tab. 5</span></p>
      <div class="plot" class:inactive={!active.lFromV} {@attach hl('AttnLV')}>
        <MatrixCanvas
          tensor={Alv}
          width={228}
          height={lHeight}
          scale="language"
          limit={alvLimit}
          zoom={false}
          selectedRow={word}
          selectedCol={patch}
          onRowSelect={(r) => ui.pickWord(r)}
          onCellClick={(r, col) => {
            ui.pickWord(r)
            ui.patchPick = col
          }}
          rowText={wordText}
          label="{fmt(c.interaction.matrixLLabel, { shape: shapeOf(Alv) })}. {fmt(c.interaction.colorEnd, { x: alvLimit.toFixed(3) })}"
        />
      </div>
      <!-- 두 행렬의 색 끝값이 달라(1과 약 0.02) 같은 진하기가 다른 값이다. 숫자로 밝힌다 -->
      <p class="small">
        {c.interaction.colorEndLead}
        <Sym k="Avl" /> 1.00,
        <Sym k="Alv" /> {alvLimit.toFixed(3)}
      </p>
    </section>
  </div>

</div>

<style>
  .attention {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .cols {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: none;
  }

  .scene {
    width: 240px;
    gap: 6px;
  }

  .views {
    display: flex;
    gap: 8px;
  }

  figure {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
  }

  figcaption {
    color: var(--vision-ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .legend {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: var(--fs-xs);
  }

  .swatch {
    flex: none;
    width: 30px;
    height: 10px;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--vision) 70%, transparent));
  }

  .pad-mark {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .note,
  .small {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.4;
  }

  .dir {
    width: 214px;
  }

  .dir.wide {
    width: 240px;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 6px;
    font-size: var(--fs-sm);
  }

  .roles {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .chip {
    padding: 0 7px;
    border: 1.5px solid;
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    line-height: 1.5;
    white-space: nowrap;
  }

  .chip.vision {
    border-color: var(--vision);
    background: var(--vision-fill);
    color: var(--vision-ink);
  }

  .chip.language {
    border-color: var(--language);
    background: var(--language-fill);
    color: var(--language-ink);
  }

  .ask {
    font-size: var(--fs-xs);
  }

  .name {
    margin: 0;
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .src {
    color: var(--muted);
  }

  .plot {
    position: relative;
  }

  .score {
    width: 184px;
    align-items: center;
    text-align: center;
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .arrow {
    width: 56px;
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.3;
  }

  .arrow.left {
    text-align: left;
  }

  .arrow.right {
    text-align: right;
  }

  /* 쓰지 않는 방향: 그림(canvas)만 흐리게 한다. 고른 행과 열 표시, focus 표시는 그대로 진하게 둔다 */
  .inactive :global(canvas) {
    opacity: 0.3;
  }
</style>
