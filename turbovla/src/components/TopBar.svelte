<script lang="ts">
  import { copyFor } from '../content/i18n'
  import { INSTRUCTION_PRESETS } from '../content/instructions'
  import { ui, type PresetName } from '../state/store.svelte'
  import LangToggle from './LangToggle.svelte'
  import PresetInfo from './PresetInfo.svelte'
  import ThemeToggle from './ThemeToggle.svelte'

  const c = $derived(copyFor(ui.lang))
  const presets: PresetName[] = ['LIBERO', 'RoboTwin', 'Custom']

  function presetLabel(preset: PresetName): string {
    if (preset === 'RoboTwin') return 'RoboTwin 2.0'
    if (preset === 'Custom') return c.topbar.presetCustom
    return preset
  }
</script>

<header class="topbar">
  <div class="brand">
    <span class="eyebrow">{c.meta.eyebrow}</span>
    <h1>{c.meta.title}</h1>
  </div>

  <div class="controls">
    <span class="preset">
    <label class="field">
      <span class="field-label">{c.topbar.presetLabel}</span>
      <select
        value={ui.config.preset}
        onchange={(event) => {
          const value = event.currentTarget.value
          if (value === 'LIBERO' || value === 'RoboTwin') ui.setPreset(value)
        }}
      >
        {#each presets as preset (preset)}
          <!-- Custom은 값을 하나라도 바꾸면 저절로 된다. 직접 고르는 항목이 아니다 -->
          <option value={preset} disabled={preset === 'Custom' && ui.config.preset !== 'Custom'}>{presetLabel(preset)}</option>
        {/each}
      </select>
    </label>
    <!-- 프리셋이 논문의 어떤 실험 설정인지 (label 밖에 둔다: 단추가 고르기 칸의 이름에 섞이지 않게) -->
    <PresetInfo />
    </span>

    <label class="field instruction">
      <span class="field-label">{c.topbar.instructionLabel}</span>
      <input
        type="text"
        list="instruction-presets"
        bind:value={ui.instruction}
        placeholder={c.topbar.instructionPlaceholder}
        autocomplete="off"
        spellcheck="false"
        lang={ui.instruction ? 'en' : undefined}
      />
      <datalist id="instruction-presets">
        {#each INSTRUCTION_PRESETS as text (text)}
          <option value={text}></option>
        {/each}
      </datalist>
    </label>
  </div>

  <div class="end">
    <a class="paper-link" href="https://arxiv.org/abs/2607.27205" target="_blank" rel="noopener noreferrer">
      {c.topbar.paperLink}
      <span aria-hidden="true">↗</span>
    </a>
    <ThemeToggle />
    <LangToggle />
  </div>
</header>

<style>
  .topbar {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: 28px;
    padding: 12px 24px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }

  .brand {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    flex: none;
  }

  .eyebrow {
    color: var(--accent-ink);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  h1 {
    margin: 0;
    font-size: var(--fs-xl);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }

  .preset {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-label {
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 500;
    white-space: nowrap;
  }

  select,
  input {
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    font-size: var(--fs-sm);
  }

  .instruction {
    flex: 1;
    min-width: 220px;
    max-width: 560px;
  }

  /* 브라우저 기본 회색(#757575)은 dark 테마에서 4.5:1이 안 된다 */
  .instruction input::placeholder {
    color: var(--muted);
    opacity: 1;
  }

  .instruction input {
    flex: 1;
    min-width: 0;
    color: var(--language-ink);
    font-weight: 500;
  }

  .end {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }

  .paper-link {
    margin-right: 6px;
    color: var(--muted);
    font-size: var(--fs-sm);
    text-decoration: none;
  }

  .paper-link:hover {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
