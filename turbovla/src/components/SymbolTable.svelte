<script lang="ts">
  // 기호 풀이 표. 기호, 종류, 이름과 뜻, 지금 설정의 모양을 한 줄씩 보인다.
  // 수식 카드의 "기호" 단추(popover 안)와 단계 패널의 기호 풀이에 쓴다. popover 안에서도 쓰므로 span으로만 짠다.
  import { GLOSSARY, glossNote, glossShape, type GlossKey } from '../content/glossary'
  import { ui } from '../state/store.svelte'
  import KindTag from './KindTag.svelte'
  import Tex from './Tex.svelte'

  let { keys, compact = false }: { keys: readonly GlossKey[]; compact?: boolean } = $props()

</script>

<span class="table" class:compact role="list">
  {#each keys as key (key)}
    {@const e = GLOSSARY[key]}
    {@const shape = glossShape(e, ui.trace)}
    {@const note = compact ? null : glossNote(e, ui.trace, ui.lang)}
    <span class="row" role="listitem">
      <span class="sym"><Tex display={false} tex={e.tex} /></span>
      <span class="k"><KindTag kind={e.kind} /></span>
      <span class="text">
        <strong>{e[ui.lang].name}</strong>{#if shape}<span class="shape">{shape}</span>{/if}
        {#if !compact}<span class="meaning">{e[ui.lang].meaning}</span>{/if}
        <!-- 논문과 공식 코드의 차이, 화면 값에 대한 주의 (마우스 없이도 보이게) -->
        {#if note}<span class="note">{note}</span>{/if}
      </span>
    </span>
  {/each}
</span>

<style>
  .table {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    gap: 6px 10px;
    align-items: baseline;
  }

  .row {
    display: contents;
  }

  .sym {
    font-size: 15px;
    white-space: nowrap;
  }

  .k {
    justify-self: start;
  }

  .text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    min-width: 0;
    line-height: 1.45;
  }

  strong {
    font-weight: 700;
  }

  .meaning,
  .note {
    flex-basis: 100%;
    color: var(--muted);
  }

  .note {
    padding-left: 8px;
    border-left: 2px solid var(--line-strong);
  }

  .compact .text {
    flex-wrap: nowrap;
  }
</style>
