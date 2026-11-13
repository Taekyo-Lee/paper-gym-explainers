<script lang="ts">
  // 로봇 state 슬라이더. 값의 뜻과 범위는 논문(App. A.2)과 공식 코드를 따른다.
  // 짧은 이름(eef x, L j1 등)의 풀이는 InputsStage 제목 옆 설명 아이콘에 있다 (sliderLegend).
  import { num } from '../../../content/i18n'
  import { ui } from '../../../state/store.svelte'

  const LIBERO = ['eef x', 'eef y', 'eef z', 'rot x', 'rot y', 'rot z', 'finger 1', 'finger 2']
  const ROBOTWIN = [
    ...Array.from({ length: 6 }, (_, i) => `L j${i + 1}`),
    ...Array.from({ length: 6 }, (_, i) => `R j${i + 1}`),
    'L grip',
    'R grip',
  ]

  const uid = $props.id()
  const robotwin = $derived(ui.config.profile === 'robotwin' && ui.config.stateDim === 14)
  const libero = $derived(!robotwin && ui.config.stateDim === 8)
  const labels = $derived(
    robotwin ? ROBOTWIN : libero ? LIBERO : Array.from({ length: ui.config.stateDim }, (_, i) => `s${i + 1}`),
  )

  function range(i: number): { min: number; max: number; step: number } {
    if (robotwin) return i >= 12 ? { min: 0, max: 1, step: 1 } : { min: -1, max: 1, step: 0.01 }
    return { min: -3, max: 3, step: 0.05 }
  }
</script>

<!-- RoboTwin은 14개라 이름이 짧은 대신(L j1) 4열로 둔다: 1440 × 900에서 줄이 하나 줄어 패널 안 스크롤이 짧아진다 -->
<div class="sliders" class:wide={robotwin}>
  {#each ui.robotState as value, i (i)}
    {@const r = range(i)}
    <div class="row">
      <!-- 이름만 label로 묶는다: 값 글자가 접근 가능한 이름에 섞이지 않게 (값은 slider가 스스로 알린다) -->
      <label class="name" for="{uid}-s{i}">{labels[i]}</label>
      <input
        id="{uid}-s{i}"
        type="range"
        min={r.min}
        max={r.max}
        step={r.step}
        {value}
        oninput={(e) => ui.setStateValue(i, Number(e.currentTarget.value))}
      />
      <span class="value" aria-hidden="true">{r.step === 1 ? num(value, 0) : num(value)}</span>
    </div>
  {/each}
</div>

<style>
  .sliders {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px 16px;
  }

  .sliders.wide {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px 12px;
  }

  .row {
    display: grid;
    grid-template-columns: 8.5ch 1fr 5ch;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }

  .wide .row {
    grid-template-columns: 6ch 1fr 5ch;
  }

  .name {
    color: var(--state-ink);
    white-space: nowrap;
  }

  input {
    width: 100%;
    min-width: 0;
    accent-color: var(--state);
  }

  .value {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>
