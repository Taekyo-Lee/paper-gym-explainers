// 그림 쪽 하이라이트. 시각 요소에 {@attach hl('Zv')}처럼 붙인다.
// - 마우스를 올리면 store의 hoverTarget을 그 id들로 바꾼다 → 수식 패널에서 같은 id의 기호가 강조된다.
// - 수식 기호에 마우스가 올라가 있고 id가 겹치면 이 요소에 hl-on 클래스를 붙인다 (base.css가 테두리를 그린다).
import type { Attachment } from 'svelte/attachments'
import { ui } from './store.svelte'

export function hl(...ids: string[]): Attachment<HTMLElement> {
  return (node) => {
    node.dataset.hl = ids.join(' ')
    const enter = () => ui.setHover('tensor', ids)
    const leave = () => ui.clearHover('tensor', ids)
    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointerleave', leave)
    $effect(() => {
      const h = ui.hoverTarget
      node.classList.toggle('hl-on', h?.kind === 'symbol' && h.ids.some((id) => ids.includes(id)))
    })
    return () => {
      node.removeEventListener('pointerenter', enter)
      node.removeEventListener('pointerleave', leave)
      node.classList.remove('hl-on')
      leave()
    }
  }
}
