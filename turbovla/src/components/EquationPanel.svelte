<script lang="ts">
  // 수식 패널.
  // - 단계마다 그 단계의 식을 논문 번호와 출처 표시와 함께 보인다.
  // - 기호에 마우스를 올리면 같은 id의 그림이 강조되고(반대로 그림에 올리면 기호가 강조된다), 기호를 누르면 그림이 있는 곳으로 간다.
  // - 공식 코드 기준이면 계산이 다른 식 옆에 코드가 하는 식을 두고 다른 부분을 빨간 펜으로 표시한다.
  //   논문 기준에서도 그런 식에는 "논문" 표시를 단다(어느 기준에서든 두 기준이 다른 곳에 표시).
  import { tick, untrack } from 'svelte'
  import { codeEquation, INTERACTION_SYMBOLS, STAGE_EQUATIONS, SYMBOLS, symbolHome, type SymbolHome, type SymbolId } from '../content/equations'
  import { copyFor, fmt } from '../content/i18n'
  import { ui } from '../state/store.svelte'
  import { glossKeys, type GlossKey } from '../content/glossary'
  import BasisTag from './BasisTag.svelte'
  import InfoMark from './InfoMark.svelte'
  import SymbolTable from './SymbolTable.svelte'
  import Tex from './Tex.svelte'

  const c = $derived(copyFor(ui.lang))
  const code = $derived(ui.config.basis === 'code')
  const unique = (keys: GlossKey[]) => keys.filter((k, i, a) => a.indexOf(k) === i)
  const items = $derived(
    STAGE_EQUATIONS[ui.stage].map((eq) => {
      const codeEq = codeEquation(eq.id, ui.config.profile)
      return {
        eq,
        codeEq,
        // 카드의 기호 표: 식에 든 기호를 나온 순서대로, 그리고 식 전체에 붙는 첨자
        keys: unique([...glossKeys(eq.tex), ...(eq.extra ?? [])]),
        codeKeys: codeEq ? unique([...glossKeys(codeEq.tex), ...(eq.extra ?? [])]) : [],
      }
    }),
  )
  const anyDiff = $derived(code && items.some((i) => i.codeEq))
  let list: HTMLElement | undefined = $state()
  /** 마우스가 올라간 기호 (힌트 문구용) */
  let hovered: SymbolId | null = $state(null)
  /** 마우스가 올라간 기호 요소. 식이 다시 그려져 이 요소가 사라지면 하이라이트를 지운다 */
  let hoveredEl: HTMLElement | null = null
  /** "섞지 않음" 모드에서는 interaction 층의 기호에 그림이 없다 */
  const noPicture = (id: SymbolId) => ui.config.mode === 'none' && INTERACTION_SYMBOLS.includes(id)

  function symbolOf(target: EventTarget | null): { el: HTMLElement; id: SymbolId } | null {
    const el = (target as Element | null)?.closest?.('.hl') as HTMLElement | null
    if (!el || !list?.contains(el)) return null
    const cls = [...el.classList].find((k) => k.startsWith('hl-') && k !== 'hl-on')
    const id = cls?.slice(3) as SymbolId | undefined
    return id && id in SYMBOLS ? { el, id } : null
  }

  function onpointerover(event: PointerEvent) {
    const s = symbolOf(event.target)
    if (!s) return
    hovered = s.id
    hoveredEl = s.el
    ui.setHover('symbol', [s.id])
  }

  function onpointerout(event: PointerEvent) {
    const s = symbolOf(event.target)
    if (!s) return
    // 같은 기호 안에서 움직인 것은 무시한다
    if (event.relatedTarget instanceof Node && s.el.contains(event.relatedTarget)) return
    hovered = null
    hoveredEl = null
    ui.clearHover('symbol', [s.id])
  }

  /** 기호를 누르면 그 그림이 있는 단계(와 하위 탭)로 간다 (그림이 없으면 가지 않는다) */
  function onclick(event: MouseEvent) {
    const s = symbolOf(event.target)
    if (!s || noPicture(s.id)) return
    const home: SymbolHome = symbolHome(s.id, ui.config.basis)
    ui.goTo(home.stage)
    if (home.encoderTab) ui.encoderTab = home.encoderTab
    if (home.interTab) ui.interTab = home.interTab
  }

  /** 카드 이름 (기호 표 단추와 표 제목). 번호 없는 식은 식마다 이름이 있어서 같은 단계의 두 단추가 같은 이름이 되지 않는다 */
  const cardName = (eq: (typeof items)[number]['eq']) =>
    eq.source.kind === 'paperEq'
      ? `${c.equations.paperEq} (${eq.source.number})`
      : ((c.equations.cardNames as Record<string, string>)[eq.id] ?? eq.id)

  const placeOf = (id: SymbolId) => {
    const home: SymbolHome = symbolHome(id, ui.config.basis)
    const tab = home.encoderTab
      ? c.encoders[home.encoderTab]
      : home.interTab === 'attention'
        ? c.interaction.tabAttention
        : home.interTab === 'residual'
          ? c.interaction.tabResidual
          : home.interTab === 'text'
            ? c.interaction.tabText
            : null
    return tab ? `${c.stages[home.stage].title}, ${tab}` : c.stages[home.stage].title
  }

  $effect(() => {
    if (!list) return
    const el = list
    el.addEventListener('pointerover', onpointerover)
    el.addEventListener('pointerout', onpointerout)
    el.addEventListener('click', onclick)
    return () => {
      el.removeEventListener('pointerover', onpointerover)
      el.removeEventListener('pointerout', onpointerout)
      el.removeEventListener('click', onclick)
    }
  })

  /**
   * ←/→ 키나 기준 변경으로 식이 다시 그려지면, 마우스가 올라가 있던 기호가 사라져도 pointerout이 오지 않는다.
   * 그래서 다시 그린 뒤 그 기호가 문서에서 빠졌으면 하이라이트와 힌트를 지운다. (같은 식이 남아 있으면 그대로 둔다)
   */
  $effect(() => {
    void items
    void ui.lang
    untrack(() => {
      if (hovered && (!hoveredEl || !hoveredEl.isConnected)) {
        ui.clearHover('symbol', [hovered])
        hovered = null
        hoveredEl = null
      }
    })
  })

  /**
   * 지금 보는 하위 탭의 식. 단계나 하위 탭, 기준이 바뀌면 그 식(공식 코드 기준이면 바로 뒤의 코드 카드까지)이 보이게
   * 가로 스크롤을 옮긴다. 그러지 않으면 공식 코드 카드와 빨간 밑줄이 스크롤 밖에 숨는다.
   */
  const SUBTAB_EQ = { vision: 'eq4', text: 'eq3', state: 'eq5' } as const
  const focusEq = $derived(ui.stage === 'encoders' ? SUBTAB_EQ[ui.encoderTab] : ui.stage === 'interaction' ? 'eq7' : null)
  /**
   * 스크롤을 옮길 때를 정하는 key. 파라미터를 바꿀 때마다 config 객체가 새로 만들어지므로 items에 기대면
   * 발표자가 손으로 옮긴 스크롤이 매번 처음으로 돌아간다. 그래서 값이 실제로 바뀔 때만 바뀌는 문자열을 쓴다.
   */
  const scrollKey = $derived(`${ui.stage}|${focusEq ?? ''}|${code}|${ui.config.profile}|${ui.lang}`)
  $effect(() => {
    void scrollKey
    const target = focusEq
    if (!list) return
    const el = list
    untrack(async () => {
      await tick()
      const card = target ? el.querySelector<HTMLElement>(`[data-eq="${target}"]`) : null
      const left = card ? card.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - 2 : 0
      el.scrollTo({ left: Math.max(0, left) })
    })
  })

  // 그림 위에 마우스가 있으면(또는 기호 위) 같은 id의 기호를 강조한다. 식이 다시 그려진 뒤에도 맞도록 단계, 기준, 언어도 읽는다.
  $effect(() => {
    const h = ui.hoverTarget
    void ui.stage
    void ui.config.basis
    void ui.config.profile
    void ui.lang
    if (!list) return
    const lit: HTMLElement[] = []
    for (const el of list.querySelectorAll<HTMLElement>('.hl')) {
      const cls = [...el.classList].find((k) => k.startsWith('hl-') && k !== 'hl-on')
      const on = !!h && !!cls && h.ids.includes(cls.slice(3))
      el.classList.toggle('hl-on', on)
      if (on) lit.push(el)
    }
    // 그림에서 시작한 하이라이트인데 강조된 기호가 모두 가로 스크롤 밖에 있으면 첫 기호를 보이게 한다
    if (h?.kind === 'tensor' && lit.length) {
      const box = list.getBoundingClientRect()
      const visible = lit.some((el) => {
        const r = el.getBoundingClientRect()
        return r.right > box.left && r.left < box.right
      })
      if (!visible) lit[0].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
  })
</script>

{#snippet symbols(keys: GlossKey[], name: string)}
  <!-- 기호 표 단추: 마우스 없이도(화면 공유 중) 이 식의 모든 기호의 뜻, 종류, 모양을 본다 -->
  <InfoMark
    text={c.equations.symbols}
    label={fmt(c.equations.symbolsLabel, { name })}
    title={fmt(c.equations.symbolsTitle, { name })}
    width={620}
  >
    <SymbolTable {keys} />
  </InfoMark>
{/snippet}

<section class="equations" aria-labelledby="equations-title">
  <div class="head">
    <h2 id="equations-title" tabindex="-1">
      {c.equations.title}
      <span class="stage-name">{c.stages[ui.stage].title}</span>
    </h2>
    <!-- 마우스 사용자를 위한 안내라서 화면 낭독기에는 숨긴다 (마우스를 움직일 때마다 읽히지 않게) -->
    <span class="hint" aria-hidden="true">
      {hovered
        ? noPicture(hovered)
          ? c.equations.noPicture
          : fmt(c.equations.symbolHint, { place: placeOf(hovered) })
        : c.equations.hoverHint}
    </span>
    {#if anyDiff}<span class="diff-note">{c.equations.diffNote}</span>{/if}
  </div>
  <!-- 기호 하이라이트와 이동은 마우스 보조 기능이다(아래 $effect에서 이벤트를 붙인다). 같은 그림은 각 단계에서 키보드로도 고를 수 있다 -->
  <div class="list" bind:this={list}>
    {#each items as { eq, codeEq, keys, codeKeys } (eq.id)}
      <figure class="eq" data-eq={eq.id}>
        <figcaption>
          {#if eq.source.kind === 'paperEq'}
            <span class="pill">{c.equations.paperEq} ({eq.source.number}) · {eq.source.section}</span>
          {:else if eq.source.kind === 'paperText'}
            <span class="pill text">{eq.source.section}</span>
            <span class="note">{c.equations.paperText}</span>
          {:else if eq.source.kind === 'paperProse'}
            <span class="pill text">{eq.source.section}</span>
            <span class="note">{c.equations.paperProse}</span>
          {:else}
            <span class="pill plain">2017</span>
            <span class="note">{c.equations.external}</span>
          {/if}
          {#if codeEq}
            <!-- 두 기준이 다른 식: 논문 표시 (논문 기준에서는 코드가 다르다는 것도 밝힌다) -->
            <BasisTag kind="paper" />
            {#if !code}<span class="note">{c.equations.paperDiffers}</span>{/if}
          {/if}
          {@render symbols(keys, cardName(eq))}
        </figcaption>
        <div class="math"><Tex display={false} tex={eq.tex} /></div>
      </figure>
      {#if code && codeEq}
        <figure class="eq code">
          <figcaption>
            <BasisTag kind="code" />
            <span class="note">{c.equations[codeEq.note]}</span>
            {@render symbols(codeKeys, fmt(c.equations.codeCardName, { name: cardName(eq) }))}
          </figcaption>
          <div class="math"><Tex display={false} tex={codeEq.tex} /></div>
        </figure>
      {/if}
    {/each}
  </div>
</section>

<style>
  .equations {
    grid-area: eq;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 6px 24px 6px;
    border-top: 1px solid var(--line);
    background: var(--card);
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
    white-space: nowrap;
  }

  h2 {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0;
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .stage-name {
    color: var(--muted);
    font-weight: 500;
  }

  .hint {
    overflow: hidden;
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 400;
    text-overflow: ellipsis;
  }

  .diff-note {
    color: var(--red-pen-ink);
    font-size: var(--fs-xs);
  }

  /*
   * 높이를 고정해서 가로 스크롤 막대가 생겨도 단계 패널 높이가 바뀌지 않게 한다.
   * (카드 한 줄 + 스크롤 막대 자리)
   */
  .list {
    display: flex;
    gap: 14px;
    height: 82px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }

  .eq {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: none;
    height: 72px;
    margin: 0;
    padding: 4px 14px 4px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg);
  }

  .eq.code {
    border-color: var(--red-pen);
    border-style: dashed;
  }

  .pill {
    display: inline-block;
    padding: 2px 12px;
    border-radius: var(--radius-pill);
    background: var(--ink);
    color: var(--bg);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  figcaption {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .pill.text {
    background: var(--card);
    color: var(--ink);
    box-shadow: inset 0 0 0 1.5px var(--ink);
  }

  .pill.plain {
    background: var(--sunken);
    color: var(--muted);
  }

  .note {
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  /* 한 줄(인라인) 수식: 패널 높이를 줄이고 고정한다. 분수는 작게 그려진다 */
  .math {
    font-size: 16px;
    line-height: 1.6;
    white-space: nowrap;
  }

  /* 하이라이트할 수 있는 기호 */
  .math :global(.hl) {
    border-radius: 3px;
    cursor: pointer;
  }

  /* 테두리는 base.css의 .hl-on 덮개 상자가 그린다. 여기서는 바탕만 칠한다 */
  .math :global(.hl.hl-on) {
    background: var(--accent-fill);
  }

  /* 공식 코드가 논문과 다르게 하는 부분 (빨간 펜): 색만으로 알리지 않도록 밑줄도 긋는다 */
  .math :global(.diff) {
    color: var(--red-pen-ink);
    box-shadow: inset 0 -2px 0 var(--red-pen);
  }
</style>
