<script lang="ts">
  import type { Snippet } from 'svelte'
  import { copyFor } from '../content/i18n'
  import { STAGE_KEY_IDEA, type StageId } from '../content/stages'
  import { ui } from '../state/store.svelte'
  import InfoMark from './InfoMark.svelte'

  let { stage, index, width = 400, children }: { stage: StageId; index: number; width?: number; children: Snippet } = $props()

  const c = $derived(copyFor(ui.lang))
  const active = $derived(ui.stage === stage)
  const keyIdea = $derived(STAGE_KEY_IDEA[stage])
  /** Key Idea 이름만으로 오해하기 쉬운 점의 설명 (있는 것만) */
  const more = $derived.by(() => {
    if (!keyIdea) return null
    const k = c.keyIdeas[keyIdea]
    return 'more' in k ? k.more : null
  })
</script>

<!-- 키보드 focus가 흐려진 패널 안으로 들어오면(Tab) 그 단계로 옮긴다. 흐린 패널의 조작을 보이지 않는 채로 쓰지 않게 한다. -->
<section
  id="stage-{stage}"
  class="stage"
  class:active
  aria-labelledby="stage-title-{stage}"
  style:width="{width}px"
  onfocusin={() => {
    if (!active) ui.goTo(stage)
  }}
>
  <header>
    <span class="num">{index + 1}</span>
    <div class="titles">
      <div class="title-row">
        <h2 id="stage-title-{stage}" tabindex="-1">{c.stages[stage].title}</h2>
        {#if keyIdea}
          <p class="key-idea">
            <span class="chip">{c.keyIdeas[keyIdea].label}</span>
            <span class="name">{c.keyIdeas[keyIdea].name}</span>
            {#if more}<InfoMark label={more.label} title={more.label} body={more.body} />{/if}
          </p>
        {/if}
      </div>
      <p class="lead">
        {c.stages[stage].lead}
        {#if keyIdea}<span class="paper-term">{c.keyIdeas[keyIdea].paperTerm}</span>{/if}
      </p>
    </div>
  </header>

  <div class="body">
    {@render children()}
  </div>

  {#if !active}
    <!-- 흐려진 단계를 누르면 그 단계로 옮긴다. 키보드로는 단계 탭, ←/→, 또는 Tab으로 패널에 들어오면 옮겨진다(section의 onfocusin). -->
    <button
      type="button"
      class="activate"
      tabindex="-1"
      aria-label={c.stages[stage].title}
      onclick={() => ui.goTo(stage)}
    ></button>
  {/if}
</section>

<style>
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: none;
    height: 100%;
    padding: 18px 20px 20px;
    border: 1.5px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--card);
    box-shadow: var(--shadow-card);
    opacity: 0.42;
    transition:
      opacity 0.25s var(--ease),
      border-color 0.25s var(--ease);
  }

  .stage:hover {
    opacity: 0.7;
  }

  .stage.active {
    opacity: 1;
    border: 2px solid var(--accent);
  }

  header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .num {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    margin-top: 2px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .active .num {
    background: var(--accent-solid);
    color: var(--on-accent-solid);
  }

  h2:focus-visible {
    border-radius: 4px;
  }

  h2 {
    margin: 0;
    font-size: var(--fs-xl);
    font-weight: 700;
    line-height: 1.25;
  }

  .lead {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
  }

  .key-idea {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--fs-xs);
  }

  .paper-term {
    margin-left: 4px;
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .chip {
    flex: none;
    padding: 2px 10px;
    border-radius: var(--radius-pill);
    background: var(--accent-solid);
    color: var(--on-accent-solid);
    font-weight: 700;
  }

  .name {
    color: var(--accent-ink);
    font-weight: 700;
    text-wrap: balance;
  }

  /*
   * 스크롤 영역이 focus 테두리(2px + offset 최대 4px)를 자르지 않도록 안쪽 여백을 두고, 같은 만큼 바깥으로 넓힌다
   * (내용의 자리와 크기는 그대로다)
   */
  .body {
    flex: 1;
    min-height: 0;
    margin: -6px;
    padding: 6px;
    overflow: auto;
  }

  .activate {
    position: absolute;
    inset: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
  }
</style>
