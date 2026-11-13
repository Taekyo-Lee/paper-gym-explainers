// 개발용: forward의 모든 모양을 한눈에 본다.
// `npm run shapes`나 개발 서버의 브라우저 콘솔(`turbovla.shapes()`)에서 쓴다.

import { shapeOf } from './tensor'
import type { ForwardTrace } from './types'

export interface ShapeRow {
  name: string
  shape: string
  note: string
}

export function shapeReport(t: ForwardTrace): ShapeRow[] {
  const c = t.config
  const rows: ShapeRow[] = []
  const add = (name: string, shape: string, note = '') => rows.push({ name, shape, note })
  const heads = (n: number, shape: string) => `${n} × (${shape})`

  add('config', `${c.preset} / ${c.basis}`, `K ${c.K}, ${c.imageSize}px, N ${c.N}, heads ${c.interactionHeads}, H ${c.H}, mode ${c.mode}`)
  add('views', t.views.map((v) => v.name).join(', '), `patch ${t.views[0].grid} × ${t.views[0].grid} per view`)
  add('P_v(f_img(I))', shapeOf(t.Zv_parts.content), 'Eq. 4 content')
  add('E_pos', t.Zv_parts.pos ? shapeOf(t.Zv_parts.pos) : 'none', t.Zv_parts.posScale ? `× scale ${t.Zv_parts.posScale.join(', ')}` : '')
  add('e_view', shapeOf(t.Zv_parts.view), '')
  add('Z^v', shapeOf(t.Zv), 'Eq. 4')
  add('Z^l', shapeOf(t.Zl), `Eq. 3, tokens: ${t.tokens.text.map((x) => x.name).join(' ')}`)
  add('s_t', shapeOf(t.state.s), '')
  add('Z^s', shapeOf(t.state.Zs), 'Eq. 5')
  for (const l of t.layers) {
    const h = l.S.length
    add(`layer ${l.index} S`, heads(h, shapeOf(l.S[0])), 'shared score')
    add(`layer ${l.index} A v←l`, heads(h, shapeOf(l.A_v_from_l[0])), l.active.vFromL ? '' : 'off')
    add(`layer ${l.index} A l←v`, heads(h, shapeOf(l.A_l_from_v[0])), l.active.lFromV ? '' : 'off')
    if (l.textLayer) add(`layer ${l.index} text self-attn`, heads(l.textLayer.A.length, shapeOf(l.textLayer.A[0])), 'official code only')
    add(`V^${l.index}, L^${l.index}`, `${shapeOf(l.V_out)}, ${shapeOf(l.L_out)}`, 'Eq. 7')
  }
  add('Z^{vl}', shapeOf(t.Zvl), 'Eq. 8')
  const s = t.memorySegments
  add('memory', shapeOf(t.memory), `visual ${s.visual[1] - s.visual[0]} + text ${s.text[1] - s.text[0]} + state ${s.state[1] - s.state[0]}`)
  add('Q_a', shapeOf(t.Qa), 'Eq. 9')
  for (const d of t.decoder) {
    add(`decoder ${d.index} self-attn`, heads(d.selfAttn.length, shapeOf(d.selfAttn[0])), '')
    add(`decoder ${d.index} cross-attn`, heads(d.crossAttn.length, shapeOf(d.crossAttn[0])), '')
  }
  add('Â_t (decoder output)', shapeOf(t.decoderOutput), 'tanh, made-up weights')
  add('Â_t (script)', shapeOf(t.actions), `target ${t.actionTarget}`)
  add('caveats', String(t.caveats.length), t.caveats.join(', '))
  return rows
}

export function formatShapeReport(t: ForwardTrace): string {
  const rows = shapeReport(t)
  const w0 = Math.max(...rows.map((r) => r.name.length))
  const w1 = Math.max(...rows.map((r) => r.shape.length))
  return rows.map((r) => `${r.name.padEnd(w0)}  ${r.shape.padEnd(w1)}  ${r.note}`).join('\n')
}
