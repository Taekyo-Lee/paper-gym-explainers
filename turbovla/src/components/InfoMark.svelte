<script lang="ts">
  // 작은 아이콘 버튼 + 설명 popover. 일반 설명(예: patch 수 P를 구하는 법)에 쓴다. 기술적 주의는 CaveatMark가 기술적 주의 창으로 연다.
  // popover는 Popover API의 top layer에 띄워서 단계 패널의 스크롤 영역(overflow: auto)에 잘리지 않게 한다.
  // 위치는 버튼 기준으로 계산하고 화면 안으로 맞춘다. 아래 공간이 모자라면 위로 연다.
  import type { Snippet } from 'svelte'

  let {
    label,
    title,
    body = '',
    width = 300,
    text = '',
    children,
  }: {
    /** 화면 낭독기용 버튼 이름 */
    label: string
    title: string
    /** 한 문단 설명. children이 있으면 그것을 대신 보인다 (표처럼 짜인 설명) */
    body?: string
    /** popover 폭 (px) */
    width?: number
    /** 아이콘 옆에 보이는 짧은 글자 (예: 기호). 없으면 아이콘만 */
    text?: string
    children?: Snippet
  } = $props()

  const WIDTH = $derived(width)
  const GAP = 6
  const MARGIN = 8

  let open = $state(false)
  let root: HTMLElement | undefined = $state()
  let button: HTMLButtonElement | undefined = $state()
  let pop: HTMLElement | undefined = $state()
  const uid = $props.id()
  const popId = `mark-${uid}`

  function place() {
    if (!button || !pop) return
    const r = button.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const width = Math.min(WIDTH, vw - 2 * MARGIN)
    pop.style.width = `${width}px`
    const left = Math.max(MARGIN, Math.min(r.left - 8, vw - width - MARGIN))
    // 아래나 위 어느 쪽에도 다 들어가지 않으면(기호 표처럼 긴 설명) 넓은 쪽 높이에 맞추고 안에서 스크롤한다.
    // 그래야 설명이 그것을 연 단추와 그 단추가 설명하는 식을 덮지 않는다
    // 자연 높이는 scrollHeight로 잰다(max-height를 풀었다 다시 걸면 안의 스크롤 위치가 처음으로 돌아간다)
    const spaceBelow = vh - r.bottom - GAP - MARGIN
    const spaceAbove = r.top - GAP - MARGIN
    const natural = pop.scrollHeight + (pop.offsetHeight - pop.clientHeight)
    let top: number
    if (natural <= spaceBelow) {
      pop.style.maxHeight = ''
      top = r.bottom + GAP
    } else if (natural <= spaceAbove) {
      pop.style.maxHeight = ''
      top = r.top - GAP - natural
    } else if (spaceBelow >= spaceAbove) {
      pop.style.maxHeight = `${spaceBelow}px`
      top = r.bottom + GAP
    } else {
      pop.style.maxHeight = `${spaceAbove}px`
      top = r.top - GAP - spaceAbove
    }
    pop.style.left = `${left}px`
    pop.style.top = `${top}px`
  }

  $effect(() => {
    if (!open || !pop) return
    try {
      pop.showPopover()
    } catch {
      // Popover API가 없는 브라우저: position: fixed로만 띄운다.
    }
    place()
    const close = () => (open = false)
    const outside = (target: EventTarget | null) => !(target instanceof Node && root?.contains(target))
    const onPointer = (event: PointerEvent) => {
      if (outside(event.target)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      button?.focus()
    }
    // focus가 다른 곳으로 가면 닫는다(열린 설명이 다음 조작 대상을 가리지 않게).
    const onFocus = (event: FocusEvent) => {
      if (outside(event.target)) close()
    }
    // 패널이나 단계 흐름이 스크롤되면 버튼을 따라간다.
    let frame = 0
    const onMove = (event: Event) => {
      // 설명 안을 스크롤한 것은 위치와 상관없다
      if (event.target instanceof Node && pop?.contains(event.target)) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('focusin', onFocus)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('focusin', onFocus)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  })
</script>

<span class="mark-root" bind:this={root}>
  <button
    bind:this={button}
    type="button"
    class="mark"
    class:texted={!!text}
    aria-expanded={open}
    aria-controls={popId}
    aria-label={label}
    title={title}
    onclick={() => (open = !open)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4.4M8 4.8v.2" /></svg>
    {#if text}<span class="text" aria-hidden="true">{text}</span>{/if}
  </button>
  {#if open}
    <span class="pop" id={popId} role="note" popover="manual" bind:this={pop}>
      <strong>{title}</strong>
      {#if children}{@render children()}{:else}<span>{body}</span>{/if}
    </span>
  {/if}
</span>

<style>
  .mark-root {
    display: inline-flex;
    vertical-align: middle;
  }

  .mark {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
  }

  .mark.texted {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    width: auto;
    height: 20px;
    padding: 0 7px 0 4px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: 600;
  }

  .mark:hover,
  .mark[aria-expanded='true'] {
    color: var(--accent-ink);
    background: var(--sunken);
  }

  svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  /* [popover]의 기본 스타일(inset: 0, margin: auto 등)을 덮는다. left/top은 place()가 정한다. */
  .pop {
    position: fixed;
    inset: auto;
    margin: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 300px;
    max-height: calc(100vh - 16px);
    max-height: calc(100dvh - 16px);
    padding: 10px 12px;
    overflow: auto;
    overscroll-behavior: contain;
    border: 1px solid var(--line-strong);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm);
    background: var(--card);
    box-shadow: var(--shadow-card);
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 400;
    line-height: 1.5;
    text-align: left;
    white-space: normal;
  }

  .pop strong {
    font-size: var(--fs-sm);
  }
</style>
