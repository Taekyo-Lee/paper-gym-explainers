<script lang="ts">
  // 단계 이동 + TurboVLA 구조 한눈에. 단계 탭 자리에 왼쪽에서 오른쪽으로 흐르는 작은 구조도를 그린다.
  //   이미지 ─► DINOv3 ─► V-L Interaction ─────────► Concatenation ─► Action Decoder ─► Action chunk
  //   지시문 ─► BERT   ─►       (두 줄)    ─────────►      ▲
  //   state  ──────────────────────────────► state MLP ─┘
  // state는 V-L Interaction을 거치지 않으므로 state MLP(f_state)를 이어 붙이기 바로 앞에 둔다(논문 Fig. 3(a)처럼, 피드백 (B)).
  // state MLP는 Encoders 단계의 일이라 누르면 Encoders의 state 탭이 열린다.
  // 단계마다 버튼 하나(이름표 + 그 단계의 구조 조각)라서 키보드 탭 순서와 ←/→ 이동은 전과 같다.
  // 지금 보는 단계의 조각이 강조된다. Encoders에서는 고른 하위 탭의 encoder만 강조되고, encoder 조각을 누르면 그 하위 탭이 열린다.
  // 구조 조각의 글자는 화면 낭독기에서 숨긴다(버튼 이름은 "1 Inputs"처럼 단계 이름이다).
  // 입력(Inputs)과 출력(Action chunk) 사이의 네 단계는 TurboVLA 모델 안이라서 큰 상자로 묶고 "TurboVLA"라고 적는다.
  // 목록(ol)의 구조는 그대로 두고, 상자 안 항목(li)마다 위아래 테두리를 그려 이어진 상자 하나로 보이게 한다.
  import { copyFor, fmt } from '../content/i18n'
  import { MODE_TERMS } from '../content/modes'
  import { STAGES, type StageId } from '../content/stages'
  import { ui } from '../state/store.svelte'

  const c = $derived(copyFor(ui.lang))
  const t = $derived(c.stageTabs)
  const cfg = $derived(ui.config)
  /** Encoders 단계에서 지금 열린 하위 탭 */
  const enc = $derived(ui.stage === 'encoders' ? ui.encoderTab : null)
  const none = $derived(cfg.mode === 'none')
  /** interaction 조각의 글: 기호(⇄, ×N) 대신 말로 쓴다. 모드 이름은 파라미터 패널과 같은 짧은 이름 */
  // 블록 이름은 학술 용어로 쓴다: 양방향이면 V-L Cross-Attention, 한 방향이면 그 방향, 섞지 않으면 논문 이름
  const VL_NAME: Record<typeof cfg.mode, string> = {
    bidirectional: 'V-L Cross-Attention',
    v_from_l_only: 'V←L Cross-Attention',
    l_from_v_only: 'L←V Cross-Attention',
    none: 'w/o Interaction',
  }
  const vlMode = $derived(VL_NAME[cfg.mode])
  const vlTitle = $derived(none ? MODE_TERMS[cfg.mode] : fmt(t.vlTitle, { term: MODE_TERMS[cfg.mode], n: cfg.N }))

  /** state MLP 조각: Encoders 단계의 state 탭을 연다 (마우스 보조 기능. 키보드는 Encoders 단계의 하위 탭으로 고른다) */
  function openStateEncoder() {
    ui.encoderTab = 'state'
    ui.goTo('encoders')
    // 이 조각은 화면 낭독기에서 숨긴 보조 단추라서 focus를 Encoders 단계 탭으로 옮긴다
    document.querySelector<HTMLElement>('[data-stage-tab="encoders"]')?.focus({ preventScroll: true })
  }

  /** TurboVLA 모델 상자 안의 단계 */
  const MODEL: StageId[] = ['encoders', 'interaction', 'memory', 'decoder']
  const inModel = (stage: StageId) => MODEL.includes(stage)

  /** 화살표에 다는 텐서 모양. 좁은 칸에 들어가게 좁은 빈칸(U+202F)을 쓴다 */
  const dim = (...n: number[]) => `[${n.join('\u202f×\u202f')}]`
  const tr = $derived(ui.trace)
  const dims = $derived({
    inputs: [dim(cfg.K, cfg.imageSize, cfg.imageSize, 3), fmt(t.tokens, { n: tr.Zl.rows }), dim(1, cfg.stateDim)],
    encoders: [dim(tr.Zv.rows, tr.Zv.cols), dim(tr.Zl.rows, tr.Zl.cols), null],
    interaction: [dim(tr.Zv.rows, tr.Zv.cols), dim(tr.Zl.rows, tr.Zl.cols), dim(tr.state.Zs.rows, tr.state.Zs.cols)],
    memory: [null, dim(tr.memory.rows, tr.memory.cols), null],
    decoder: [null, dim(cfg.H, cfg.actionDim), null],
  })

  function go(stage: StageId, event: MouseEvent) {
    // encoder 조각을 눌렀으면 그 하위 탭을 연다 (마우스 보조 기능. 키보드는 단계 안의 하위 탭으로 고른다)
    if (stage === 'encoders') {
      const lane = (event.target as Element | null)?.closest<HTMLElement>('[data-enc]')?.dataset.enc
      if (lane === 'vision' || lane === 'text' || lane === 'state') ui.encoderTab = lane
    }
    ui.goTo(stage)
  }
</script>

{#snippet arrows(rows: ('vision' | 'language' | 'state' | 'flow' | 'pass' | 'none')[], model: boolean, labels: (string | null)[])}
  <li class="link" class:model aria-hidden="true">
    {#each rows as kind, r (r)}
      {#if kind === 'pass'}<span class="pass state"></span>{:else if kind !== 'none'}<span class="arrow {kind}"
          >{#if labels[r]}<span class="dim">{labels[r]}</span>{/if}→</span
        >{:else}<span></span>{/if}
    {/each}
  </li>
{/snippet}

<nav class="stage-tabs" aria-label={t.label}>
  <ol>
    {#each STAGES as stage, i (stage)}
      <li class:model={inModel(stage)} class:first={stage === MODEL[0]} class:last={stage === MODEL[MODEL.length - 1]}>
        {#if stage === MODEL[0]}
          <!-- 모델 상자의 이름표 (상자 위 테두리에 걸친다). 보조 그림이라 화면 낭독기에서는 숨긴다 -->
          <span class="model-label" aria-hidden="true" title={t.modelTitle}>TurboVLA</span>
        {/if}
        <button
          type="button"
          class="col {stage}"
          data-stage-tab={stage}
          aria-current={ui.stage === stage ? 'step' : undefined}
          onclick={(e) => go(stage, e)}
        >
          <span class="lanes" aria-hidden="true">
            {#if stage === 'inputs'}
              <span class="chip vision">{fmt(t.images, { k: cfg.K })}</span>
              <span class="chip language">{t.instruction}</span>
              <span class="chip state">{t.state}</span>
            {:else if stage === 'encoders'}
              <span class="chip vision" class:on={enc === 'vision'} data-enc="vision" title={t.visionTitle}>DINOv3</span>
              <span class="chip language" class:on={enc === 'text'} data-enc="text" title={t.textTitle}>BERT</span>
              <!-- state 줄은 여기서 encoder를 거치지 않고 지나간다 (state MLP는 이어 붙이기 바로 앞에 있다) -->
              <span class="pass state"></span>
            {:else if stage === 'interaction'}
              <span class="blk vl" class:off={none} title={vlTitle}>
                <span class="blk-name">{vlMode}</span>
                <!-- 안의 층 블록 N개. V-L Interaction 단계에서는 고른 층을 강조한다 -->
                {#if !none}
                  <span class="cells">
                    {#each Array.from({ length: cfg.N }, (_, k) => k + 1) as n (n)}
                      <span class="cell" class:on={ui.stage === 'interaction' && ui.interLayer === n}>{n}</span>
                    {/each}
                  </span>
                {/if}
              </span>
              <span class="pass state"></span>
            {:else if stage === 'memory'}
              <span class="blk mem" title={t.memoryTitle}>
                <span class="seg vision"></span><span class="seg language"></span><span class="seg state"></span>
              </span>
            {:else if stage === 'decoder'}
              <span class="blk dec" title={t.decoderTitle}>
                <span class="blk-name">{fmt(t.queries, { h: cfg.H })}</span>
                <!-- 안의 decoder 층 블록. Action Decoder 단계에서는 고른 층을 강조한다 -->
                <span class="cells">
                  {#each Array.from({ length: cfg.decoderLayers }, (_, k) => k + 1) as n (n)}
                    <span class="cell" class:on={ui.stage === 'decoder' && ui.decLayer === n}>{fmt(t.decLayer, { n })}</span>
                  {/each}
                </span>
              </span>
            {:else}
              <span class="blk out" title={t.outputTitle}><span class="shape">[{cfg.H} × {cfg.actionDim}]</span></span>
            {/if}
          </span>
          <span class="cap">
            <span class="num">{i + 1}</span>
            <span class="name">{c.stages[stage].title}</span>
          </span>
        </button>
      </li>
      {#if stage === 'inputs'}{@render arrows(['vision', 'language', 'state'], false, dims.inputs)}
      {:else if stage === 'encoders'}{@render arrows(['vision', 'language', 'pass'], true, dims.encoders)}
      {:else if stage === 'interaction'}
        <!-- interaction 다음: 이미지와 지시 줄은 이어 붙이기로, state 줄은 state MLP를 거쳐 이어 붙이기로 -->
        <li class="link wide model" aria-hidden="true">
          <span class="pass vision"></span><span class="arrow vision"><span class="dim">{dims.interaction[0]}</span>→</span>
          <span class="pass language"></span><span class="arrow language"><span class="dim">{dims.interaction[1]}</span>→</span>
          <button
            type="button"
            tabindex="-1"
            class="chip state"
            class:on={enc === 'state'}
            data-enc="state"
            title={t.stateTitle}
            onclick={openStateEncoder}>{t.stateEncoder}</button
          ><span class="arrow state"><span class="dim">{dims.interaction[2]}</span>→</span>
        </li>
      {:else if stage === 'memory' || stage === 'decoder'}{@render arrows(['none', 'flow', 'none'], stage === 'memory', dims[stage])}
      {/if}
    {/each}
  </ol>
  <span class="hint">{t.hint}</span>
</nav>

<style>
  .stage-tabs {
    --lane: 17px;
    --lane-gap: 2px;
    grid-area: tabs;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 4px 16px;
    min-width: 0;
    padding: 4px 24px 3px;
  }

  /* 위 여백: 모델 상자의 이름표가 위 테두리에 걸쳐 올라온다 */
  /*
   * 화살표마다 모양을 달아서 구조도가 넓다. 1600 px 화면에는 들어가고, 더 좁으면 구조도만 가로로 스크롤한다.
   * 위 여백은 padding으로 둔다: 모델 상자의 이름표가 스크롤 영역 안에 남아 잘리지 않게
   */
  ol {
    display: flex;
    flex: none;
    align-items: stretch;
    gap: 0;
    min-width: 0;
    max-width: 100%;
    margin: 0;
    padding: 8px 2px 0;
    overflow-x: auto;
    overflow-y: hidden;
    list-style: none;
    scrollbar-width: thin;
  }

  /*
   * 모든 항목이 같은 위아래 여백과 (투명한) 테두리를 가져서 상자 안팎의 줄 높이가 맞는다.
   * 상자 안 항목만 테두리에 색을 칠하고, 처음과 끝 항목이 왼쪽과 오른쪽 테두리를 맡는다.
   */
  li {
    position: relative;
    display: flex;
    flex: none;
    padding: 11px 0 3px;
    border: 1.5px solid transparent;
    border-width: 1.5px 0;
  }

  li.model {
    border-color: var(--line-strong);
  }

  li.model.first {
    padding-left: 8px;
    border-left-width: 1.5px;
    border-radius: 10px 0 0 10px;
  }

  li.model.last {
    padding-right: 8px;
    border-right-width: 1.5px;
    border-radius: 0 10px 10px 0;
  }

  .model-label {
    position: absolute;
    top: -8px;
    left: 10px;
    padding: 0 6px;
    background: var(--bg);
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 14px;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  /* 단계 하나: 위 세 줄은 구조 조각(이미지, 지시, state 줄), 아래는 이름표 */
  .col {
    display: grid;
    grid-template-rows: auto auto;
    justify-items: center;
    gap: 3px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font: inherit;
  }

  .lanes {
    display: grid;
    grid-template-rows: repeat(3, var(--lane));
    row-gap: var(--lane-gap);
    justify-items: stretch;
    width: 100%;
    min-width: 0;
  }

  .chip,
  .blk {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 0;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: var(--fs-xs);
    font-weight: 600;
    line-height: var(--lane);
    white-space: nowrap;
    transition: box-shadow 0.15s var(--ease), border-color 0.15s var(--ease);
  }

  .chip.vision {
    background: var(--vision-fill);
    color: var(--vision-ink);
  }

  .chip.language {
    background: var(--language-fill);
    color: var(--language-ink);
  }

  .chip.state {
    background: var(--state-fill);
    color: var(--state-ink);
  }

  /* V-L Interaction: 이미지 줄과 지시 줄에 걸친 조각, state 줄은 그 아래로 지나간다 */
  /* 두 줄: 모드 이름, 층 수 */
  .blk.vl {
    grid-row: 1 / 3;
    flex-direction: column;
    gap: 2px;
    background: linear-gradient(90deg, var(--vision-fill), var(--language-fill));
    color: var(--ink);
  }

  .blk.vl.off {
    border-style: dashed;
    border-color: var(--line-strong);
    background: var(--card);
    color: var(--muted);
    font-weight: 500;
  }

  .times {
    color: var(--muted);
    font-weight: 500;
  }

  .pass {
    align-self: center;
    height: 0;
    border-top: 1.5px solid var(--state);
  }

  .pass.vision {
    border-top-color: var(--vision);
  }

  .pass.language {
    border-top-color: var(--language);
  }

  /* memory: 세 구간을 세로로 이어 붙인 모양 (Memory 단계의 그림과 같은 순서) */
  .blk.mem {
    grid-row: 1 / 4;
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
    gap: 1px;
    justify-self: stretch;
    margin: 0 8px;
    padding: 3px;
    background: var(--card);
    border-color: var(--line-strong);
  }

  .seg {
    border-radius: 2px;
  }

  .seg.vision {
    flex: 5;
    background: var(--vision);
  }

  .seg.language {
    flex: 2;
    background: var(--language);
  }

  .seg.state {
    flex: 1.4;
    background: var(--state);
  }

  .blk.dec {
    grid-row: 1 / 4;
    flex-direction: column;
    gap: 3px;
    background: var(--accent-fill);
    color: var(--accent-ink);
  }

  /* 블록 안의 층 블록 (V-L Interaction의 층 N개, decoder의 층 3개) */
  .blk-name {
    line-height: 14px;
  }

  .cells {
    display: flex;
    gap: 2px;
  }

  .cell {
    min-width: 13px;
    padding: 0 3px;
    border: 1px solid currentColor;
    border-radius: 3px;
    background: var(--card);
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    line-height: 12px;
    text-align: center;
  }

  .blk.dec .cell {
    color: var(--accent-ink);
    line-height: 14px;
  }

  .cell.on {
    border-color: var(--accent);
    background: var(--accent-solid);
    color: var(--on-accent-solid);
  }

  /* 쉬고 있을 때는 다른 조각과 같은 회색 테두리 (주황 테두리는 지금 단계의 강조와 헷갈린다). 글자만 action 색 */
  .blk.out {
    grid-row: 1 / 4;
    background: var(--card);
    border-color: var(--line-strong);
  }

  .blk.out .shape {
    color: var(--accent-ink);
  }

  /* interaction과 이어 붙이기 사이: state MLP 조각이 state 줄에 있다 (왼쪽 칸), 화살표는 오른쪽 칸 */
  .link.wide {
    grid-template-columns: auto auto;
    width: auto;
    padding-left: 4px;
  }

  .link.wide .chip {
    padding: 0 6px;
    font: inherit;
    font-size: var(--fs-xs);
    font-weight: 600;
    line-height: calc(var(--lane) - 2px);
    cursor: pointer;
  }

  /* Encoders의 state 탭을 보고 있으면 이 조각이 그 단계의 강조를 받는다 (Encoders 열의 고리 밖에 있으므로) */
  .link.wide .chip.on {
    border-color: currentColor;
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .link.wide .chip:hover {
    border-color: currentColor;
  }

  /* 단계 사이의 화살표. 줄마다 그 줄의 모달리티 색 */
  .link {
    display: grid;
    grid-template-rows: repeat(3, var(--lane)) auto;
    align-content: start;
    row-gap: var(--lane-gap);
    min-width: 20px;
    padding-right: 2px;
  }

  /* 화살표 위의 텐서 모양 */
  .dim {
    margin: 0 2px 0 4px;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    white-space: nowrap;
  }

  .arrow {
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: var(--lane);
    text-align: right;
    white-space: nowrap;
  }

  .arrow.vision {
    color: var(--vision-ink);
  }

  .arrow.language {
    color: var(--language-ink);
  }

  .arrow.state {
    color: var(--state-ink);
  }

  /* memory 다음부터는 한 줄로 흐른다: 가운데 줄에 회색 화살표 */
  .arrow.flow {
    color: var(--muted);
  }

  /* 이름표 (전의 단계 탭 모양) */
  .cap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 1px 10px 1px 2px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 500;
    white-space: nowrap;
    transition:
      background 0.15s var(--ease),
      color 0.15s var(--ease),
      border-color 0.15s var(--ease);
  }

  .num {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--sunken);
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .col:hover .cap {
    color: var(--ink);
    border-color: var(--ink);
  }

  .col:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* 지금 보는 단계 */
  .col[aria-current='step'] .cap {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }

  .col[aria-current='step'] .num {
    background: var(--accent-solid);
    color: var(--on-accent-solid);
  }

  /* 지금 단계: 그 단계의 구조 조각 전체를 고리 하나로 둘러싼다 (조각마다 두르면 글자를 지나가고 고리끼리 붙는다) */
  .col[aria-current='step'] .lanes {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 5px;
  }

  /* Encoders: 열린 하위 탭의 encoder는 제 색 테두리를 더 둔다. 마우스를 올린 encoder도 같은 표시 (누르면 그 하위 탭이 열린다) */
  .col.encoders .chip.on,
  .col.encoders .chip:hover {
    border-color: currentColor;
  }

  /* 좁은 화면(확대)에서는 안내가 줄어들고 끝이 말줄임표가 된다 (구조도는 그대로) */
  .hint {
    flex: 0 100 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-left: auto;
    padding-bottom: 3px;
    color: var(--muted);
    font-size: var(--fs-xs);
    white-space: nowrap;
  }
</style>
