<script lang="ts">
  // 기술적 주의 표시. 지금 설정에 해당하는 caveat일 때만 보인다.
  // 누르면 기술적 주의 창이 그 항목에서 열린다(해당 항목으로 간다). 마우스를 올리면 종류와 제목이 보인다.
  // 종류: 가정(논문이 말하지 않아 정한 것) 또는 단순화(설명하려고 실제와 다르게 만든 것).
  import { CAVEAT_KIND, CAVEATS } from '../content/caveats'
  import { copyFor } from '../content/i18n'
  import type { CaveatId } from '../engine/caveats'
  import { ui } from '../state/store.svelte'

  let { id, always = false }: { id: CaveatId; always?: boolean } = $props()

  const c = $derived(copyFor(ui.lang))
  const text = $derived(CAVEATS[id][ui.lang])
  const kind = $derived(c.caveatPanel.kinds[CAVEAT_KIND[id]])
  const active = $derived(always || ui.trace.caveats.includes(id))
</script>

{#if active}
  <button
    type="button"
    class="mark"
    aria-haspopup="dialog"
    aria-label="{kind}: {text.title}"
    title="{kind}: {text.title}"
    onclick={() => ui.openCaveat(id)}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2 14.3 13.5H1.7Z" /><path d="M8 6.4v3.4M8 11.6v.2" /></svg>
  </button>
{/if}

<style>
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
    vertical-align: middle;
  }

  .mark:hover {
    color: var(--red-pen-ink);
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
</style>
