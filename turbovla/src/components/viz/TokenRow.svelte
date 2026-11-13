<script module lang="ts">
  export type Modality = 'vision' | 'language' | 'state' | 'action'
</script>

<script lang="ts">
  // 토큰 여러 개를 작은 네모 줄로 그린다 (세미나 슬라이드의 토큰 그림과 같은 모양).
  let { kind, count, label = '' }: { kind: Modality; count: number; label?: string } = $props()
</script>

<span class="row {kind}">
  {#each { length: count }, i (i)}
    <span class="token" aria-hidden="true"></span>
  {/each}
  {#if label}<span class="label">{label}</span>{/if}
</span>

<style>
  .row {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .token {
    width: 20px;
    height: 20px;
    border: 1.5px solid var(--c);
    border-radius: 5px;
    background: var(--fill);
  }

  .label {
    margin-left: 6px;
    color: var(--c-ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .vision {
    --c: var(--vision);
    --c-ink: var(--vision-ink);
    --fill: var(--vision-fill);
  }

  .language {
    --c: var(--language);
    --c-ink: var(--language-ink);
    --fill: var(--language-fill);
  }

  .state {
    --c: var(--state);
    --c-ink: var(--state-ink);
    --fill: var(--state-fill);
  }

  .action {
    --c: var(--accent);
    --c-ink: var(--accent-ink);
    --fill: var(--accent-fill);
  }
</style>
