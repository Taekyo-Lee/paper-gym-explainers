<script lang="ts">
  // Encoders 단계 (Key Idea 1). 하위 탭 셋(이미지, 지시문, state)으로 나눈다.
  import { copyFor } from '../../content/i18n'
  import { shapeOf } from '../../engine/tensor'
  import { ui } from '../../state/store.svelte'
  import Sym from '../Sym.svelte'
  import type { GlossKey } from '../../content/glossary'
  import EncoderState from './encoders/EncoderState.svelte'
  import EncoderText from './encoders/EncoderText.svelte'
  import EncoderVision from './encoders/EncoderVision.svelte'

  type Tab = 'vision' | 'text' | 'state'
  const c = $derived(copyFor(ui.lang))
  const tabs = $derived<{ id: Tab; label: string; symbol: GlossKey; shape: string }[]>([
    { id: 'vision', label: c.encoders.vision, symbol: 'Zv', shape: shapeOf(ui.trace.Zv) },
    { id: 'text', label: c.encoders.text, symbol: 'Zl', shape: shapeOf(ui.trace.Zl) },
    { id: 'state', label: c.encoders.state, symbol: 'Zs', shape: shapeOf(ui.trace.state.Zs) },
  ])

  /** 탭 목록 안에서는 ←/→로 탭을 옮긴다 (WAI-ARIA tabs). 단계 이동은 탭 밖에서 한다. */
  function onkeydown(event: KeyboardEvent) {
    const order: Tab[] = ['vision', 'text', 'state']
    const i = order.indexOf(ui.encoderTab)
    const next = event.key === 'ArrowRight' ? order[(i + 1) % 3] : event.key === 'ArrowLeft' ? order[(i + 2) % 3] : null
    if (!next) return
    event.preventDefault()
    ui.encoderTab = next
    document.getElementById(`enc-tab-${next}`)?.focus()
  }
</script>

<div class="encoders">
  <div class="tabs" role="tablist" aria-label={c.encoders.tabsLabel} tabindex="-1" data-arrow-keys {onkeydown}>
    {#each tabs as t (t.id)}
      <button
        type="button"
        role="tab"
        id="enc-tab-{t.id}"
        class={t.id}
        aria-selected={ui.encoderTab === t.id}
        aria-controls="enc-panel"
        tabindex={ui.encoderTab === t.id ? 0 : -1}
        onclick={() => (ui.encoderTab = t.id)}
      >
        <span class="label">{t.label}</span>
        <span class="out"><Sym k={t.symbol} /> <span class="shape">{t.shape}</span></span>
      </button>
    {/each}
  </div>
  <div id="enc-panel" role="tabpanel" aria-labelledby="enc-tab-{ui.encoderTab}">
    {#if ui.encoderTab === 'vision'}
      <EncoderVision />
    {:else if ui.encoderTab === 'text'}
      <EncoderText />
    {:else}
      <EncoderState />
    {/if}
  </div>
</div>

<style>
  .encoders {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tabs {
    display: flex;
    gap: 6px;
  }

  [role='tab'] {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: 10px;
    padding: 5px 12px;
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--muted);
    text-align: left;
  }

  .out {
    font-size: var(--fs-xs);
  }

  [role='tab'] .label {
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  [role='tab'][aria-selected='true'] {
    color: var(--ink);
  }

  .vision[aria-selected='true'] {
    border-color: var(--vision);
    background: var(--vision-fill);
  }

  .text[aria-selected='true'] {
    border-color: var(--language);
    background: var(--language-fill);
  }

  .state[aria-selected='true'] {
    border-color: var(--state);
    background: var(--state-fill);
  }
</style>
