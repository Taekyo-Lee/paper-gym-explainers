<script lang="ts">
  // "논문" / "공식 코드" 표시: 두 기준이 다른 곳에 단다.
  import { copyFor } from '../content/i18n'
  import { ui } from '../state/store.svelte'

  let { kind }: { kind: 'paper' | 'code' } = $props()
  const c = $derived(copyFor(ui.lang))
</script>

<span class="tag {kind}">{kind === 'code' ? c.viz.code : c.viz.paper}</span>

<style>
  .tag {
    display: inline-block;
    padding: 0 7px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1.6;
    white-space: nowrap;
    vertical-align: middle;
  }

  .code {
    color: var(--accent-ink);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .paper {
    color: var(--ink);
    box-shadow: inset 0 0 0 1.5px var(--line-strong);
  }
</style>
