<script lang="ts">
  // 기호 풀이 tooltip. 화면 어디서든 g(key, tex)로 감싼 기호(.gl.gl-<key>)에 마우스를 올리면 뜬다:
  // 종류, 이름, 뜻, 지금 설정의 모양, 논문과 공식 코드의 차이. 수식 패널, 단계 패널, 창 안의 식에 모두 쓴다.
  // 기호가 겹쳐 있으면(예: P_v(f_img(I)) 안의 f_img) 가장 안쪽 기호의 풀이를 보인다.
  // popover(top layer)로 띄워서 단계 패널의 스크롤 영역이나 열린 창에 가리지 않게 한다.
  import { GLOSSARY, glossNote, glossShape, isGlossKey, type GlossEntry, type GlossKey } from '../content/glossary'
  import { ui } from '../state/store.svelte'
  import KindTag from './KindTag.svelte'
  import Tex from './Tex.svelte'

  const WIDTH = 340
  const GAP = 8
  const MARGIN = 8

  let key = $state<GlossKey | null>(null)
  let anchor: Element | null = null
  let tip: HTMLElement | undefined = $state()

  const entry: GlossEntry | null = $derived(key ? GLOSSARY[key] : null)
  const text = $derived(entry ? entry[ui.lang] : null)
  const shape = $derived(entry ? glossShape(entry, ui.trace) : null)
  const note = $derived(entry ? glossNote(entry, ui.trace, ui.lang) : null)

  function keyOf(el: Element): GlossKey | null {
    for (const cls of el.classList) {
      if (cls.startsWith('gl-')) {
        const k = cls.slice(3)
        if (isGlossKey(k)) return k
      }
    }
    return null
  }

  function place() {
    if (!tip || !anchor) return
    const r = anchor.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const width = Math.min(WIDTH, vw - 2 * MARGIN)
    tip.style.width = `${width}px`
    const left = Math.max(MARGIN, Math.min(r.left, vw - width - MARGIN))
    const height = tip.offsetHeight
    // 위쪽이 먼저: 수식 패널은 화면 아래에 있다
    const above = r.top - GAP - height
    const top = above >= MARGIN ? above : Math.min(vh - height - MARGIN, r.bottom + GAP)
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
  }

  function hide() {
    anchor = null
    key = null
  }

  $effect(() => {
    const over = (event: PointerEvent) => {
      const el = (event.target as Element | null)?.closest?.('.gl')
      // 기호가 아닌 곳에 들어왔다: 앞의 기호가 화면에서 지워져 pointerout이 오지 않았어도 풀이를 닫는다
      if (!el) {
        if (anchor) hide()
        return
      }
      const k = keyOf(el)
      if (!k) return
      anchor = el
      key = k
    }
    const out = (event: PointerEvent) => {
      if (anchor && !anchor.isConnected) return hide()
      const el = (event.target as Element | null)?.closest?.('.gl')
      if (!el || el !== anchor) return
      const to = event.relatedTarget as Node | null
      if (to && el.contains(to)) return
      // 안쪽 기호에서 바깥 기호로 나가면 바깥 기호의 풀이로 바꾼다
      const parent = (to as Element | null)?.closest?.('.gl')
      if (parent && parent.contains(el)) {
        anchor = parent
        key = keyOf(parent)
        return
      }
      anchor = null
      key = null
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', hide)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', hide)
    }
  })

  $effect(() => {
    if (!tip || !key) return
    try {
      tip.showPopover()
    } catch {
      // Popover API가 없는 브라우저: position: fixed로만 띄운다
    }
    place()
  })
</script>

{#if entry && text}
  <!-- 마우스 사용자를 위한 보조 풀이다. 같은 내용은 수식 카드의 기호 표와 단계 패널의 설명에도 있다 -->
  <div class="tip" popover="manual" bind:this={tip} aria-hidden="true">
    <div class="head">
      <span class="sym"><Tex display={false} tex={entry.tex} /></span>
      <KindTag kind={entry.kind} />
      {#if shape}<span class="shape">{shape}</span>{/if}
    </div>
    <strong>{text.name}</strong>
    <span>{text.meaning}</span>
    {#if note}<span class="note">{note}</span>{/if}
  </div>
{/if}

<style>
  .tip {
    position: fixed;
    inset: auto;
    margin: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 340px;
    padding: 10px 12px;
    overflow: visible;
    border: 1px solid var(--line-strong);
    border-left: 3px solid var(--ink);
    border-radius: var(--radius-sm);
    background: var(--card);
    box-shadow: var(--shadow-card);
    color: var(--ink);
    font-size: var(--fs-xs);
    line-height: 1.5;
    pointer-events: none;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
  }

  .sym {
    font-size: 16px;
  }

  strong {
    font-size: var(--fs-sm);
  }

  .note {
    color: var(--muted);
  }
</style>
