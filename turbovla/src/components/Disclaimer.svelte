<script lang="ts">
  import { copyFor } from '../content/i18n'
  import { ui, type Basis } from '../state/store.svelte'

  const c = $derived(copyFor(ui.lang))
  const BASES: Basis[] = ['paper', 'code']
</script>

<!-- 화면 상단에 항상 보이는 가상 값 고지. 무엇을 따르는지도 여기서 고른다. -->
<div class="disclaimer" class:code={ui.config.basis === 'code'}>
  <p role="note">
    <span class="label">{c.disclaimer.label}</span>
    <span>{ui.config.basis === 'code' ? c.disclaimer.textCode : c.disclaimer.textPaper}</span>
  </p>
  <div class="basis">
    <span class="basis-label" id="basis-label">{c.basis.label}</span>
    <div class="segmented" role="group" aria-labelledby="basis-label">
      {#each BASES as basis (basis)}
        <button
          type="button"
          aria-pressed={ui.config.basis === basis}
          title={basis === 'paper' ? c.basis.paperTitle : c.basis.codeTitle}
          onclick={() => ui.setBasis(basis)}
        >
          {c.basis[basis]}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .disclaimer {
    grid-area: note;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 6px 24px;
    border-bottom: 1px solid var(--line);
    background: var(--sunken);
  }

  p {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    margin: 0;
    color: var(--ink);
    font-size: var(--fs-sm);
  }

  .label {
    flex: none;
    padding: 1px 10px;
    border: 1.5px solid var(--red-pen);
    border-radius: var(--radius-pill);
    color: var(--red-pen-ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  /* 공식 코드 기준일 때는 띠 왼쪽에 강조선을 둬서 지금 무엇을 따르는지 한눈에 보이게 한다 */
  .code {
    box-shadow: inset 4px 0 0 var(--accent);
  }

  .basis {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  .basis-label {
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 500;
  }

  .basis .segmented button {
    letter-spacing: 0;
  }
</style>
