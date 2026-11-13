// 프리셋 이름(Custom)은 어느 조작으로 값을 바꾸든 같은 규칙(withChanges)을 따른다.
import { describe, expect, it } from 'vitest'
import { ui } from './store.svelte'

describe('프리셋 이름', () => {
  it('Interaction 단계의 모드 고르기도 파라미터 패널과 같이 Custom을 만들고, 되돌리면 프리셋으로 돌아온다', () => {
    ui.setPreset('LIBERO')
    ui.setMode('none')
    expect(ui.config.preset).toBe('Custom')
    expect(ui.paper.badge).toMatchObject({ success: 96.3, source: 'Tab. 5' })
    ui.setMode('bidirectional')
    expect(ui.config.preset).toBe('LIBERO')

    ui.setParams({ mode: 'none' })
    ui.setMode('bidirectional')
    expect(ui.config.preset).toBe('LIBERO')
  })

  it('RoboTwin에서도 같다', () => {
    ui.setPreset('RoboTwin')
    ui.setMode('l_from_v_only')
    expect(ui.config.preset).toBe('Custom')
    expect(ui.paper.badge).toMatchObject({ success: 86.62, source: 'Tab. 10' })
    ui.resetParams()
    expect(ui.config.preset).toBe('RoboTwin')
    expect(ui.config.mode).toBe('bidirectional')
  })
})
