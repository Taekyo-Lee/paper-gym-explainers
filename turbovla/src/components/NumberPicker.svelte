<script lang="ts">
  // 1..count 중 하나를 고르는 작은 번호 버튼 묶음 (층, head 고르기). aria-pressed로 고른 것을 알린다.
  let {
    label,
    groupLabel,
    count,
    value,
    onPick,
    disabled = false,
  }: {
    /** 화면에 보이는 짧은 이름 (예: 층, head) */
    label: string
    /** 화면 낭독기용 묶음 이름 (예: 볼 decoder 층) */
    groupLabel: string
    count: number
    value: number
    onPick: (n: number) => void
    disabled?: boolean
  } = $props()

  const numbers = $derived(Array.from({ length: count }, (_, i) => i + 1))
</script>

<div class="picker" role="group" aria-label={groupLabel}>
  <span class="label">{label}</span>
  {#each numbers as n (n)}
    <button type="button" class="num" aria-pressed={n === value} {disabled} onclick={() => onPick(n)}>{n}</button>
  {/each}
</div>

<style>
  .picker {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .label {
    margin-right: 4px;
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .num {
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--muted);
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
  }

  .num[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-fill);
    color: var(--accent-ink);
    font-weight: 700;
  }

  .num:disabled {
    opacity: 0.5;
  }
</style>
