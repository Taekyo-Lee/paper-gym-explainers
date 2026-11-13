<script lang="ts">
  // VectorStrip 위에 차원 구간(개념, 질감, 위치, 카메라)을 표시한다 (caveat concept-channels).
  // 개념 구간(24칸)은 좁아서 이름을 위 줄에, 나머지 구간 이름은 아래 줄에 둔다(영어 이름이 겹치지 않게).
  import { CONCEPT_SLOTS, D, POSITION_RANGE, TEXTURE_RANGE, VIEW_RANGE } from '../../engine/concepts'
  import { copyFor } from '../../content/i18n'
  import { ui } from '../../state/store.svelte'

  let { width }: { width: number } = $props()
  const c = $derived(copyFor(ui.lang))
  const segments = $derived([
    { start: 0, end: CONCEPT_SLOTS, label: c.viz.axisConcept, upper: true },
    { start: TEXTURE_RANGE[0], end: TEXTURE_RANGE[1], label: c.viz.axisTexture, upper: false },
    { start: POSITION_RANGE[0], end: POSITION_RANGE[1], label: c.viz.axisPosition, upper: false },
    { start: VIEW_RANGE[0], end: VIEW_RANGE[1], label: c.viz.axisView, upper: false },
  ])
</script>

<div class="axis" style:width="{width}px" aria-hidden="true">
  {#each segments as s (s.start)}
    <span class="seg" class:upper={s.upper} style:left="{(s.start / D) * 100}%" style:width="{((s.end - s.start) / D) * 100}%">
      <span class="label">{s.label}</span>
    </span>
  {/each}
</div>

<style>
  .axis {
    position: relative;
    height: 32px;
    flex: none;
  }

  .seg {
    position: absolute;
    bottom: 0;
    height: 16px;
    border-bottom: 1.5px solid var(--line-strong);
    border-left: 1.5px solid var(--line-strong);
  }

  .seg.upper {
    height: 32px;
  }

  .label {
    position: absolute;
    left: 3px;
    bottom: 2px;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1;
    white-space: nowrap;
  }

  .upper .label {
    top: 1px;
    bottom: auto;
  }

  /* 마지막 구간(카메라)은 띠 오른쪽 끝에 맞춘다. 영어 이름이 띠 밖으로 나가 패널이 가로로 스크롤되지 않게 */
  .seg:last-child .label {
    left: auto;
    right: 0;
  }
</style>
