<script lang="ts">
  // V-L Interaction의 구조를 블록으로 그린다 (말이 아니라 블록 그림으로).
  //   왼쪽: 층 쌓기 (Eq. 6). Z^v, Z^l이 층 N개를 차례로 지나 V^N, L^N이 된다. 고른 층이 강조되고, 누르면 그 층을 고른다.
  //   오른쪽: 고른 층 안 (Fig. 3(b), Eq. 7). stream마다 LN → cross-attention(Q는 자기 쪽, K·V는 상대 쪽) → (+) residual.
  //   공식 코드 기준이면 γ⊙와 지시 쪽 텍스트 블록이 더 있고, LIBERO는 residual이 LN 뒤에서 갈라진다.
  // 블록을 누르면 아래 하위 탭이 그 부분을 보여 준다(마우스 보조. 키보드는 층 고르기와 하위 탭으로 같은 것을 고른다).
  import { copyFor, fmt } from '../../../content/i18n'
  import { ui } from '../../../state/store.svelte'

  const c = $derived(copyFor(ui.lang))
  const cfg = $derived(ui.config)
  const N = $derived(cfg.N)
  const l = $derived(ui.interLayer)
  const code = $derived(cfg.basis === 'code')
  const normalized = $derived(code && cfg.profile === 'libero')
  const vOn = $derived(cfg.mode !== 'l_from_v_only')
  const lOn = $derived(cfg.mode !== 'v_from_l_only')
  const tab = $derived(ui.interTab)

  // 왼쪽 층 쌓기의 자리
  const STACK_X = 62
  const STACK_W = 200
  const cellW = $derived((STACK_W - (N - 1) * 4) / N)
  const cellX = (n: number) => STACK_X + (n - 1) * (cellW + 4)

  // 오른쪽 한 층 안의 자리
  const VY = 54
  const LY = 96
  const RES_FROM = $derived(normalized ? 492 : 440)

  let root: SVGSVGElement | undefined = $state()
  $effect(() => {
    if (!root) return
    const el = root
    const onclick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const layer = target?.closest('[data-layer]')?.getAttribute('data-layer')
      if (layer) ui.interLayerPick = Number(layer)
      const t = target?.closest('[data-tab]')?.getAttribute('data-tab')
      if (t === 'attention' || t === 'residual' || t === 'text') ui.interTab = t
    }
    el.addEventListener('click', onclick)
    return () => el.removeEventListener('click', onclick)
  })
</script>

{#snippet sym(x: number, y: number, base: string, sup: string, cls = '')}
  <text {x} {y} class="sym {cls}" text-anchor="middle" dominant-baseline="central">{base}<tspan class="sup" dy="-6">{sup}</tspan></text>
{/snippet}

<figure class="diagram">
  <svg bind:this={root} viewBox="0 0 940 128" role="img" aria-label={fmt(c.interaction.diagLabel, { n: N })}>
    <defs>
      <marker id="arrow-ld" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L8 4 L0 8 z" class="head" />
      </marker>
    </defs>

    <!-- 머리 -->
    <text x="0" y="12" class="title">{fmt(c.interaction.diagStack, { n: N })}</text>
    <text x="360" y="12" class="title">{fmt(c.interaction.diagInside, { l })}</text>
    <text x="940" y="12" class="hint" text-anchor="end">{c.interaction.diagHint}</text>

    <!-- ===== 왼쪽: 층 쌓기 ===== -->
    <line x1="44" y1="52" x2="282" y2="52" class="wire" marker-end="url(#arrow-ld)" />
    <line x1="44" y1="94" x2="282" y2="94" class="wire" marker-end="url(#arrow-ld)" />
    <g class="gl gl-Zv"><rect x="0" y="41" width="44" height="22" rx="4" class="v" />{@render sym(22, 52, 'Z', 'v')}</g>
    <g class="gl gl-Zl"><rect x="0" y="83" width="44" height="22" rx="4" class="l" />{@render sym(22, 94, 'Z', 'l')}</g>
    {#each Array.from({ length: N }, (_, k) => k + 1) as n (n)}
      <g class="layer" class:on={n === l} data-layer={n}>
        <title>{fmt(c.interaction.diagPick, { n })}</title>
        <rect x={cellX(n)} y="28" width={cellW} height="90" rx="5" />
        <text x={cellX(n) + cellW / 2} y="73" text-anchor="middle" dominant-baseline="central" class="num">{n}</text>
      </g>
    {/each}
    <g class="gl gl-VN"><rect x="284" y="41" width="44" height="22" rx="4" class="v" />{@render sym(306, 52, 'V', String(N))}</g>
    <g class="gl gl-LNout"><rect x="284" y="83" width="44" height="22" rx="4" class="l" />{@render sym(306, 94, 'L', String(N))}</g>

    <!-- 고른 층에서 오른쪽 확대 그림으로 -->
    <line x1={cellX(l) + cellW} y1="28" x2="360" y2="24" class="zoom" />
    <line x1={cellX(l) + cellW} y1="118" x2="360" y2="124" class="zoom" />

    <!-- ===== 오른쪽: 고른 층 안 ===== -->
    <rect x="360" y="22" width="580" height="104" rx="8" class="frame" />

    <!-- residual: 원래 값을 (+)로 그대로 보낸다 -->
    <g data-tab="residual" class="part" class:sel={tab === 'residual'}>
      <path d="M{RES_FROM} {VY} V35 H700 V{VY - 10}" class="res" marker-end="url(#arrow-ld)" />
      <path d="M{RES_FROM} {LY} V115 H700 V{LY + 10}" class="res" marker-end="url(#arrow-ld)" />
      <text x="680" y="32" class="res-label" text-anchor="end">residual</text>
      <text x="680" y="124" class="res-label" text-anchor="end">residual</text>
    </g>

    <!-- 줄: 입력 → LN → attention → (+) → 출력 -->
    <line x1="432" y1={VY} x2="450" y2={VY} class="wire" marker-end="url(#arrow-ld)" />
    <line x1="432" y1={LY} x2="450" y2={LY} class="wire" marker-end="url(#arrow-ld)" />
    <line x1="484" y1={VY} x2="510" y2={VY} class="wire" class:dim={!vOn} marker-end="url(#arrow-ld)" />
    <line x1="484" y1={LY} x2="510" y2={LY} class="wire" class:dim={!lOn} marker-end="url(#arrow-ld)" />
    <!-- K·V: 상대 쪽 stream에서 온다 (두 방향이 엇갈린다) -->
    <line x1="492" y1={VY + 4} x2="514" y2={LY - 16} class="wire kv" class:dim={!lOn} marker-end="url(#arrow-ld)" />
    <line x1="492" y1={LY - 4} x2="514" y2={VY + 16} class="wire kv" class:dim={!vOn} marker-end="url(#arrow-ld)" />
    <line x1="652" y1={VY} x2="688" y2={VY} class="wire" class:dim={!vOn} marker-end="url(#arrow-ld)" />
    <line x1="652" y1={LY} x2="688" y2={LY} class="wire" class:dim={!lOn} marker-end="url(#arrow-ld)" />
    <line x1="710" y1={VY} x2="838" y2={VY} class="wire" marker-end="url(#arrow-ld)" />
    {#if code}
      <line x1="710" y1={LY} x2="722" y2={LY} class="wire" marker-end="url(#arrow-ld)" />
      <line x1="814" y1={LY} x2="838" y2={LY} class="wire" marker-end="url(#arrow-ld)" />
    {:else}
      <line x1="710" y1={LY} x2="838" y2={LY} class="wire" marker-end="url(#arrow-ld)" />
    {/if}

    <!-- 입력 -->
    <g class="gl gl-Vprev"><rect x="372" y={VY - 11} width="60" height="22" rx="4" class="v" />{@render sym(402, VY, 'V', String(l - 1))}</g>
    <g class="gl gl-Lprev"><rect x="372" y={LY - 11} width="60" height="22" rx="4" class="l" />{@render sym(402, LY, 'L', String(l - 1))}</g>
    <!-- stream마다 LayerNorm (Fig. 3(b)) -->
    <g class="gl gl-LNop"><rect x="452" y={VY - 11} width="32" height="22" rx="4" class="op" /><text x="468" y={VY} class="op-text" text-anchor="middle" dominant-baseline="central">LN</text></g>
    <g class="gl gl-LNop"><rect x="452" y={LY - 11} width="32" height="22" rx="4" class="op" /><text x="468" y={LY} class="op-text" text-anchor="middle" dominant-baseline="central">LN</text></g>
    <!-- 두 방향 cross-attention -->
    <g data-tab="attention" class="part gl gl-AttnVL" class:sel={tab === 'attention'} class:dim={!vOn}>
      <rect x="512" y={VY - 15} width="140" height="30" rx="5" class="attn v" />
      <text x="582" y={VY - 4} class="attn-name" text-anchor="middle">Attn v←l</text>
      <text x="582" y={VY + 9} class="attn-sub" text-anchor="middle">{vOn ? c.interaction.attnVLsub : c.interaction.diagOff}</text>
    </g>
    <g data-tab="attention" class="part gl gl-AttnLV" class:sel={tab === 'attention'} class:dim={!lOn}>
      <rect x="512" y={LY - 15} width="140" height="30" rx="5" class="attn l" />
      <text x="582" y={LY - 4} class="attn-name" text-anchor="middle">Attn l←v</text>
      <text x="582" y={LY + 9} class="attn-sub" text-anchor="middle">{lOn ? c.interaction.attnLVsub : c.interaction.diagOff}</text>
    </g>
    <!-- 공식 코드: γ ⊙ (layer scale) -->
    {#if code}
      <g class="gl gl-gamma"><rect x="660" y={VY - 9} width="22" height="18" rx="3" class="op" /><text x="671" y={VY} class="op-text" text-anchor="middle" dominant-baseline="central">γ⊙</text></g>
      <g class="gl gl-gamma"><rect x="660" y={LY - 9} width="22" height="18" rx="3" class="op" /><text x="671" y={LY} class="op-text" text-anchor="middle" dominant-baseline="central">γ⊙</text></g>
    {/if}
    <!-- (+) residual 덧셈 -->
    <g data-tab="residual" class="part plus" class:sel={tab === 'residual'}>
      <circle cx="700" cy={VY} r="10" /><text x="700" y={VY} text-anchor="middle" dominant-baseline="central">+</text>
      <circle cx="700" cy={LY} r="10" /><text x="700" y={LY} text-anchor="middle" dominant-baseline="central">+</text>
    </g>
    <!-- 공식 코드에만 있는 지시 쪽 텍스트 블록 (self-attention + FFN) -->
    <g data-tab="text" class="part gl gl-TextBlock" class:sel={tab === 'text'} class:ghost={!code}>
      <rect x="724" y={LY - 11} width="90" height="22" rx="4" class="op" />
      <text x="769" y={LY} class="op-text" text-anchor="middle" dominant-baseline="central">{c.interaction.tabText}</text>
      <text x="769" y={LY - 16} class="code-tag" text-anchor="middle">{c.basis.code}</text>
    </g>
    <!-- 출력 -->
    <g class="gl gl-Vnext"><rect x="840" y={VY - 11} width="60" height="22" rx="4" class="v" />{@render sym(870, VY, 'V', String(l))}</g>
    <g class="gl gl-Lnext"><rect x="840" y={LY - 11} width="60" height="22" rx="4" class="l" />{@render sym(870, LY, 'L', String(l))}</g>
  </svg>
</figure>

<style>
  .diagram {
    margin: 0;
  }

  svg {
    display: block;
    width: 100%;
    max-width: 940px;
    height: auto;
    overflow: visible;
  }

  .title {
    fill: var(--ink);
    font-size: 12px;
    font-weight: 700;
  }

  .hint {
    fill: var(--muted);
    font-size: 11px;
  }

  .wire {
    stroke: var(--muted);
    stroke-width: 1.4;
    fill: none;
  }

  .wire.kv {
    stroke-dasharray: 3 2;
  }

  .dim {
    opacity: 0.3;
  }

  .head {
    fill: var(--muted);
  }

  rect.v {
    fill: var(--vision-fill);
    stroke: var(--vision);
  }

  rect.l {
    fill: var(--language-fill);
    stroke: var(--language);
  }

  .sym {
    fill: var(--ink);
    font-family: 'KaTeX_Math', 'Times New Roman', serif;
    font-size: 15px;
    font-style: italic;
  }

  .sup {
    font-size: 10px;
    font-style: normal;
  }

  .layer {
    cursor: pointer;
  }

  .layer rect {
    fill: var(--card);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }

  .layer .num {
    fill: var(--muted);
    font-size: 12px;
    font-weight: 700;
  }

  .layer.on rect {
    fill: var(--accent-fill);
    stroke: var(--accent);
    stroke-width: 2;
  }

  .layer.on .num {
    fill: var(--accent-ink);
  }

  .layer:hover rect {
    stroke: var(--ink);
  }

  .zoom {
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .frame {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
  }

  rect.op {
    fill: var(--card);
    stroke: var(--line-strong);
  }

  .op-text {
    fill: var(--ink);
    font-size: 11px;
    font-weight: 600;
  }

  rect.attn {
    stroke-width: 1.4;
  }

  .attn-name {
    fill: var(--ink);
    font-size: 12px;
    font-weight: 700;
  }

  .attn-sub {
    fill: var(--muted);
    font-size: 10px;
  }

  .res {
    stroke: var(--muted);
    stroke-width: 1.4;
    fill: none;
  }

  .res-label {
    fill: var(--muted);
    font-size: 10px;
    font-style: italic;
  }

  .plus circle {
    fill: var(--card);
    stroke: var(--ink);
    stroke-width: 1.4;
  }

  .plus text {
    fill: var(--ink);
    font-size: 15px;
    font-weight: 700;
  }

  .code-tag {
    fill: var(--red-pen-ink);
    font-size: 9px;
    font-weight: 700;
  }

  .ghost {
    opacity: 0.35;
  }

  .ghost rect {
    stroke-dasharray: 3 2;
  }

  /* 누를 수 있는 부분과 지금 아래 탭이 보여 주는 부분 */
  .part {
    cursor: pointer;
  }

  .part:hover rect,
  .part:hover circle,
  .part:hover .res {
    stroke: var(--ink);
  }

  .part.sel rect,
  .part.sel circle,
  .part.sel .res {
    stroke: var(--accent);
    stroke-width: 2.4;
  }

  .part.sel .res-label {
    fill: var(--accent-ink);
    font-weight: 700;
  }
</style>
