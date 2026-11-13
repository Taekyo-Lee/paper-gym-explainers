<script lang="ts">
  // 파라미터 패널. 프리셋에서 값을 바꾸면 Custom이 되고(withChanges), forward가 다시 계산된다(단계별 memo).
  // 논문이 실험한 값에는 점을 찍고 출처를 단다. 위의 배지가 지금 설정의 논문 숫자다.
  import { copyFor, fmt, joinList } from '../content/i18n'
  import { MODE_TERMS, MODES } from '../content/modes'
  import { HEAD_CHOICES, PRESETS } from '../engine/presets'
  import type { Config, InteractionMode } from '../engine/types'
  import { ui } from '../state/store.svelte'
  import CaveatMark from './CaveatMark.svelte'
  import ChoiceButtons from './ChoiceButtons.svelte'
  import PaperBadge from './PaperBadge.svelte'
  import Sym from './Sym.svelte'

  // 좁은 패널의 고르기 칸에는 짧은 이름만 두고, 논문 이름(MODE_TERMS)은 아래 문장으로 쓴다
  /** seed는 32비트 정수로 섞이므로(engine/prng.ts) 그 범위로 묶는다. 범위를 넘으면 다른 seed가 같은 값을 낸다 */
  const SEED_MAX = 4294967295

  const c = $derived(copyFor(ui.lang))
  const cfg = $derived(ui.config)
  const libero = $derived(cfg.profile === 'libero')
  const base = $derived(PRESETS[libero ? 'LIBERO' : 'RoboTwin'])
  const grid = $derived(cfg.imageSize / cfg.patchSize)
  /** 프리셋과 다른 값 (seed, 온도 포함. 기준은 따로) */
  const changedKeys = $derived(
    (['K', 'imageSize', 'N', 'interactionHeads', 'mode', 'H', 'Ns'] as const).filter((k) => cfg[k] !== base[k]),
  )
  const demoChanged = $derived(cfg.seed !== base.seed || cfg.attnTemperature !== base.attnTemperature)
  const changedText = $derived(
    joinList(
      [...changedKeys.map((k) => c.params.keyNames[k]), ...(cfg.seed !== base.seed ? [c.params.keyNames.seed] : []), ...(cfg.attnTemperature !== base.attnTemperature ? [c.params.keyNames.attnTemperature] : [])],
      ui.lang,
    ),
  )
  const set = (changes: Partial<Config>) => ui.setParams(changes)

  /** 온도 슬라이더는 log2 눈금: −2 … 2 → 0.25 … 4 */
  const tempExp = $derived(Math.log2(cfg.attnTemperature))

  /** 되돌리기를 누르면 단추가 꺼지므로, 포커스를 바뀐 상태를 알리는 문장으로 옮긴다(화면 낭독기가 결과를 읽는다) */
  let statusEl: HTMLElement | undefined = $state()
  function reset() {
    ui.resetParams()
    statusEl?.focus()
  }
</script>

<aside class="params" class:open={ui.paramsOpen} aria-labelledby="params-title">
  <div class="head">
    {#if ui.paramsOpen}
      <h2 id="params-title">{c.params.title}</h2>
    {:else}
      <h2 id="params-title" class="visually-hidden">{c.params.title}</h2>
    {/if}
    <button
      type="button"
      class="toggle"
      aria-expanded={ui.paramsOpen}
      aria-controls="params-body"
      aria-label={ui.paramsOpen ? c.params.close : c.params.open}
      title={ui.paramsOpen ? c.params.close : c.params.open}
      onclick={() => (ui.paramsOpen = !ui.paramsOpen)}
    >
      <span aria-hidden="true">{ui.paramsOpen ? '›' : '‹'}</span>
    </button>
  </div>

  <div id="params-body" class="body" hidden={!ui.paramsOpen}>
    <p class="lead">{c.params.lead}</p>

    <!-- 프리셋과 논문 근거 -->
    <section class="preset">
      <div class="row">
        <span class="label">{c.params.preset}</span>
        <strong>{cfg.preset === 'Custom' ? c.topbar.presetCustom : cfg.preset === 'RoboTwin' ? 'RoboTwin 2.0' : 'LIBERO'}</strong>
      </div>
      <p class="note status" tabindex="-1" bind:this={statusEl}>{changedKeys.length || demoChanged ? fmt(c.params.changed, { keys: changedText }) : c.params.unchanged}</p>
      <PaperBadge showExtra={false} />
      {#if ui.paper.badge?.extra}<p class="note">{fmt(c.bottom.badgeParams, { params: ui.paper.badge.extra })} ({ui.paper.badge.extraSource ?? ui.paper.badge.source})</p>{/if}
      <button type="button" class="reset" disabled={!changedKeys.length && !demoChanged} onclick={reset}>{c.params.reset}</button>
    </section>

    <!-- 이미지 -->
    <section>
      <h3>{c.params.groupImage}</h3>
      <div class="field">
        <span class="label">{c.params.K} <Sym k="K" /></span>
        <ChoiceButtons options={[1, 2, 3]} value={cfg.K} onPick={(K) => set({ K })} groupLabel={c.params.K} />
      </div>
      <div class="field">
        <span class="label">{c.params.imageSize}</span>
        <ChoiceButtons options={[224, 256] as const} value={cfg.imageSize} onPick={(imageSize) => set({ imageSize })} groupLabel={c.params.imageSize} />
      </div>
      <p class="note">{fmt(c.params.imageNote, { P: grid * grid, g: grid })}</p>
    </section>

    <!-- V-L interaction -->
    <section>
      <h3>{c.params.groupInteraction}</h3>
      <div class="field">
        <span class="label">{c.params.N} <Sym k="N" /></span>
        <ChoiceButtons options={[1, 2, 3, 4, 5, 6]} value={cfg.N} onPick={(N) => set({ N })} groupLabel={c.params.N} tested={libero ? [2, 4, 6] : []} />
      </div>
      {#if libero}<p class="note">{fmt(c.params.tested, { values: '2, 4, 6', source: 'Tab. 9' })}</p>{/if}
      <div class="field">
        <span class="label">{c.params.heads}</span>
        <ChoiceButtons options={HEAD_CHOICES} value={cfg.interactionHeads} onPick={(interactionHeads) => set({ interactionHeads })} groupLabel={c.params.heads} />
      </div>
      <p class="note">{c.params.headsNote}</p>
      <label class="field">
        <span class="label">{c.params.mode}</span>
        <select value={cfg.mode} onchange={(e) => set({ mode: e.currentTarget.value as InteractionMode })}>
          {#each MODES as m (m)}<option value={m}>{c.params.modeShort[m]}</option>{/each}
        </select>
      </label>
      <p class="note">{fmt(c.params.modePaper, { term: MODE_TERMS[cfg.mode], source: libero ? 'Tab. 5' : 'Tab. 10' })}</p>
    </section>

    <!-- action -->
    <section>
      <h3>{c.params.groupAction}</h3>
      <div class="field">
        <label class="label" for="param-h">{c.params.H} <Sym k="H" /></label>
        <span class="value">{cfg.H}</span>
      </div>
      <input id="param-h" type="range" min="1" max="50" step="1" value={cfg.H} list={libero ? 'param-h-tested' : undefined} oninput={(e) => set({ H: Number(e.currentTarget.value) })} />
      {#if libero}
        <datalist id="param-h-tested"><option value="8"></option><option value="10"></option><option value="12"></option><option value="15"></option></datalist>
        <p class="note">{fmt(c.params.tested, { values: '8, 10, 12, 15', source: 'Fig. 6' })}</p>
      {/if}
    </section>

    <!-- state -->
    <section>
      <h3>{c.params.groupState}</h3>
      <div class="field">
        <span class="label">{c.params.Ns} <Sym k="Ns" /></span>
        <ChoiceButtons options={[1, 2, 3, 4]} value={cfg.Ns} onPick={(Ns) => set({ Ns })} groupLabel={c.params.Ns} />
      </div>
    </section>

    <!-- 설명용 값: 논문에 없는 값 -->
    <section>
      <h3>{c.params.groupDemo}</h3>
      <div class="field">
        <!-- 주의 표시 단추는 label 밖에 둔다 (슬라이더 이름에 섞이거나, 단추를 누를 때 슬라이더로 포커스가 가지 않게) -->
        <span class="label"><label for="param-temp">{c.params.temperature}</label> <CaveatMark id="temperature" /></span>
        <span class="value">{cfg.attnTemperature.toFixed(2)}</span>
      </div>
      <input
        id="param-temp"
        type="range"
        min="-2"
        max="2"
        step="0.25"
        value={tempExp}
        aria-valuetext={cfg.attnTemperature.toFixed(2)}
        oninput={(e) => set({ attnTemperature: Math.round(2 ** Number(e.currentTarget.value) * 1000) / 1000 })}
      />
      <p class="note">{c.params.temperatureNote}</p>
      <div class="field">
        <label class="label" for="param-seed">{c.params.seed}</label>
        <span class="seed">
          <input
            id="param-seed"
            type="number"
            min="0"
            max={SEED_MAX}
            step="1"
            value={cfg.seed}
            onchange={(e) => {
              const v = Math.min(SEED_MAX, Math.max(0, Math.floor(Number(e.currentTarget.value) || 0)))
              set({ seed: v })
              // 고친 값이 지금 seed와 같으면 Svelte가 칸을 다시 쓰지 않으므로 직접 쓴다 (칸에 쓰지 않는 seed가 남지 않게)
              e.currentTarget.value = String(v)
            }}
          />
          <button type="button" class="small-btn" onclick={() => set({ seed: cfg.seed >= SEED_MAX ? 0 : cfg.seed + 1 })}>{c.params.reseed}</button>
        </span>
      </div>
      <p class="note">{c.params.seedNote}</p>
    </section>
  </div>

  {#if !ui.paramsOpen}
    <span class="rail-label" aria-hidden="true">{c.params.title}</span>
  {/if}
</aside>

<style>
  .params {
    grid-area: params;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: 12px 16px;
    border-left: 1px solid var(--line);
    background: var(--bg);
  }

  .params:not(.open) {
    align-items: center;
    padding: 12px 6px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    margin: 0;
    font-size: var(--fs-md);
    font-weight: 700;
  }

  .toggle {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: var(--card);
    color: var(--muted);
    font-size: var(--fs-lg);
    line-height: 1;
  }

  .toggle:hover {
    color: var(--ink);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    margin: 0 -16px;
    padding: 0 16px 12px;
    overflow-y: auto;
  }

  .body[hidden] {
    display: none;
  }

  .lead {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--card);
  }

  .preset {
    align-items: flex-start;
  }

  h3 {
    margin: 0;
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .row,
  .field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 8px;
    width: 100%;
  }

  .label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .value {
    color: var(--ink);
    font-size: var(--fs-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .status:focus {
    outline: none;
  }

  .status:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.45;
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }

  select {
    width: 100%;
    max-width: 100%;
    padding: 2px 6px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .seed {
    display: inline-flex;
    gap: 6px;
  }

  .seed input {
    width: 64px;
    padding: 2px 6px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .reset,
  .small-btn {
    padding: 2px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .reset:disabled {
    color: var(--muted);
    opacity: 0.6;
  }

  .rail-label {
    color: var(--muted);
    font-size: var(--fs-sm);
    font-weight: 700;
    writing-mode: vertical-rl;
  }
</style>
