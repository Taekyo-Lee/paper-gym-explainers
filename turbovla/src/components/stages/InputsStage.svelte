<script lang="ts">
  // Inputs 단계: 카메라 이미지, 지시문, 로봇 state.
  import { copyFor, fmt, joinList } from '../../content/i18n'
  import { INSTRUCTION_PRESETS } from '../../content/instructions'
  import { shapeOf } from '../../engine/tensor'
  import type { ObjectId } from '../../engine/types'
  import { ui } from '../../state/store.svelte'
  import { hl } from '../../state/highlight.svelte'
  import CaveatMark from '../CaveatMark.svelte'
  import InfoMark from '../InfoMark.svelte'
  import Sym from '../Sym.svelte'
  import SceneView from '../viz/SceneView.svelte'
  import StateSliders from './inputs/StateSliders.svelte'

  const c = $derived(copyFor(ui.lang))
  const cfg = $derived(ui.config)
  const views = $derived(ui.trace.views)
  const size = $derived(views.length === 3 ? 118 : views.length === 2 ? 156 : 240)
  const legend = $derived(
    cfg.profile === 'robotwin' && cfg.stateDim === 14
      ? c.inputs.sliderLegendRobotwin
      : cfg.stateDim === 8
        ? c.inputs.sliderLegendLibero
        : '',
  )

  /** 그림 대신 읽어 줄 설명: 그 view에 patch 반 개 이상 보이는 물체 (넓게 보이는 순) */
  function cameraAlt(viewIndex: number): string {
    const totals = new Map<ObjectId, number>()
    for (const tok of ui.trace.tokens.visual) {
      if (tok.view !== viewIndex) continue
      for (const [id, v] of Object.entries(tok.coverage ?? {}) as [ObjectId, number][]) totals.set(id, (totals.get(id) ?? 0) + v)
    }
    const objects = [...totals]
      .filter(([id, v]) => id !== 'table' && v >= 0.5)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => c.objects[id])
      .join(', ')
    return fmt(c.inputs.cameraAlt, { view: views[viewIndex].name, objects })
  }
  const stateNote = $derived(
    cfg.profile === 'robotwin' && cfg.stateDim === 14
      ? c.inputs.stateNoteRobotwin
      : cfg.stateDim === 8
        ? c.inputs.stateNoteLibero
        : c.inputs.stateNoteCustom,
  )
</script>

<div class="inputs">
  <div class="row">
    <section class="cams" {@attach hl('O')}>
      <header>
        <h3>{c.inputs.camerasTitle}</h3>
        <span class="shape">[{cfg.K} × {cfg.imageSize} × {cfg.imageSize} × 3]</span>
        <CaveatMark id="scene-views" />
      </header>
      <div class="views">
        {#each views as v, i (v.name)}
          <figure>
            <SceneView view={v} {size} label={cameraAlt(i)} />
            <figcaption>{v.name}</figcaption>
          </figure>
        {/each}
      </div>
      <!-- 카메라 수와 이름을 글로 밝힌다 (그림 수를 세어 짐작하지 않게). 그림이 설명용이라는 것은 제목 옆 주의 표시가 맡는다 -->
      <p class="note">{fmt(c.inputs.camerasCount, { k: views.length, names: joinList(views.map((v) => v.name), ui.lang) })}</p>
    </section>

    <section class="instr" {@attach hl('x')}>
      <header>
        <h3>{c.inputs.instructionTitle} <Sym k="x" kind /></h3>
        <CaveatMark id="real-robot-shapes" />
      </header>
      <p class="instruction" lang="en">{ui.instruction || '…'}</p>
      <div class="presets" role="group" aria-label={c.inputs.presetsLabel}>
        {#each INSTRUCTION_PRESETS as text (text)}
          <button type="button" lang="en" aria-pressed={ui.instruction === text} onclick={() => (ui.instruction = text)}>
            {text}
          </button>
        {/each}
      </div>
      <p class="note">{c.inputs.instructionNote}</p>
    </section>
  </div>

  <section {@attach hl('s')}>
    <header>
      <h3>{c.inputs.stateTitle} <Sym k="s" kind /></h3>
      <span class="shape">{shapeOf(ui.trace.state.s)}</span>
      {#if legend}<InfoMark label={c.inputs.sliderLegendLabel} title={c.inputs.sliderLegendTitle} body={legend} />{/if}
      <button type="button" class="reset" onclick={() => ui.resetState()}>{c.inputs.reset}</button>
    </header>
    <StateSliders />
    <p class="note">{stateNote}</p>
  </section>
</div>

<style>
  .inputs {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .row {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  /* 카메라 열의 폭은 그림 줄의 폭에 맞추고, 설명은 그 안에서 줄바꿈한다 */
  .cams {
    flex: none;
    width: min-content;
  }

  .cams header {
    white-space: nowrap;
  }

  .instr {
    flex: 1;
    min-width: 180px;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* 제목 옆의 종류 이름표가 길어도 주의 표시가 패널 밖으로 밀려나지 않게 줄을 바꾼다 */
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
  }

  h3 {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 6px;
    margin: 0;
    font-size: var(--fs-md);
    font-weight: 700;
  }

  .views {
    display: flex;
    gap: 8px;
  }

  figure {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }

  figcaption {
    color: var(--vision-ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .instruction {
    margin: 0;
    padding: 8px 12px;
    border-left: 3px solid var(--language);
    border-radius: var(--radius-sm);
    background: var(--language-fill);
    color: var(--ink);
    font-size: var(--fs-md);
    font-weight: 500;
  }

  .presets {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .presets button {
    padding: 3px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--language-ink);
    font-size: var(--fs-xs);
    text-align: left;
  }

  .presets button[aria-pressed='true'] {
    border-color: var(--language);
    background: var(--language-fill);
    font-weight: 700;
  }

  .reset {
    margin-left: auto;
    padding: 2px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .reset:hover {
    color: var(--ink);
  }
</style>
