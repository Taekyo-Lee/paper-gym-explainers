<script lang="ts">
  // 기술적 주의 창. 지금 설정(기준, 프로필, 모드, 지시문)에 해당하는 caveat만 보인다.
  // 목록은 forward 결과의 caveats에서 온다. 설정 때문에 생긴 것을 먼저, 늘 해당하는 것을 뒤에 둔다.
  // 항목마다 종류(가정 = 논문이 말하지 않아 정한 것, 단순화 = 설명하려고 실제와 다르게 만든 것)를 단다.
  // 그림 옆 주의 표시를 눌러 열었으면 그 항목으로 스크롤하고 focus를 옮긴다.
  import { CAVEAT_KIND, CAVEAT_WHEN, CAVEATS } from '../content/caveats'
  import { copyFor, fmt } from '../content/i18n'
  import { ALWAYS, type CaveatId } from '../engine/caveats'
  import { ui } from '../state/store.svelte'
  import Dialog from './Dialog.svelte'

  const c = $derived(copyFor(ui.lang))
  const ids = $derived(ui.trace.caveats)
  const conditional = $derived(ids.filter((id) => !ALWAYS.includes(id)))
  const always = $derived(ids.filter((id) => ALWAYS.includes(id)))
  const groups = $derived([
    { key: 'conditional', title: c.caveatPanel.conditional, items: conditional },
    { key: 'always', title: c.caveatPanel.always, items: always },
  ])

  function focusItem() {
    const id = ui.caveatFocus
    if (!id) return
    // 창의 내용이 그려진 뒤에 옮긴다
    requestAnimationFrame(() => {
      const el = document.getElementById(`caveat-${id}`)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      el.focus({ preventScroll: true })
    })
  }
</script>

<Dialog
  open={ui.dialog === 'caveats'}
  title={fmt(c.caveatPanel.title, { n: ids.length })}
  variant="side"
  width={460}
  onclose={() => ui.closeDialog()}
  onopen={focusItem}
>
  <p class="lead">{c.caveatPanel.lead}</p>
  <dl class="kinds">
    <div><dt><span class="kind assumption">{c.caveatPanel.kinds.assumption}</span></dt><dd>{c.caveatPanel.kindNotes.assumption}</dd></div>
    <div><dt><span class="kind simplification">{c.caveatPanel.kinds.simplification}</span></dt><dd>{c.caveatPanel.kindNotes.simplification}</dd></div>
  </dl>

  {#each groups as group (group.key)}
    {#if group.items.length}
      <h3>{group.title} <span class="count">{group.items.length}</span></h3>
      <ol>
        {#each group.items as id (id)}
          {@const text = CAVEATS[id as CaveatId][ui.lang]}
          {@const when = CAVEAT_WHEN[id as CaveatId]}
          <li>
            <article id="caveat-{id}" tabindex="-1" class:focused={ui.caveatFocus === id} aria-labelledby="caveat-title-{id}">
              <div class="meta">
                <span class="kind {CAVEAT_KIND[id as CaveatId]}">{c.caveatPanel.kinds[CAVEAT_KIND[id as CaveatId]]}</span>
                {#if when}<span class="when">{fmt(c.caveatPanel.when, { when: when[ui.lang] })}</span>{/if}
              </div>
              <h4 id="caveat-title-{id}">{text.title}</h4>
              <p>{text.body}</p>
            </article>
          </li>
        {/each}
      </ol>
    {/if}
  {/each}
</Dialog>

<style>
  .lead {
    margin: 0 0 10px;
    color: var(--muted);
    font-size: var(--fs-sm);
    line-height: 1.55;
  }

  .kinds {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0 0 14px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--sunken);
  }

  .kinds div {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .kinds dt {
    flex: none;
  }

  .kinds dd {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-xs);
    line-height: 1.45;
  }

  h3 {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 16px 0 8px;
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .count {
    color: var(--muted);
    font-weight: 500;
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  article {
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--red-pen);
    border-radius: var(--radius-sm);
    background: var(--bg);
    scroll-margin: 16px;
  }

  article:focus {
    outline: none;
  }

  article:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* 그림 옆 주의 표시에서 연 항목 */
  article.focused {
    border-color: var(--accent);
    border-left-color: var(--accent);
    background: var(--accent-fill);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .kind {
    display: inline-block;
    padding: 0 8px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 20px;
  }

  /* 가정: 실선 테두리, 단순화: 점선 테두리 (색만으로 구분하지 않게) */
  .kind.assumption {
    border: 1.5px solid var(--red-pen-ink);
    color: var(--red-pen-ink);
  }

  .kind.simplification {
    border: 1.5px dashed var(--muted);
    color: var(--muted);
  }

  .when {
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  h4 {
    margin: 0 0 2px;
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  article p {
    margin: 0;
    color: var(--ink);
    font-size: var(--fs-xs);
    line-height: 1.55;
  }
</style>
