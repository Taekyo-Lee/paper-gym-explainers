<script lang="ts">
  // 프리셋 설명 카드 (상단 바의 프리셋 옆 ⓘ). 지금 프리셋(프로필)이 논문의 어떤 실험 설정인지를 표로 보인다.
  // 텐서 모양에 쓰는 값은 PRESETS에서, 그 밖의 논문 사실(encoder, 성공률, 지연 시간)은 PRESET_FACTS에서 읽는다.
  // Custom이면 표는 그 프로필의 논문 설정이고, 화면의 모양이 다를 수 있다고 밝힌다.
  import { copyFor, fmt, joinList } from '../content/i18n'
  import { PRESET_FACTS } from '../engine/paperNumbers'
  import { PRESETS } from '../engine/presets'
  import { viewsFor } from '../engine/scene'
  import { ui } from '../state/store.svelte'
  import InfoMark from './InfoMark.svelte'

  const c = $derived(copyFor(ui.lang))
  const t = $derived(c.topbar.presetInfo)
  const libero = $derived(ui.config.profile === 'libero')
  const base = $derived(PRESETS[libero ? 'LIBERO' : 'RoboTwin'])
  const facts = $derived(PRESET_FACTS[libero ? 'libero' : 'robotwin'])
  const name = $derived(libero ? 'LIBERO' : 'RoboTwin 2.0')
  const perView = $derived((base.imageSize / base.patchSize) ** 2)
  const names = $derived(joinList(viewsFor(base).map((v) => v.name), ui.lang))

  const rows = $derived([
    [t.cameras, fmt(t.camerasValue, { k: base.K, names })],
    [t.image, fmt(t.imageValue, { s: base.imageSize })],
    [t.tokens, fmt(t.tokensValue, { p: perView, total: base.K * perView })],
    [t.encoder, facts.visionEncoder],
    [t.state, fmt(t.stateValue, { n: base.stateDim })],
    [t.action, fmt(libero ? t.actionLibero : t.actionRobotwin, { n: base.actionDim })],
    [t.horizon, fmt(t.horizonValue, { h: base.H })],
    [t.result, fmt(t.resultValue, { s: facts.success, src: facts.source, ms: facts.latencyMs })],
  ])
</script>

<InfoMark label={t.label} title={fmt(t.title, { name })} width={380}>
  <span class="card">
    <span class="intro">{libero ? t.libero : t.robotwin}</span>
    <span class="rows">
      {#each rows as [k, v] (k)}
        <span class="k">{k}</span><span class="v">{v}</span>
      {/each}
    </span>
    {#if ui.config.preset === 'Custom'}<span class="custom">{t.custom}</span>{/if}
    <span class="source">{t.source}</span>
  </span>
</InfoMark>

<style>
  /* popover 안이라 span만 쓴다 (InfoMark의 popover가 span이다) */
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rows {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 12px;
    padding: 6px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }

  .k {
    color: var(--muted);
    white-space: nowrap;
  }

  .v {
    color: var(--ink);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .custom {
    color: var(--accent-ink);
  }

  .source {
    color: var(--muted);
  }
</style>
