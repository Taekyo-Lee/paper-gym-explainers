<script module lang="ts">
  export interface StripItem {
    /** 왼쪽 기호 (KaTeX). 없으면 글자만 */
    tex?: string
    /** + 또는 = 같은 연산 표시 */
    op?: string
    text: string
    values: Float32Array
    /** 이 모드에서 쓰지 않는 줄 (흐리게) */
    off?: boolean
    note?: string
    strong?: boolean
    /** 수식 기호 하이라이트 id */
    hl?: string[]
  }
</script>

<script lang="ts">
  // 벡터 여러 줄을 같은 색 범위로 위아래에 놓는다 (residual의 V^{ℓ-1}, Attn 출력, V^ℓ 세 줄 등).
  import { hl } from '../../../state/highlight.svelte'
  import Tex from '../../Tex.svelte'
  import VectorStrip from '../../viz/VectorStrip.svelte'

  let { items, width, limit }: { items: StripItem[]; width: number; limit: number } = $props()
</script>

<div class="list" style:--strip="{width}px">
  {#each items as item, i (i)}
    <span class="term" class:strong={item.strong}>
      <span class="sym">
        {#if item.op}<span class="op">{item.op}</span>{/if}
        {#if item.tex}<Tex display={false} tex={item.tex} />{/if}
      </span>
      <small>{item.text}</small>
    </span>
    <div class="cell" {@attach hl(...(item.hl ?? []))}>
      <!-- 쓰지 않는 줄은 띠만 흐리게 한다 (설명 글자는 대비를 지킨다) -->
      <div class:off={item.off}>
        <VectorStrip values={item.values} {width} height={item.strong ? 18 : 14} {limit} label={item.text} />
      </div>
      {#if item.note}<span class="note">{item.note}</span>{/if}
    </div>
  {/each}
</div>

<style>
  .list {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--strip);
    align-items: center;
    gap: 6px 10px;
  }

  .term {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: var(--fs-sm);
  }

  .sym {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .op {
    min-width: 14px;
    color: var(--muted);
    font-weight: 700;
  }

  .term small {
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.3;
  }

  .strong {
    font-weight: 700;
  }

  .cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .off {
    opacity: 0.3;
  }

  .note {
    color: var(--muted);
    font-size: var(--fs-xs);
  }
</style>
