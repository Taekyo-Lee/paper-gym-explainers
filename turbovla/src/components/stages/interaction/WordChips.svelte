<script lang="ts">
  // 지시문 토큰 칩. 누르면 그 단어를 고른다. bars가 있으면 칩 아래에 막대를 그린다 (고른 patch가 단어들에 받은 L←V attention).
  // 이어진 [PAD]는 칩 하나로 묶는다(모든 [PAD]는 같은 값이라 묶어도 값이 같다, state/attention.test.ts).
  import type { Snippet } from 'svelte'
  import type { TokenMeta } from '../../../engine/types'
  import { groupHas, groupTokens } from '../../../state/attention'
  import { ui } from '../../../state/store.svelte'

  let {
    tokens,
    selected,
    onPick,
    label,
    bars = null,
    barMax = 1,
    barText,
    after,
  }: {
    tokens: TokenMeta[]
    selected: number
    onPick: (index: number) => void
    label: string
    /** 토큰마다 값 (토큰 번호 순서) */
    bars?: Float32Array | null
    barMax?: number
    /** 막대 값을 말로 (화면 낭독기용 설명). 마우스 없이도 값을 알 수 있게 한다 */
    barText?: (value: number) => string
    /** 칩 줄 끝에 붙일 것 (예: [PAD] 설명 아이콘) */
    after?: Snippet
  } = $props()

  const groups = $derived(groupTokens(tokens))
  const uid = $props.id()
</script>

<div class="chips" role="group" aria-label={label}>
  {#each groups as g (g.index)}
    {@const value = bars ? bars[g.index] : null}
    <button
      type="button"
      class:special={g.kind !== 'word'}
      class:pad={g.kind === 'pad'}
      aria-pressed={groupHas(g, selected)}
      aria-describedby={value !== null && barText ? `${uid}-bar-${g.index}` : undefined}
      lang="en"
      onclick={() => onPick(g.index)}
    >
      <span class="name">{g.name}{#if g.count > 1}<span class="count">× {g.count}</span>{/if}</span>
      {#if value !== null}
        <!-- 값은 마우스를 올리면 보인다 (칩 줄의 높이를 아끼려고) -->
        <span class="bar" title={value.toFixed(3)}><span class="fill" style:width="{Math.min(100, (value / (barMax || 1)) * 100)}%"></span></span>
        {#if barText}<span class="visually-hidden" id="{uid}-bar-{g.index}" lang={ui.lang}>{barText(value)}</span>{/if}
      {/if}
    </button>
  {/each}
  {@render after?.()}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  button {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    min-width: 44px;
    padding: 2px 8px 3px;
    border: 1.5px solid var(--language);
    border-radius: var(--radius-sm);
    background: var(--language-fill);
    color: var(--ink);
    font-size: var(--fs-sm);
    text-align: center;
  }

  button.special {
    border-style: dashed;
    color: var(--language-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }

  button.pad {
    border-color: var(--line-strong);
    background: transparent;
    color: var(--muted);
  }

  /* 고른 단어는 테두리와 굵기로 표시한다. outline은 키보드 focus 표시(base.css)에 남겨 둔다 */
  button[aria-pressed='true'] {
    border-style: solid;
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1.5px var(--accent);
    color: var(--ink);
    font-weight: 700;
  }

  .count {
    margin-left: 0.35em;
    font-weight: 400;
  }

  .bar {
    display: block;
    height: 5px;
    border-radius: 2px;
    background: var(--sunken);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--language);
  }

</style>
