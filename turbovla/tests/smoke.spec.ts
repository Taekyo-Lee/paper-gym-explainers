// 스크린샷 smoke test. 1440 × 900에서 두 언어 × 두 테마로 여섯 단계를 모두 열어 보고,
// 몇 가지 인수 조건을 실제 화면에서 한 번 더 확인한다. 스크린샷은 test-results/ 아래에 남는다.
//   - 단계마다: 패널이 보이고, 그려진 canvas가 비어 있지 않고, 콘솔 오류가 없다
//   - 영어 화면에 한글이 남지 않는다 (글자와 aria-label, title, alt, placeholder)
//   - 테마가 html[data-theme]에 걸리고 새로고침해도 남는다
//   - LIBERO 논문 기준 모양, 공식 코드 기준으로 바꾸면 memory [535 × 256]
//   - 층 수를 4로 바꾸면 논문 배지 96.9% (Tab. 9)
//   - 2017 비교에서 decoder를 한 번 돌렸을 때 autoregressive 1개, parallel 12개
import { expect, test, type Page } from '@playwright/test'

const STAGES = ['inputs', 'encoders', 'interaction', 'memory', 'decoder', 'output'] as const
const LANG_KEY = 'paper-gym.turbovla.lang'
const THEME_KEY = 'paper-gym.turbovla.theme'

/** 언어와 테마를 정해 두고 연다. 콘솔 오류와 페이지 오류를 모은다 */
async function open(page: Page, lang: 'ko' | 'en', theme: 'light' | 'dark'): Promise<string[]> {
  await page.addInitScript(
    ([l, t, lk, tk]) => {
      // 처음 한 번만 정한다 (새로고침 확인에서 사용자가 바꾼 값을 덮지 않게)
      if (!sessionStorage.getItem('smoke-init')) {
        localStorage.setItem(lk, l)
        localStorage.setItem(tk, t)
        sessionStorage.setItem('smoke-init', '1')
      }
    },
    [lang, theme, LANG_KEY, THEME_KEY],
  )
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('lang', lang)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  return errors
}

/** 보이는 canvas 중 칠한 픽셀이 하나도 없는 것의 수 */
function blankCanvases(page: Page): Promise<number> {
  return page.evaluate(() => {
    let blank = 0
    for (const c of document.querySelectorAll('canvas')) {
      if (!c.width || !c.height || !c.getClientRects().length) continue
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let painted = false
      for (let i = 3; i < data.length; i += 4) {
        if (data[i]) {
          painted = true
          break
        }
      }
      if (!painted) blank++
    }
    return blank
  })
}

/** 한글이 든 글자와 접근성 속성 */
function hangulLeft(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const re = /[가-힣]/
    const hits: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? ''
      if (re.test(text)) hits.push(text.trim().slice(0, 60))
    }
    for (const el of document.querySelectorAll('[aria-label], [title], [alt], [placeholder]')) {
      for (const a of ['aria-label', 'title', 'alt', 'placeholder']) {
        const v = el.getAttribute(a)
        if (v && re.test(v)) hits.push(`${a}: ${v.slice(0, 60)}`)
      }
    }
    return hits
  })
}

for (const lang of ['ko', 'en'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`여섯 단계 (${lang}, ${theme})`, async ({ page }, info) => {
      const errors = await open(page, lang, theme)
      for (const stage of STAGES) {
        const tab = page.locator(`[data-stage-tab="${stage}"]`)
        const panel = page.locator(`#stage-${stage}`)
        // 이름표를 누른다: 구조 조각(예: encoder)을 누르면 그 하위 탭이 바뀌므로, 단계마다 처음 하위 탭을 보려고
        await tab.locator('.cap').click()
        if (stage === 'encoders') await expect(page.locator('#enc-tab-vision')).toHaveAttribute('aria-selected', 'true')
        // 정말 그 단계로 옮겼는가: 탭이 현재 단계이고, 패널이 강조되고, 화면 안에 들어와 있다 (reducedMotion이라 스크롤은 바로 끝난다)
        await expect(tab).toHaveAttribute('aria-current', 'step')
        await expect(panel).toHaveClass(/(^|\s)active(\s|$)/)
        await expect(panel).toBeInViewport({ ratio: 0.95 })
        await page.screenshot({ path: info.outputPath(`${lang}-${theme}-${stage}.png`) })
        expect(await blankCanvases(page), `${stage}: 빈 canvas`).toBe(0)
      }
      if (lang === 'en') expect(await hangulLeft(page)).toEqual([])
      expect(errors).toEqual([])
    })
  }
}

test('테마를 바꾸면 html[data-theme]이 바뀌고 새로고침해도 남는다', async ({ page }) => {
  await open(page, 'ko', 'light')
  await page.locator('[role=group][aria-label="화면 테마"] button').nth(1).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('텐서 모양과 기준 전환 (LIBERO)', async ({ page }) => {
  const errors = await open(page, 'ko', 'light')
  await page.locator('[data-stage-tab="memory"]').click()
  // 패널 전체가 아니라 memory 모양 이름표를 본다 (논문 기준 설명 문장에도 [535 × 256]이 나오므로)
  const shape = page.locator('#stage-memory .memory > header .shape')
  const codeBtn = page.getByRole('button', { name: '공식 코드', exact: true })
  const paperBtn = page.getByRole('button', { name: '논문', exact: true })
  await expect(shape).toHaveText('[520 × 256]')
  await codeBtn.click()
  await expect(codeBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(shape).toHaveText('[535 × 256]')
  await paperBtn.click()
  await expect(paperBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(shape).toHaveText('[520 × 256]')
  expect(errors).toEqual([])
})

test('층 수를 4로 바꾸면 논문 배지가 Tab. 9의 숫자가 된다', async ({ page }) => {
  await open(page, 'ko', 'light')
  const badge = page.locator('.bottom .paper-badge')
  // 기본 배지에도 파라미터 수의 출처(Tab. 9)가 있으므로, 성공률과 출처를 함께 본다
  await expect(badge).toContainText('97.6% (Tab. 1)')
  await page.locator('.params [role=group][aria-label="층 수"] button', { hasText: '4' }).click()
  await expect(badge).toContainText('96.9% (Tab. 9)')
  await expect(badge).not.toContainText('(Tab. 1)')
  await page.locator('.params .reset').click()
  await expect(badge).toContainText('97.6% (Tab. 1)')
})

test('창: 2017 비교(한 번 실행), Loss 장난감, 기술적 주의', async ({ page }, info) => {
  const errors = await open(page, 'ko', 'light')
  await page.locator('.bottom button', { hasText: '2017' }).click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  // decoder를 한 번 돌린 상태로 맞춘다 (reducedMotion이라 자동 재생은 꺼져 있다)
  await dialog.locator('input[type=range]').fill('1')
  await expect(dialog.locator('input[type=range]')).toHaveValue('1')
  const counts = dialog.locator('.count')
  await expect(counts.nth(0)).toHaveText('나온 step 1 / 12, decoder 1번 실행 (모두 내려면 12번)')
  await expect(counts.nth(1)).toHaveText('나온 step 12 / 12, decoder 1번 실행 (모두 내려면 1번)')
  await page.screenshot({ path: info.outputPath('dialog-compare.png') })
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.locator('.bottom button', { hasText: 'L1' }).click()
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.screenshot({ path: info.outputPath('dialog-loss.png') })
  await page.keyboard.press('Escape')

  await page.locator('.bottom .caveats').click()
  await expect(page.locator('dialog[open] article').first()).toBeVisible()
  await page.screenshot({ path: info.outputPath('dialog-caveats.png') })
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('구조도: 지금 단계를 강조하고, encoder 조각을 누르면 그 하위 탭이 열린다', async ({ page }) => {
  const errors = await open(page, 'ko', 'light')
  const strip = page.locator('.stage-tabs')
  await expect(strip.locator('[aria-current="step"]')).toHaveAttribute('data-stage-tab', 'inputs')
  // BERT 조각을 누르면 Encoders 단계의 지시문 탭이 열리고, 구조도에서도 BERT만 강조된다
  await strip.locator('[data-enc="text"]').click()
  await expect(strip.locator('[data-stage-tab="encoders"]')).toHaveAttribute('aria-current', 'step')
  await expect(page.locator('#enc-tab-text')).toHaveAttribute('aria-selected', 'true')
  await expect(strip.locator('[data-enc].on')).toHaveAttribute('data-enc', 'text')
  // state MLP는 Encoders 열이 아니라 Concatenation 바로 앞에 있다 (state는 V-L Interaction을 거치지 않는다).
  // 누르면 Encoders 단계의 state 탭이 열린다
  await expect(strip.locator('[data-stage-tab="encoders"] [data-enc="state"]')).toHaveCount(0)
  await expect(strip.locator('[data-stage-tab="memory"] .name')).toHaveText('Concatenation')
  // 입력과 출력 사이의 네 단계는 TurboVLA 모델 상자 안에 있다
  await expect(strip.locator('.model-label')).toHaveText('TurboVLA')
  const boxed = await strip.locator('li:has(> [data-stage-tab])').evaluateAll((items) =>
    items.map((li) => [li.querySelector('[data-stage-tab]')!.getAttribute('data-stage-tab'), li.classList.contains('model')]),
  )
  expect(boxed).toEqual([
    ['inputs', false],
    ['encoders', true],
    ['interaction', true],
    ['memory', true],
    ['decoder', true],
    ['output', false],
  ])
  await strip.locator('[data-enc="state"]').click()
  await expect(page.locator('#enc-tab-state')).toHaveAttribute('aria-selected', 'true')
  await expect(strip.locator('[data-enc].on')).toHaveAttribute('data-enc', 'state')
  // 단계 안의 하위 탭을 바꾸면 구조도의 강조도 따라간다
  await page.locator('#enc-tab-text').click()
  await expect(strip.locator('[data-enc].on')).toHaveAttribute('data-enc', 'text')
  // 구조도의 숫자는 지금 설정을 따른다: 프리셋을 바꾸면 카메라 수, 층, query 수, Action chunk 모양이 바뀐다
  await expect(strip.locator('[data-stage-tab="output"] .shape')).toHaveText('[12 × 7]')
  await expect(strip.locator('[data-stage-tab="decoder"] .dec .blk-name')).toHaveText('query 12개')
  await expect(strip.locator('[data-stage-tab="interaction"] .vl')).toContainText('V-L Cross-Attention')
  await page.locator('header select').selectOption('RoboTwin')
  await expect(strip.locator('[data-stage-tab="inputs"] .chip.vision')).toHaveText('이미지 3장')
  await expect(strip.locator('[data-stage-tab="output"] .shape')).toHaveText('[50 × 14]')
  await expect(strip.locator('[data-stage-tab="decoder"] .dec .blk-name')).toHaveText('query 50개')
  // 모드를 바꾸면 interaction 조각의 글도 바뀐다
  await page.locator('.params select').selectOption('none')
  await expect(strip.locator('[data-stage-tab="interaction"] .vl')).toHaveText('w/o Interaction')
  expect(errors).toEqual([])
})

test('프리셋 설명 카드와 카메라 설명: 프리셋을 따라 바뀐다', async ({ page }) => {
  const errors = await open(page, 'ko', 'light')
  await expect(page.locator('#stage-inputs .cams .note')).toHaveText('카메라 2대(primary와 wrist)가 같은 탁상을 봅니다.')
  const info = page.locator('.topbar .preset button')
  await info.click()
  const card = page.locator('.topbar .preset [role=note]')
  await expect(card).toContainText('LIBERO 설정')
  await expect(card).toContainText('2대 (primary와 wrist)')
  await expect(card).toContainText('카메라마다 256개, 모두 512개')
  await expect(card).toContainText('평균 성공률 97.6% (Tab. 1)')
  await page.keyboard.press('Escape')
  await page.locator('header select').selectOption('RoboTwin')
  await expect(page.locator('#stage-inputs .cams .note')).toHaveText('카메라 3대(head, left wrist와 right wrist)가 같은 탁상을 봅니다.')
  await info.click()
  await expect(card).toContainText('RoboTwin 2.0 설정')
  await expect(card).toContainText('카메라마다 196개, 모두 588개')
  await expect(card).toContainText('평균 성공률 88.06% (Tab. 2)')
  expect(errors).toEqual([])
})

test('기호 풀이: 기호에 마우스를 올리면 뜻이 뜨고, 카드의 기호 단추는 표를 연다', async ({ page }, info) => {
  const errors = await open(page, 'ko', 'light')
  await page.locator('[data-stage-tab="encoders"] .cap').click()
  // 단계 패널의 Eq. 4 분해: 항마다 종류 이름표가 화면에 보인다
  const breakdown = page.locator('#stage-encoders .eq4')
  await expect(breakdown.locator('.kind').first()).toBeVisible()
  await expect(breakdown).toContainText('embedding 벡터')
  await expect(breakdown).toContainText('이미지 encoder (DINOv3)')
  // 수식 패널의 f_img에 마우스를 올리면 종류와 이름이 뜬다
  const fimg = page.locator('.equations [data-eq="eq4"] .gl-fimg').first()
  const box = (await fimg.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const tip = page.locator('.tip')
  await expect(tip).toBeVisible()
  await expect(tip).toContainText('모델 (함수)')
  await expect(tip).toContainText('이미지 encoder (DINOv3)')
  await page.mouse.move(5, 5)
  await expect(tip).toHaveCount(0)
  // 카드의 기호 단추: 그 식의 기호를 모두 표로 보인다
  await page.locator('.equations [data-eq="eq4"] .mark').click()
  const table = page.locator('.equations [data-eq="eq4"] [role=note] [role=listitem]')
  await expect(table.first()).toBeVisible()
  expect(await table.count()).toBeGreaterThanOrEqual(9)
  await page.screenshot({ path: info.outputPath('glossary.png') })
  expect(errors).toEqual([])
})

test('벤치마크 설명 창: LIBERO와 RoboTwin 2.0을 나란히 보인다', async ({ page }, info) => {
  const errors = await open(page, 'ko', 'light')
  await page.getByRole('button', { name: '벤치마크 설명' }).click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toContainText('LIBERO')
  await expect(dialog).toContainText('RoboTwin 2.0')
  await expect(dialog).toContainText('97.6%')
  await expect(dialog).toContainText('88.06%')
  await page.screenshot({ path: info.outputPath('dialog-benchmarks.png') })
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(errors).toEqual([])
})
