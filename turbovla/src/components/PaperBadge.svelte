<script lang="ts">
  // 논문 근거 배지. 지금 설정이 논문 실험과 맞으면 그 평균 성공률과 출처, 아니면 "논문에 없는 설정".
  // 숫자는 논문에서 그대로 옮긴 값이고(engine/paperNumbers.ts), 이 화면의 가상 값과는 관계없다.
  import { copyFor, fmt } from '../content/i18n'
  import { ui } from '../state/store.svelte'
  import InfoMark from './InfoMark.svelte'

  /**
   * live: 화면 낭독기에 바뀐 숫자를 알릴지 (배지가 두 곳에 있어서 한 곳만 알린다)
   * showExtra: 파라미터 수 같은 덧붙임을 배지 안에 쓸지 (좁은 파라미터 패널에서는 배지 밖에 따로 쓴다)
   */
  let { live = false, showExtra = true }: { live?: boolean; showExtra?: boolean } = $props()

  const c = $derived(copyFor(ui.lang))
  const badge = $derived(ui.paper.badge)
  const libero = $derived(ui.config.profile === 'libero')
  const text = $derived(
    badge
      ? fmt(c.bottom.badgePaper, { value: String(badge.success), source: badge.source })
      : c.bottom.badgeNone,
  )
  /** 파라미터 수 문구. 출처가 배지 출처와 다르면 덧붙인다 (기본 설정: Tab. 1의 성공률, Tab. 9의 파라미터 수) */
  const extraText = $derived(
    badge?.extra
      ? fmt(c.bottom.badgeParams, { params: badge.extra }) + (badge.extraSource && badge.extraSource !== badge.source ? ` (${badge.extraSource})` : '')
      : '',
  )
  const body = $derived(
    badge
      ? [
          c.bottom.experiments[badge.experiment] + '.',
          libero ? c.bottom.averageLibero : c.bottom.averageRobotwin,
          extraText ? extraText + '.' : '',
          c.bottom.notCondition,
        ].filter(Boolean).join(' ')
      : `${c.bottom.noneBody} ${c.bottom.notCondition}`,
  )
</script>

<span class="paper-badge" class:none={!badge}>
  <span class="text" aria-live={live ? 'polite' : undefined}>{text}{#if showExtra && extraText}<span class="extra">, {extraText}</span>{/if}</span>
  <InfoMark label={c.bottom.badgeInfoLabel} title={text} {body} />
</span>

<style>
  .paper-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 4px 1px 12px;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 700;
    max-width: 100%;
    white-space: nowrap;
  }

  .paper-badge.none {
    border-style: dashed;
    border-color: var(--line-strong);
    color: var(--muted);
  }

  .extra {
    font-weight: 500;
  }
</style>
