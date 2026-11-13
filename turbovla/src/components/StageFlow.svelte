<script lang="ts">
  import type { Component } from 'svelte'
  import { STAGES, type StageId } from '../content/stages'
  import { ui } from '../state/store.svelte'
  import StagePanel from './StagePanel.svelte'
  import DecoderStage from './stages/DecoderStage.svelte'
  import EncodersStage from './stages/EncodersStage.svelte'
  import InputsStage from './stages/InputsStage.svelte'
  import InteractionStage from './stages/InteractionStage.svelte'
  import MemoryStage from './stages/MemoryStage.svelte'
  import OutputStage from './stages/OutputStage.svelte'

  /** 단계 패널 폭. 내용이 없는 단계는 400 px */
  const WIDTHS: Partial<Record<StageId, number>> = { inputs: 640, encoders: 1000, interaction: 1000, memory: 600, decoder: 1000, output: 760 }

  const BODIES: Record<StageId, Component> = {
    inputs: InputsStage,
    encoders: EncodersStage,
    interaction: InteractionStage,
    memory: MemoryStage,
    decoder: DecoderStage,
    output: OutputStage,
  }

  let scroller: HTMLElement | undefined = $state()
  let firstScroll = true

  // 단계가 바뀌면 그 단계를 가운데로 데려온다. 흐름 전체는 계속 보인다.
  $effect(() => {
    const target = scroller?.querySelector<HTMLElement>(`#stage-${ui.stage}`)
    if (!scroller || !target) return
    const left = target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ left, behavior: firstScroll || reduceMotion ? 'auto' : 'smooth' })
    firstScroll = false
  })
</script>

<main class="flow" bind:this={scroller}>
  <div class="track">
    {#each STAGES as stage, i (stage)}
      {@const Body = BODIES[stage]}
      <StagePanel {stage} index={i} width={WIDTHS[stage] ?? 400}>
        <Body />
      </StagePanel>
      {#if i < STAGES.length - 1}
        <svg class="connector" class:lit={ui.stageIndex === i || ui.stageIndex === i + 1} viewBox="0 0 40 16" aria-hidden="true">
          <path d="M2 8h30" />
          <path d="M28 3l6 5-6 5" />
        </svg>
      {/if}
    {/each}
  </div>
</main>

<style>
  .flow {
    grid-area: flow;
    min-height: 0;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 12px 24px 16px;
    scrollbar-color: var(--line-strong) transparent;
  }

  .track {
    display: flex;
    align-items: stretch;
    gap: 6px;
    width: max-content;
    height: 100%;
  }

  .connector {
    flex: none;
    align-self: center;
    width: 40px;
    height: 16px;
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: stroke 0.25s var(--ease);
  }

  .connector.lit {
    stroke: var(--accent);
  }
</style>
