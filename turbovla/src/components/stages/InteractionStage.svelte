<script lang="ts">
  // V-L Interaction 단계 (Key Idea 2). 위에는 층, head, 모드 고르기, 아래는 하위 탭 셋.
  //   두 방향 attention / residual 업데이트 / 텍스트 블록 (공식 코드에만 있는 블록)
  import { copyFor, fmt, joinList } from '../../content/i18n'
  import { MODE_TERMS, MODES } from '../../content/modes'
  import type { InteractionMode } from '../../engine/types'
  import { interactionHeadRoles } from '../../state/attention'
  import { ui } from '../../state/store.svelte'
  import BasisTag from '../BasisTag.svelte'
  import CaveatMark from '../CaveatMark.svelte'
  import NumberPicker from '../NumberPicker.svelte'
  import Tex from '../Tex.svelte'
  import { g } from '../../content/glossary'
  import AttentionView from './interaction/AttentionView.svelte'
  import LayerDiagram from './interaction/LayerDiagram.svelte'
  import ResidualView from './interaction/ResidualView.svelte'
  import TextBlockView from './interaction/TextBlockView.svelte'

  type Tab = 'attention' | 'residual' | 'text'
  const TABS: Tab[] = ['attention', 'residual', 'text']

  const c = $derived(copyFor(ui.lang))
  const cfg = $derived(ui.config)
  const none = $derived(cfg.mode === 'none')
  const roles = $derived(interactionHeadRoles(cfg.interactionHeads))
  const roleText = $derived.by(() => {
    const groups = roles[ui.interHead - 1] ?? []
    return groups.length ? joinList(groups.map((g) => c.viz.groups[g]), ui.lang) : c.interaction.noRole
  })
  const tabLabel = (tab: Tab) =>
    tab === 'attention' ? c.interaction.tabAttention : tab === 'residual' ? c.interaction.tabResidual : c.interaction.tabText

  /** 탭 목록 안에서는 ←/→로 탭을 옮긴다 (WAI-ARIA tabs). 단계 이동은 탭 밖에서 한다. */
  function onTabKey(event: KeyboardEvent) {
    const i = TABS.indexOf(ui.interTab)
    const next = event.key === 'ArrowRight' ? TABS[(i + 1) % 3] : event.key === 'ArrowLeft' ? TABS[(i + 2) % 3] : null
    if (!next) return
    event.preventDefault()
    ui.interTab = next
    document.getElementById(`inter-tab-${next}`)?.focus()
  }
</script>

<div class="interaction">
  <div class="controls">
    <NumberPicker
      label={c.interaction.layer}
      groupLabel={c.interaction.layerLabel}
      count={cfg.N}
      value={ui.interLayer}
      onPick={(n) => (ui.interLayerPick = n)}
      disabled={none}
    />
    <div class="group">
      <NumberPicker
        label={c.interaction.head}
        groupLabel={c.interaction.headLabel}
        count={cfg.interactionHeads}
        value={ui.interHead}
        onPick={(n) => (ui.interHeadPick = n)}
        disabled={none}
      />
      <span class="role">{fmt(c.interaction.headRole, { roles: roleText })}</span>
      <CaveatMark id="head-roles" />
    </div>
    <label class="group mode">
      <span class="label">{c.interaction.mode}</span>
      <!-- 고르기 칸에는 짧은 이름을 둔다: 칸 폭이 고른 모드에 따라 바뀌어 줄이 넘어가지 않게. 논문 이름은 옆에 쓴다 -->
      <select value={cfg.mode} title={MODE_TERMS[cfg.mode]} onchange={(e) => ui.setMode(e.currentTarget.value as InteractionMode)}>
        {#each MODES as m (m)}
          <option value={m}>{c.params.modeShort[m]}</option>
        {/each}
      </select>
      <span class="mode-term">{MODE_TERMS[cfg.mode]}</span>
    </label>
    <CaveatMark id="interaction-modes" />
  </div>

  {#if none}
    <!-- 섞지 않음이면 attention 패널을 회색으로 두고 그렇다고 밝힌다 -->
    <div class="none">
      <div class="ghost" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div class="none-text">
        <h4>{c.interaction.noneTitle}</h4>
        <p>{c.interaction.noneBody}</p>
        <p class="formula"><Tex display={false} tex={String.raw`${g('Zvl', 'Z^{vl}_t')} = ${g('concat', String.raw`[\,${g('Zv', 'Z^v_t')} \,;\, ${g('Zl', 'Z^l')}\,]`)}`} /></p>
      </div>
    </div>
  {:else}
    <!-- 층 쌓기와 한 층 안의 구조 블록도. 아래 탭이 그림의 어느 부분인지 강조한다 -->
    <LayerDiagram />
    <div class="tabs" role="tablist" aria-label={c.interaction.tabsLabel} tabindex="-1" data-arrow-keys onkeydown={onTabKey}>
      {#each TABS as tab (tab)}
        <button
          type="button"
          role="tab"
          id="inter-tab-{tab}"
          aria-selected={ui.interTab === tab}
          aria-controls="inter-panel"
          tabindex={ui.interTab === tab ? 0 : -1}
          onclick={() => (ui.interTab = tab)}
        >
          {tabLabel(tab)}
          {#if tab === 'text'}<BasisTag kind="code" />{/if}
        </button>
      {/each}
    </div>
    <div id="inter-panel" role="tabpanel" aria-labelledby="inter-tab-{ui.interTab}">
      {#if ui.interTab === 'attention'}
        <AttentionView />
      {:else if ui.interTab === 'residual'}
        <ResidualView />
      {:else}
        <TextBlockView />
      {/if}
    </div>
  {/if}
</div>

<style>
  .interaction {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 18px;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .label {
    margin-right: 4px;
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  /* 논문 이름. 가장 긴 이름의 폭을 미리 잡아 두어 모드를 바꿔도 줄의 모양이 그대로다 */
  .mode-term {
    min-width: 11.5em;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .role {
    margin-left: 6px;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  select {
    padding: 2px 6px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
  }

  .tabs {
    display: flex;
    gap: 6px;
  }

  [role='tab'] {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    padding: 3px 12px;
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--muted);
    font-size: var(--fs-sm);
    font-weight: 700;
    text-align: left;
  }

  [role='tab'][aria-selected='true'] {
    border-color: var(--accent);
    background: var(--accent-fill);
    color: var(--ink);
  }

  .none {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    padding: 16px;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--sunken);
  }

  .ghost {
    display: flex;
    gap: 10px;
    flex: none;
  }

  .ghost span {
    width: 64px;
    height: 150px;
    border-radius: var(--radius-sm);
    background: repeating-linear-gradient(135deg, var(--line) 0 2px, transparent 2px 7px);
  }

  .none-text {
    max-width: 560px;
  }

  .none-text h4 {
    margin: 0 0 6px;
    font-size: var(--fs-md);
  }

  .none-text p {
    margin: 0 0 6px;
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .formula {
    color: var(--ink);
  }
</style>
