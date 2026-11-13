<script lang="ts">
  // residual 업데이트 (Eq. 7). 고른 patch(V)와 단어(L)가 이 층에서 어떻게 바뀌는지 띠로 본다.
  // residual 위치는 기준을 따른다:
  //   논문           V^ℓ = V^{ℓ−1} + Attn             (Eq. 7을 글자 그대로, 가정)
  //   코드 LIBERO    V^ℓ = LN(V^{ℓ−1}) + γ·Attn
  //   코드 RoboTwin  V^ℓ = V^{ℓ−1} + γ·Attn
  import { copyFor, fmt } from '../../../content/i18n'
  import { VIRTUAL_SCALE } from '../../../engine/encoders'
  import { rowView, type Tensor } from '../../../engine/tensor'
  import { ui } from '../../../state/store.svelte'
  import BasisTag from '../../BasisTag.svelte'
  import CaveatMark from '../../CaveatMark.svelte'
  import Tex from '../../Tex.svelte'
  import { g } from '../../../content/glossary'
  import { robustLimit } from '../../viz/color'
  import SceneView from '../../viz/SceneView.svelte'
  import StripList, { type StripItem } from './StripList.svelte'
  import WordChips from './WordChips.svelte'

  const STRIP = 300
  /** 이미지 쪽은 왼쪽에 작은 patch 그림이 있어 띠를 조금 줄인다 */
  const V_STRIP = 220
  /** 공식 코드의 γ ⊙ (기호마다 풀이가 있다) */
  const GAMMA = String.raw`${g('gamma', String.raw`\gamma`)} ${g('hadamard', String.raw`\odot`)}`
  const ATTN = g('AttnVL', String.raw`\mathrm{Attn}_{v\leftarrow l}`)
  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  const cfg = $derived(t.config)
  const layer = $derived(t.layers[ui.interLayer - 1])
  const l = $derived(ui.interLayer)
  const code = $derived(cfg.basis === 'code')
  const normalized = $derived(code && cfg.profile === 'libero')
  const gamma = $derived(code ? VIRTUAL_SCALE : 1)
  const views = $derived(t.views)
  const grid = $derived(views[0].grid)
  const P = $derived(grid * grid)
  const patch = $derived(ui.selectedPatch)
  const word = $derived(ui.selectedWord)
  const patchTok = $derived(t.tokens.visual[patch])
  const view = $derived(views[patchTok.view ?? 0])

  function scaled(values: Float32Array, s: number): Float32Array {
    return s === 1 ? values : Float32Array.from(values, (v) => v * s)
  }

  /** 한 쪽(V 또는 L)의 띠 목록 */
  function chain(side: 'v' | 'l', index: number): StripItem[] {
    const sym = side === 'v' ? 'V' : 'L'
    const dir = side === 'v' ? g('AttnVL', String.raw`\mathrm{Attn}_{v\leftarrow l}`) : g('AttnLV', String.raw`\mathrm{Attn}_{l\leftarrow v}`)
    const prevKey = side === 'v' ? 'Vprev' : 'Lprev'
    const nextKey = side === 'v' ? 'Vnext' : code ? 'Lmid' : 'Lnext'
    const prev: Tensor = side === 'v' ? layer.V_in : layer.L_in
    const norm: Tensor = side === 'v' ? layer.V_norm : layer.L_norm
    const delta: Tensor = side === 'v' ? layer.dV : layer.dL
    const next: Tensor = side === 'v' ? layer.V_out : layer.L_mid
    const on = side === 'v' ? layer.active.vFromL : layer.active.lFromV
    const nextSym = g(nextKey, side === 'l' && code ? String.raw`L'^{${l}}` : `${sym}^{${l}}`)
    // 1층의 입력은 encoder 출력(Z^v, Z^l)이다
    const items: StripItem[] = [
      { tex: g(prevKey, `${sym}^{${l - 1}}`), text: l === 1 ? c.interaction.rowPrevEncoder : c.interaction.rowPrev, values: rowView(prev, index), hl: [side === 'v' ? 'Vprev' : 'Lprev'] },
    ]
    // LN 줄은 바로 위 줄에서 나온 값이다 (→). 아래의 + 와 = 는 이 줄부터 더한다
    if (normalized) items.push({ op: '→', tex: String.raw`${g('LNop', String.raw`\mathrm{LN}`)}(${g(prevKey, `${sym}^{${l - 1}}`)})`, text: c.interaction.rowNorm, values: rowView(norm, index) })
    items.push({
      op: '+',
      tex: code ? String.raw`${GAMMA} ${dir}` : dir,
      text: code ? c.interaction.rowAttnGamma : c.interaction.rowAttn,
      values: scaled(rowView(delta, index), gamma),
      off: !on,
      note: on ? undefined : c.interaction.resOff,
      hl: [side === 'v' ? 'AttnVL' : 'AttnLV'],
    })
    items.push({
      op: '=',
      tex: nextSym,
      text: side === 'l' && code ? c.interaction.rowMid : c.interaction.rowNext,
      values: rowView(next, index),
      strong: true,
      // 공식 코드 기준의 지시 쪽은 텍스트 블록 전 값 L′
      hl: [side === 'v' ? 'Vnext' : code ? 'Lmid' : 'Lnext'],
    })
    return items
  }

  const vItems = $derived(chain('v', patch))
  const lItems = $derived(chain('l', word))
  // 한 쪽의 띠들은 같은 색 범위를 써서 크기를 비교할 수 있게 한다
  const limitOf = (items: StripItem[]) => Math.max(...items.map((i) => robustLimit(i.values)))
  const vLimit = $derived(limitOf(vItems))
  const lLimit = $derived(limitOf(lItems))

  const patchText = $derived(fmt(c.encoders.patchAt, { view: view.name, gx: patchTok.gx ?? 0, gy: patchTok.gy ?? 0 }))
  const ruleText = $derived(
    code ? fmt(normalized ? c.interaction.resCodeLibero : c.interaction.resCodeRobotwin, { g: VIRTUAL_SCALE }) : c.interaction.resPaper,
  )
  const vFormula = $derived(
    !code
      ? String.raw`${g('Vnext', String.raw`V^{\ell}_t`)} = ${g('Vprev', String.raw`V^{\ell-1}_t`)} + ${ATTN}(${g('Vprev', String.raw`V^{\ell-1}_t`)}, ${g('Lprev', String.raw`L^{\ell-1}_t`)})`
      : normalized
        ? String.raw`${g('Vnext', String.raw`V^{\ell}`)} = ${g('LNop', String.raw`\mathrm{LN}`)}(${g('Vprev', String.raw`V^{\ell-1}`)}) + ${GAMMA} ${ATTN}`
        : String.raw`${g('Vnext', String.raw`V^{\ell}`)} = ${g('Vprev', String.raw`V^{\ell-1}`)} + ${GAMMA} ${ATTN}`,
  )
</script>

<div class="residual">
  <p class="lead">
    {c.interaction.resLead}
  </p>
  <p class="rule">
    <BasisTag kind={code ? 'code' : 'paper'} />
    {ruleText}
    <!-- 식이 연산자 뒤에서 두 줄로 갈라지지 않게 주의 표시와 한 덩어리로 묶는다 -->
    <span class="formula"><Tex display={false} tex={vFormula} />{#if code}<CaveatMark id="gamma-virtual" />{:else}<CaveatMark id="residual-placement" />{/if}</span>
  </p>

  <div class="cols">
    <section>
      <h4 class="vision">{c.interaction.resV}</h4>
      <div class="v-row">
        <div class="pick">
          <SceneView
            {view}
            size={96}
            grid
            selected={{ gx: patchTok.gx ?? 0, gy: patchTok.gy ?? 0 }}
            onPatch={(gx, gy) => (ui.patchPick = (patchTok.view ?? 0) * P + gy * grid + gx)}
            label={c.encoders.patchGrid}
            roleDescription={c.encoders.patchGrid}
            valueText={patchText}
          />
          <p class="picked">{patchText}</p>
        </div>
        <StripList items={vItems} width={V_STRIP} limit={vLimit} />
      </div>
    </section>

    <section>
      <h4 class="language">{c.interaction.resL}</h4>
      <WordChips tokens={t.tokens.text} selected={word} onPick={(i) => ui.pickWord(i)} label={c.interaction.wordsTitle} />
      <StripList items={lItems} width={STRIP} limit={lLimit} />
    </section>
  </div>
</div>

<style>
  .residual {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .lead,
  .rule {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  .rule {
    font-size: var(--fs-xs);
  }

  .formula {
    display: inline-block;
    white-space: nowrap;
  }

  .cols {
    display: flex;
    gap: 36px;
    align-items: flex-start;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 450px;
    flex: none;
  }

  h4 {
    margin: 0;
    font-size: var(--fs-sm);
  }

  h4.vision {
    color: var(--vision-ink);
  }

  h4.language {
    color: var(--language-ink);
  }

  .v-row {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .pick {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .picked {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }
</style>
