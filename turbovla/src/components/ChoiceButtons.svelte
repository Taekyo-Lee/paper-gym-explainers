<script lang="ts" generics="T extends string | number">
  // 몇 개 안 되는 값 중 하나를 고르는 버튼 묶음 (파라미터 패널). aria-pressed로 고른 값을 알린다.
  // tested에 든 값은 논문이 실험한 값이라 점을 찍어 표시한다.
  let {
    options,
    value,
    onPick,
    groupLabel,
    tested = [],
  }: {
    options: readonly T[]
    value: T
    onPick: (value: T) => void
    groupLabel: string
    tested?: readonly T[]
  } = $props()
</script>

<div class="choices" role="group" aria-label={groupLabel}>
  {#each options as option (option)}
    <button type="button" aria-pressed={option === value} class:tested={tested.includes(option)} onclick={() => onPick(option)}>
      {option}
    </button>
  {/each}
</div>

<style>
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  button {
    position: relative;
    min-width: 30px;
    height: 26px;
    padding: 0 7px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--muted);
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
  }

  button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-fill);
    color: var(--accent-ink);
    font-weight: 700;
  }

  /* 논문이 실험한 값: 버튼 오른쪽 위 작은 점 (숫자와 겹치지 않게) */
  button.tested::after {
    content: '';
    position: absolute;
    top: 3px;
    right: 3px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }
</style>
