<script lang="ts">
  // 이미지 encoder (Eq. 4). patch 격자 그림, Z^v 행렬, Eq. 4 분해 띠가 같은 patch를 가리킨다.
  import { copyFor, fmt } from '../../../content/i18n'
  import { rowView, shapeOf } from '../../../engine/tensor'
  import type { ObjectId } from '../../../engine/types'
  import { ui } from '../../../state/store.svelte'
  import { hl } from '../../../state/highlight.svelte'
  import BasisTag from '../../BasisTag.svelte'
  import CaveatMark from '../../CaveatMark.svelte'
  import { g } from '../../../content/glossary'
  import InfoMark from '../../InfoMark.svelte'
  import KindTag from '../../KindTag.svelte'
  import Sym from '../../Sym.svelte'
  import { robustLimit } from '../../viz/color'
  import MatrixCanvas from '../../viz/MatrixCanvas.svelte'
  import SceneView from '../../viz/SceneView.svelte'
  import StripAxis from '../../viz/StripAxis.svelte'
  import VectorStrip from '../../viz/VectorStrip.svelte'

  const STRIP = 300
  /** Eq. 4 첫 항. 안쪽 기호(P_v, f_img, I)도 각자 풀이가 있다 */
  const PV_TEX = String.raw`${g('Pv', 'P_v')}(${g('fimg', String.raw`f_{\text{img}}`)}(${g('I', String.raw`I^{(i)}_t`)}))`
  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  const cfg = $derived(t.config)
  const views = $derived(t.views)
  const grid = $derived(views[0].grid)
  const P = $derived(grid * grid)
  const index = $derived(ui.selectedPatch)
  const token = $derived(t.tokens.visual[index])
  const view = $derived(views[token.view ?? 0])
  const backbone = $derived(cfg.profile === 'robotwin' ? 'DINOv3 ViT-L/16' : 'DINOv3 ViT-B/16')

  // 엔진은 단계별로 memo하므로 state 슬라이더만 바뀌면 아래 텐서는 같은 객체다.
  // 텐서마다 따로 $derived로 받아서, 같은 객체면 행렬과 띠를 다시 그리지 않게 한다.
  const Zv = $derived(ui.trace.Zv)
  const content = $derived(ui.trace.Zv_parts.content)
  const pos = $derived(ui.trace.Zv_parts.pos)
  const posScale = $derived(ui.trace.Zv_parts.posScale)
  const viewEmb = $derived(ui.trace.Zv_parts.view)
  const rows = $derived({
    content: rowView(content, index),
    pos: pos ? rowView(pos, index) : null,
    view: rowView(viewEmb, index),
    sum: rowView(Zv, index),
  })
  // 네 띠가 같은 색 범위를 써야 크기를 비교할 수 있다
  const limit = $derived(robustLimit(rows.sum))

  const sees = $derived(
    (Object.entries(token.coverage ?? {}) as [ObjectId, number][])
      .filter(([, v]) => v >= 0.05)
      .sort((a, b) => b[1] - a[1])
      .map(([id, v]) => `${c.objects[id]} ${Math.round(v * 100)}%`)
      .join(', '),
  )

  // view 경계: 막대 색을 번갈아(진한 색, 옅은 색) 쓰고 view 이름을 글자로도 단다
  const groups = $derived(
    views.map((v, i) => ({
      start: i * P,
      end: (i + 1) * P,
      color: i % 2 ? 'color-mix(in srgb, var(--vision) 40%, var(--card))' : 'var(--vision)',
      label: v.name,
    })),
  )

  const patchText = (r: number) => {
    const tok = t.tokens.visual[r]
    return fmt(c.encoders.patchAt, { view: views[tok.view ?? 0].name, gx: tok.gx ?? 0, gy: tok.gy ?? 0 })
  }

  const pBody = $derived(
    fmt(c.encoders.pBody, { side: cfg.imageSize, patch: cfg.patchSize, P, K: views.length, rows: Zv.rows }),
  )

  function pick(viewIndex: number, gx: number, gy: number) {
    ui.patchPick = viewIndex * P + gy * grid + gx
  }
</script>

<div class="vision">
  <p class="lead">{c.encoders.visionLead} <CaveatMark id="encoders-not-run" /></p>

  <div class="cols">
    <div class="picture">
      <div class="encoder">
        <span class="name">{backbone}</span>
        <span class="tag">{c.encoders.trainable}</span>
      </div>
      <SceneView
        {view}
        size={200}
        grid
        selected={{ gx: token.gx ?? 0, gy: token.gy ?? 0 }}
        onPatch={(gx, gy) => pick(token.view ?? 0, gx, gy)}
        label={c.encoders.patchGrid}
        roleDescription={c.encoders.patchGrid}
        valueText={patchText(index)}
      />
      {#if views.length > 1}
        <div class="viewbtns" role="group" aria-label={c.encoders.viewsLabel}>
          {#each views as v, i (v.name)}
            <button type="button" aria-pressed={i === token.view} onclick={() => pick(i, token.gx ?? 0, token.gy ?? 0)}>{v.name}</button>
          {/each}
        </div>
      {/if}
      <p class="info" aria-live="polite">
        <strong>{patchText(index)}</strong>
        {fmt(c.encoders.patchSees, { objects: sees })}
      </p>
    </div>

    <figure class="zv" {@attach hl('Zv')}>
      <MatrixCanvas
        tensor={Zv}
        width={120}
        height={200}
        rowGroups={groups}
        groupLabels
        selectedRow={index}
        onRowSelect={(r) => (ui.patchPick = r)}
        rowText={patchText}
        label={fmt(c.encoders.zvLabel, { shape: shapeOf(Zv) })}
      />
      <figcaption>
        <span class="shape-line">
          <Sym k="Zv" /> <span class="shape">{shapeOf(Zv)}</span>
          <InfoMark label={c.encoders.pLabel} title={c.encoders.pTitle} body={pBody} />
        </span>
        <span class="small">{c.encoders.zvCaption}</span>
      </figcaption>
    </figure>

    <section class="eq4">
      <div class="head">
        <h4>{c.encoders.eq4Title}</h4>
        <CaveatMark id="concept-channels" />
      </div>
      <div class="grid" style:--strip="{STRIP}px">
        <span></span>
        <StripAxis width={STRIP} />

        <!-- 항마다 기호, 종류, 이름을 보인다. 기호에 마우스를 올리면 뜻이 뜬다 -->
        <span class="term">
          <Sym k="Pvf" tex={PV_TEX} /><KindTag kind="tensor" />
          <small>{c.encoders.eq4Content}</small>
        </span>
        <div {@attach hl('Pv')}><VectorStrip values={rows.content} width={STRIP} {limit} label={c.encoders.eq4Content} /></div>

        <span class="term">
          <span class="op">+</span>{#if posScale}<Sym k="posScale" />&nbsp;·&nbsp;{/if}<Sym k="Epos" /><KindTag kind="embedding" />
          <small>{c.encoders.eq4Pos}</small>
        </span>
        {#if rows.pos}
          <div class="with-note">
            <div {@attach hl('Epos')}><VectorStrip values={rows.pos} width={STRIP} {limit} label={c.encoders.eq4Pos} /></div>
            <span class="note">
              {#if posScale}
                <BasisTag kind="code" />
                {fmt(c.encoders.eq4PosScale, { s: posScale[token.view ?? 0] })}
                <CaveatMark id="gamma-virtual" />
              {:else}
                <!-- 논문 기준: 공식 코드와 다른 곳이므로 "논문" 표시와 코드가 하는 일을 함께 단다 -->
                <BasisTag kind="paper" />
                {cfg.profile === 'libero' ? c.encoders.eq4NoPosInCode : c.encoders.eq4PosInCodeRobotwin}
                <CaveatMark id="epos-values" />
              {/if}
            </span>
          </div>
        {:else}
          <p class="absent" {@attach hl('Epos')}><BasisTag kind="code" /> {c.encoders.eq4NoPos}</p>
        {/if}

        <span class="term">
          <span class="op">+</span><Sym k="eview" /><KindTag kind="embedding" />
          <small>{c.encoders.eq4View}</small>
        </span>
        <div {@attach hl('eview')}><VectorStrip values={rows.view} width={STRIP} {limit} label={c.encoders.eq4View} /></div>

        <span class="term sum">
          <span class="op">=</span><Sym k="Zvi" /><KindTag kind="tensor" />
          <small>{c.encoders.eq4Sum}</small>
        </span>
        <div {@attach hl('Zvi')}><VectorStrip values={rows.sum} width={STRIP} height={20} {limit} label={c.encoders.eq4Sum} /></div>
      </div>
      <!-- 첫 항 안쪽의 기호: 무엇이 모델이고 무엇이 입력인지 -->
      <p class="inner">
        <span class="inner-label">{c.encoders.eq4Inner}</span>
        <Sym k="fimg" kind name />
        <Sym k="Pv" kind name />
        <Sym k="I" kind name />
        <Sym k="i" kind name />
      </p>
    </section>
  </div>
</div>

<style>
  .vision {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .cols {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  .picture {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 216px;
    flex: none;
  }

  .encoder {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    font-size: var(--fs-xs);
  }

  .encoder .name {
    color: var(--vision-ink);
    font-weight: 700;
  }

  .tag {
    padding: 0 7px;
    border-radius: var(--radius-pill);
    background: var(--vision-fill);
    color: var(--vision-ink);
    font-weight: 700;
  }

  .viewbtns {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .viewbtns button {
    padding: 1px 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .viewbtns button[aria-pressed='true'] {
    border-color: var(--vision);
    background: var(--vision-fill);
    color: var(--vision-ink);
    font-weight: 700;
  }

  .info {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .info strong {
    color: var(--ink);
    margin-right: 4px;
  }

  .zv {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    flex: none;
  }

  figcaption {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-xs);
    max-width: 150px;
  }

  .shape-line {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .small {
    color: var(--muted);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 4px;
  }

  h4 {
    margin: 0;
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .eq4 {
    margin-top: 24px;
    flex: none;
  }

  .grid {
    display: grid;
    grid-template-columns: 224px var(--strip);
    align-items: center;
    gap: 6px 10px;
  }

  .term {
    display: flex;
    align-items: baseline;
    gap: 2px 6px;
    flex-wrap: wrap;
    font-size: var(--fs-sm);
  }

  .term small {
    width: 100%;
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 400;
  }

  .inner {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 14px;
    max-width: 534px;
    margin: 10px 0 0;
    font-size: var(--fs-sm);
  }

  .inner-label {
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .op {
    width: 12px;
    color: var(--muted);
    font-weight: 700;
  }

  .sum {
    font-weight: 700;
  }

  .with-note {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* 표시, 문장, 주의 아이콘이 한 문단 안에서 이어지게 한다 (flex로 두면 긴 문장이 통째로 다음 줄로 밀린다) */
  .note,
  .absent {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.6;
  }

  .absent {
    min-height: 16px;
    padding: 2px 8px;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-sm);
  }
</style>
