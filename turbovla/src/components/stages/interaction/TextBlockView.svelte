<script lang="ts">
  // 공식 코드의 텍스트 블록: cross-attention 뒤에 지시 토큰끼리 self-attention + FFN (post-norm).
  //   L1 = LN(L′ + SA(L′)),  L^ℓ = LN(L1 + FFN(L1)),  SA는 문장 단위 mask
  // 논문 기준에서는 계산하지 않고 "공식 코드에만 있는 블록"으로 흐리게 표시만 한다.
  import { tick } from 'svelte'
  import { copyFor, fmt } from '../../../content/i18n'
  import { rowView, shapeOf, tensor } from '../../../engine/tensor'
  import { ui } from '../../../state/store.svelte'
  import BasisTag from '../../BasisTag.svelte'
  import CaveatMark from '../../CaveatMark.svelte'
  import InfoMark from '../../InfoMark.svelte'
  import Tex from '../../Tex.svelte'
  import { g } from '../../../content/glossary'
  import AttnGrid from '../../viz/AttnGrid.svelte'
  import { robustLimit } from '../../viz/color'
  import StripList, { type StripItem } from './StripList.svelte'
  import WordChips from './WordChips.svelte'

  const STRIP = 240
  const c = $derived(copyFor(ui.lang))
  const t = $derived(ui.trace)
  const layer = $derived(t.layers[ui.interLayer - 1])
  const l = $derived(ui.interLayer)
  const text = $derived(layer.textLayer)
  const h = $derived(ui.interHead - 1)
  const word = $derived(ui.selectedWord)
  /**
   * 그리드에는 [PAD]가 아닌 토큰만 보인다. [PAD]는 문장 mask에서 자기 자신만 보고, 다른 토큰도 [PAD]를 보지 않으므로
   * 접어도 단어들의 attention은 그대로다(접힌 칸은 대각선 1과 가려진 칸뿐). 21칸을 다 그리면 글자가 겹친다.
   */
  const shown = $derived(t.tokens.text.filter((x) => x.kind !== 'pad').map((x) => x.index))
  const folded = $derived(t.tokens.text.length - shown.length)
  const labels = $derived(shown.map((i) => t.tokens.text[i].name))
  const sub = $derived.by(() => {
    if (!text) return null
    const A = text.A[h]
    const n = A.rows
    const k = shown.length
    const values = new Float32Array(k * k)
    const allowed = new Uint8Array(k * k)
    shown.forEach((r, a) =>
      shown.forEach((col, b) => {
        values[a * k + b] = A.data[r * n + col]
        allowed[a * k + b] = t.textSubSentence[r * n + col]
      }),
    )
    return { values: tensor(k, k, 'text self-attention (shown)', values), allowed }
  })
  const subRow = $derived(shown.indexOf(word))
  /** 블록 그림의 단계 (그림 라벨). 처음과 끝은 기호로 */
  const steps = $derived<{ tex?: string; text?: string }[]>([
    { tex: g('Lmid', String.raw`L'^{${l}}`) },
    { text: 'self-attention' },
    { text: 'Add & LayerNorm' },
    { text: `FFN 256 → ${t.config.textFFNDim.toLocaleString('en-US')} → 256` },
    { text: 'Add & LayerNorm' },
    { tex: g('Lnext', `L^{${l}}`) },
  ])

  const items = $derived.by((): StripItem[] => {
    if (!text) return []
    return [
      { tex: g('Lmid', String.raw`L'^{${l}}`), text: c.interaction.rowMid, values: rowView(layer.L_mid, word), hl: ['Lmid'] },
      // 차례로 지나가는 단계라 + / = 가 아니라 → 로 잇는다 (더하는 것은 각 단계 안의 residual)
      { op: '→', tex: String.raw`${g('LNop', String.raw`\mathrm{LN}`)}(${g('Lmid', "L'")} + ${g('SA', String.raw`\mathrm{SA}`)}(${g('Lmid', "L'")}))`, text: c.interaction.rowAfterAttn, values: rowView(text.afterAttn, word) },
      { op: '→', tex: g('Lnext', `L^{${l}}`), text: c.interaction.rowOut, values: rowView(layer.L_out, word), strong: true, hl: ['Lnext'] },
    ]
  })
  const limit = $derived(items.length ? Math.max(...items.map((i) => robustLimit(i.values))) : 1)
</script>

<div class="text-block">
  <p class="lead">
    <BasisTag kind="code" />
    {c.interaction.textLead}
  </p>

  <ol class="flow" class:dim={!text} aria-label={c.interaction.tabText}>
    {#each steps as s, i (i)}
      <li>
        {#if i > 0}<span class="arrow" aria-hidden="true"></span>{/if}
        <span class="box" lang="en">{#if s.tex}<Tex display={false} tex={s.tex} />{:else}{s.text}{/if}</span>
      </li>
    {/each}
  </ol>

  {#if !text}
    <div class="paper">
      <p>{c.interaction.textPaper} <CaveatMark id="text-block-omitted" /></p>
      <!-- 이 버튼은 기준이 바뀌면 사라지므로 focus를 이 탭으로 옮긴다 (focus가 body로 떨어지지 않게) -->
      <button
        type="button"
        onclick={async () => {
          ui.setBasis('code')
          await tick()
          document.getElementById('inter-tab-text')?.focus()
        }}>{c.interaction.textShowCode}</button
      >
    </div>
  {:else}
    <div class="cols">
      <section>
        <div class="head">
          <h4>{c.interaction.textMatrix}</h4>
          <span class="shape nowrap">{shapeOf(text.A[h])}</span> <span class="row-sum">{c.interaction.rowSum}</span>
          <CaveatMark id="subsentence-mask" />
        </div>
        {#if sub}
          <AttnGrid
            values={sub.values}
            {labels}
            allowed={sub.allowed}
            selectedRow={subRow >= 0 ? subRow : null}
            size={144}
            label={fmt(c.interaction.textGridLabel, { shape: shapeOf(text.A[h]) })}
          />
        {/if}
        <p class="note">
          {c.interaction.textMask}
          {#if folded > 0}
            {fmt(c.interaction.textPadFolded, { n: folded })}
            <InfoMark label={c.interaction.textPadInfoLabel} title={c.interaction.textPadInfoLabel} body={c.interaction.textPadInfoBody} />
          {/if}
        </p>
      </section>

      <section>
        <!-- 세로 공간을 아끼려고 이 칸의 제목은 화면 낭독기에만 둔다 -->
        <h4 class="visually-hidden">{c.interaction.textRows}</h4>
        <WordChips tokens={t.tokens.text} selected={word} onPick={(i) => ui.pickWord(i)} label={c.interaction.wordsTitle} />
        <StripList {items} width={STRIP} {limit} />
      </section>
    </div>
  {/if}
</div>

<style>
  .text-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

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
    align-items: center;
  }

  .flow.dim .box {
    border-style: dashed;
    color: var(--muted);
  }

  .arrow {
    position: relative;
    width: 20px;
    height: 20px;
  }

  .arrow::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 5px;
    width: 7px;
    height: 7px;
    border-top: 1.5px solid var(--muted);
    border-right: 1.5px solid var(--muted);
    transform: translateY(-50%) rotate(45deg);
  }

  .box {
    padding: 3px 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    font-size: var(--fs-xs);
    white-space: nowrap;
  }

  .paper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius);
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .paper p {
    margin: 0;
  }

  .paper button {
    padding: 3px 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .cols {
    display: flex;
    gap: 36px;
    align-items: flex-start;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: none;
    width: 460px;
  }

  section + section {
    width: 430px;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
  }

  /* 모양 이름표는 대괄호 안에서 줄이 갈라지지 않게 */
  .nowrap {
    flex: none;
    white-space: nowrap;
  }

  .row-sum {
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  h4 {
    margin: 0;
    font-size: var(--fs-sm);
  }

  .note {
    max-width: 460px;
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }
</style>
