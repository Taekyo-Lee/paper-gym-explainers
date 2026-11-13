<script lang="ts">
  // 하단 바에서 여는 창 (2017 비교, Loss 장난감, 기술적 주의).
  // 브라우저의 <dialog>를 showModal()로 띄운다: 뒤 화면은 inert가 되고, focus는 창 안에 머물고, Esc로 닫힌다.
  // 내용은 열려 있을 때만 그린다(애니메이션 타이머 등이 닫힌 창에서 돌지 않게).
  // 닫히면 창을 열었던 요소로 focus를 돌려준다.
  import type { Snippet } from 'svelte'
  import { copyFor } from '../content/i18n'
  import { ui } from '../state/store.svelte'

  let {
    open,
    title,
    onclose,
    onopen,
    variant = 'center',
    width = 960,
    children,
  }: {
    open: boolean
    title: string
    onclose: () => void
    /** showModal() 직후에 부른다 (처음 focus를 옮길 곳이 따로 있을 때) */
    onopen?: () => void
    /** center: 화면 가운데, side: 오른쪽에 붙은 세로 창 */
    variant?: 'center' | 'side'
    width?: number
    children: Snippet
  } = $props()

  const c = $derived(copyFor(ui.lang))
  const uid = $props.id()
  let el: HTMLDialogElement | undefined = $state()
  let opener: Element | null = null

  $effect(() => {
    if (!el) return
    if (open && !el.open) {
      opener = document.activeElement
      el.showModal()
      onopen?.()
    } else if (!open && el.open) {
      el.close()
    }
  })

  function handleClose() {
    // Esc(cancel → close)나 닫기 단추로 닫혔다. 상태를 맞추고 focus를 돌려준다.
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    opener = null
    if (open) onclose()
  }

  /**
   * 창 바깥(backdrop)을 눌렀다 떼면 닫는다. 누른 곳과 뗀 곳이 모두 창의 상자 밖이어야 한다:
   * 창 안에서 끌기 시작해(글자 고르기, 그래프 훑기) 바깥에서 떼면 click이 dialog에 오지만 닫지 않는다.
   * 상자로 판단하므로 1px 테두리를 누른 것도 바깥이 아니다.
   */
  let pressedOutside = false
  function outside(event: MouseEvent): boolean {
    if (!el || event.target !== el) return false
    const r = el.getBoundingClientRect()
    return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom
  }
  function onpointerdown(event: PointerEvent) {
    pressedOutside = outside(event)
  }
  function onclick(event: MouseEvent) {
    const close = pressedOutside && outside(event)
    pressedOutside = false
    if (close) onclose()
  }
</script>

<dialog bind:this={el} class={variant} style:--dialog-w="{width}px" aria-labelledby="dialog-title-{uid}" onclose={handleClose} {onpointerdown} {onclick}>
  {#if open}
    <div class="frame">
      <!-- header 요소는 banner landmark가 되므로 div로 둔다 -->
      <div class="head">
        <h2 id="dialog-title-{uid}">{title}</h2>
        <button type="button" class="close" aria-label={c.dialog.close} title={c.dialog.close} onclick={onclose}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
      <div class="body">
        {@render children()}
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background: var(--card);
    box-shadow: var(--shadow-card);
    color: var(--ink);
  }

  dialog.center {
    width: min(var(--dialog-w), calc(100vw - 32px));
    max-width: none;
    max-height: calc(100dvh - 48px);
  }

  /* 오른쪽에 붙은 세로 창 (기술적 주의 목록) */
  dialog.side {
    width: min(var(--dialog-w), 100vw);
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0 0 0 auto;
    border-width: 0 0 0 1px;
    border-radius: 0;
  }

  dialog::backdrop {
    background: var(--scrim, rgb(9 9 11 / 0.42));
  }

  .frame {
    display: flex;
    flex-direction: column;
    max-height: inherit;
    height: 100%;
  }

  /* 테두리 2px만큼 덜어서 창 자신에 스크롤 막대가 생기지 않게 한다 */
  dialog.center .frame {
    max-height: calc(100dvh - 50px);
  }

  dialog.side .frame {
    height: 100dvh;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px 10px;
    border-bottom: 1px solid var(--line);
  }

  h2 {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 700;
  }

  .close {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: var(--card);
    color: var(--muted);
  }

  .close:hover {
    color: var(--ink);
  }

  .close svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .body {
    min-height: 0;
    padding: 14px 20px 18px;
    overflow-y: auto;
  }
</style>
