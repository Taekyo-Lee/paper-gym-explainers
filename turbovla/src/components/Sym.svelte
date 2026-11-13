<script lang="ts">
  // 단계 패널의 기호. 기호를 풀이 key로 감싸 그리므로 마우스를 올리면 뜻이 뜬다(GlossaryTip).
  // kind/name을 켜면 종류 이름표와 이름을 화면에 그대로 보인다 (마우스 없이도, 화면 공유 중에도 읽히게).
  import { GLOSSARY, g, type GlossEntry, type GlossKey } from '../content/glossary'
  import { ui } from '../state/store.svelte'
  import KindTag from './KindTag.svelte'
  import Tex from './Tex.svelte'

  let {
    k,
    tex,
    kind = false,
    name = false,
  }: {
    k: GlossKey
    /** 화면에 그릴 TeX. 없으면 풀이의 기호 (예: 층 번호를 넣은 V^{2}처럼 바꿔 그릴 때 쓴다) */
    tex?: string
    /** 종류 이름표를 보인다 */
    kind?: boolean
    /** 이름을 보인다 */
    name?: boolean
  } = $props()

  const entry: GlossEntry = $derived(GLOSSARY[k])
</script>

<span class="sym"
  ><Tex display={false} tex={g(k, tex ?? entry.tex)} />{#if kind}<KindTag kind={entry.kind} />{/if}{#if name}<span class="name"
      >{entry[ui.lang].name}</span
    >{/if}</span
>

<style>
  .sym {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }

  .name {
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 600;
  }
</style>
