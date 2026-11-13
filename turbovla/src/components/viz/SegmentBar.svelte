<script module lang="ts">
  export interface Segment {
    label: string
    value: number
    /** CSS 색 (예: var(--vision)) */
    color: string
    /** 값 옆에 붙일 글 (예: '512개', '99%') */
    text: string
  }
</script>

<script lang="ts">
  // 전체 하나를 구간으로 나눈 막대 (dataviz: segmented bar). 너비는 실제 비율이고, 아주 작은 구간도 보이도록 최소 3px.
  // 구간 이름과 값은 막대 아래 범례에 글자로 단다 (색만으로 구분하지 않게).
  let { segments, width, label }: { segments: Segment[]; width: number; label: string } = $props()

  const total = $derived(segments.reduce((s, x) => s + x.value, 0) || 1)
</script>

<!-- figure/figcaption을 쓰지 않는다: 범례가 막대의 이름으로 한 번 더 읽히지 않게 (막대 이름은 role=img에 한 번) -->
<div class="segbar" style:width="{width}px">
  <div class="bar" role="img" aria-label="{label}: {segments.map((s) => `${s.label} ${s.text}`).join(', ')}">
    {#each segments as s (s.label)}
      <span class="part" style:flex-grow={s.value / total} style:background={s.color}></span>
    {/each}
  </div>
  <div class="legend" aria-hidden="true">
    {#each segments as s (s.label)}
      <span class="item"><span class="key" style:background={s.color}></span>{s.label} <b>{s.text}</b></span>
    {/each}
  </div>
</div>

<style>
  .segbar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }

  .bar {
    display: flex;
    gap: 2px;
    height: 10px;
  }

  .part {
    flex-basis: 0;
    min-width: 3px;
    border-radius: 2px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .item b {
    color: var(--ink);
    font-weight: 700;
  }

  .key {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
</style>
