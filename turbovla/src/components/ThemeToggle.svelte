<script lang="ts">
  import { copyFor } from '../content/i18n'
  import { ui, type Theme } from '../state/store.svelte'

  const c = $derived(copyFor(ui.lang))
  const THEMES: Theme[] = ['light', 'dark']
</script>

<!-- 아이콘만 있는 버튼이라 aria-label로 이름을 준다. -->
<div class="segmented" role="group" aria-label={c.theme.groupLabel}>
  {#each THEMES as theme (theme)}
    <button
      type="button"
      aria-pressed={ui.theme === theme}
      aria-label={c.theme[theme]}
      title={c.theme[theme]}
      onclick={() => ui.setTheme(theme)}
    >
      {#if theme === 'light'}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z" />
        </svg>
      {/if}
    </button>
  {/each}
</div>

<style>
  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
