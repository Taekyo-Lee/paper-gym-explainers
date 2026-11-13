<script lang="ts">
  // 하단 바: 논문 근거 배지, 기술적 주의 목록, 2017 비교, Loss 장난감.
  // 창은 App이 그린다(Dialog). 여기서는 store의 dialog만 바꾼다.
  import { copyFor, fmt } from '../content/i18n'
  import { ui } from '../state/store.svelte'
  import PaperBadge from './PaperBadge.svelte'

  const c = $derived(copyFor(ui.lang))
</script>

<footer class="bottom">
  <div class="badge-wrap">
    <span class="badge-label">{c.bottom.badge}</span>
    <PaperBadge live />
  </div>
  <div class="actions">
    <button type="button" class="caveats" aria-haspopup="dialog" onclick={() => ui.openDialog('caveats')}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2 14.3 13.5H1.7Z" /><path d="M8 6.4v3.4M8 11.6v.2" /></svg>
      {fmt(c.bottom.caveats, { n: ui.trace.caveats.length })}
    </button>
    <button type="button" aria-haspopup="dialog" onclick={() => ui.openDialog('compare2017')}>{c.bottom.compare2017}</button>
    <button type="button" aria-haspopup="dialog" onclick={() => ui.openDialog('lossToy')}>{c.bottom.lossToy}</button>
    <button type="button" aria-haspopup="dialog" onclick={() => ui.openDialog('benchmarks')}>{c.bottom.benchmarks}</button>
  </div>
</footer>

<style>
  .bottom {
    grid-area: bottom;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 8px 24px;
    border-top: 1px solid var(--line);
    background: var(--bg);
  }

  .badge-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge-label {
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 700;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 500;
  }

  button:hover {
    border-color: var(--ink);
  }

  .caveats svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: var(--red-pen-ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
</style>
