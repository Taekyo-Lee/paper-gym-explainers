<script lang="ts">
  import { copyFor, LANGS } from '../content/i18n'
  import { ui } from '../state/store.svelte'

  const c = $derived(copyFor(ui.lang))
</script>

<!-- 버튼에 보이는 글자(KO, EN)가 곧 접근 가능한 이름이다. -->
<div class="segmented" role="group" aria-label={c.lang.groupLabel}>
  {#each LANGS as lang (lang)}
    <button type="button" aria-pressed={ui.lang === lang} title={c.lang[lang]} onclick={() => ui.setLang(lang)}>
      {lang.toUpperCase()}
    </button>
  {/each}
</div>
