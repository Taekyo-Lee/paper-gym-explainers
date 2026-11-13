<script lang="ts">
  import { tick } from 'svelte'
  import BottomBar from './components/BottomBar.svelte'
  import CaveatPanel from './components/CaveatPanel.svelte'
  import Compare2017 from './components/Compare2017.svelte'
  import Dialog from './components/Dialog.svelte'
  import LossToy from './components/LossToy.svelte'
  import Benchmarks from './components/Benchmarks.svelte'
  import Disclaimer from './components/Disclaimer.svelte'
  import EquationPanel from './components/EquationPanel.svelte'
  import GlossaryTip from './components/GlossaryTip.svelte'
  import ParamPanel from './components/ParamPanel.svelte'
  import StageFlow from './components/StageFlow.svelte'
  import StageTabs from './components/StageTabs.svelte'
  import TopBar from './components/TopBar.svelte'
  import { copyFor } from './content/i18n'
  import { ui } from './state/store.svelte'

  const c = $derived(copyFor(ui.lang))

  $effect(() => {
    document.documentElement.lang = ui.lang
  })

  // data-theme은 ui.setTheme / ui.setSystemDark가 바로 바꾼다(canvas가 새 토큰을 읽도록). 이 effect는 안전망이다.
  $effect(() => {
    document.documentElement.dataset.theme = ui.theme
  })

  // 처음 그린 뒤 브라우저가 쉴 때 다른 프리셋의 forward를 미리 계산해 둔다 (첫 프리셋 전환을 빠르게)
  $effect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 600))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const id = idle(() => ui.warmOtherPreset(), { timeout: 3000 })
    return () => cancel(id)
  })

  // 사용자가 테마를 고르지 않았다면 시스템 설정이 바뀔 때 따라간다.
  $effect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => ui.setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  })

  /** ←/→를 스스로 쓰는 요소인가: 입력 칸, 그리고 focus된 가로 스크롤 영역(수식 목록 등) */
  function ownsArrowKeys(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
    // 화살표 키를 스스로 쓰는 요소 (patch 격자 등)
    if (target.closest('[data-arrow-keys]')) return true
    return !target.matches('.flow') && target.scrollWidth > target.clientWidth
  }

  // ←/→ 키로 단계 이동. 입력 칸과 가로 스크롤 영역에서는 원래 동작을 방해하지 않는다.
  async function onkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    // 창(2017 비교, Loss 장난감, 기술적 주의)이 열려 있으면 뒤 화면의 단계를 옮기지 않는다
    if (ui.dialog) return
    if (ownsArrowKeys(event.target)) return
    const from = document.activeElement
    // 수식 카드의 기호 단추처럼 단계가 바뀌면 사라지는 요소에 focus가 있었는지 미리 본다 (사라진 뒤에는 찾을 수 없다)
    const fromEquations = !!from?.closest('.equations')
    if (event.key === 'ArrowRight') ui.step(1)
    else if (event.key === 'ArrowLeft') ui.step(-1)
    else return
    event.preventDefault()
    await tick()
    // focus가 흐려진 이전 단계에 남지 않게 한다: 단계 탭에 있었다면 새 단계 탭으로, 단계 패널 안에 있었다면 새 패널 제목으로.
    if (from?.closest('.stage-tabs')) {
      document.querySelector<HTMLElement>(`[data-stage-tab="${ui.stage}"]`)?.focus()
    } else if (from?.closest('section.stage') && !from.closest(`#stage-${ui.stage}`)) {
      document.getElementById(`stage-title-${ui.stage}`)?.focus({ preventScroll: true })
    } else if (fromEquations && !from?.isConnected) {
      // 새 단계의 첫 기호 단추로 (없으면 수식 패널 제목으로)
      const next = document.querySelector<HTMLElement>('.equations .mark') ?? document.getElementById('equations-title')
      next?.focus({ preventScroll: true })
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="app" class:params-collapsed={!ui.paramsOpen}>
  <TopBar />
  <Disclaimer />
  <StageTabs />
  <StageFlow />
  <ParamPanel />
  <EquationPanel />
  <BottomBar />
</div>

<!-- 하단 바에서 여는 창. 한 번에 하나만 열린다 -->
<Dialog open={ui.dialog === 'compare2017'} title={c.compare.title} width={1200} onclose={() => ui.closeDialog()}>
  <Compare2017 />
</Dialog>
<Dialog open={ui.dialog === 'lossToy'} title={c.loss.title} width={960} onclose={() => ui.closeDialog()}>
  <LossToy />
</Dialog>
<Dialog open={ui.dialog === 'benchmarks'} title={c.bench.title} width={1100} onclose={() => ui.closeDialog()}>
  <Benchmarks />
</Dialog>
<CaveatPanel />
<!-- 기호 풀이 tooltip: 화면 어디서든, 창 안에서도 기호에 마우스를 올리면 뜬다 -->
<GlossaryTip />

<style>
  .app {
    --params-w: 300px;
    display: grid;
    height: 100vh;
    height: 100dvh;
    grid-template-columns: minmax(0, 1fr) var(--params-w);
    grid-template-rows: auto auto auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      'top top'
      'note note'
      'tabs params'
      'flow params'
      'eq params'
      'bottom bottom';
    min-width: 960px;
  }

  .app.params-collapsed {
    --params-w: 48px;
  }
</style>
