// interaction 모드. 고르기 칸의 순서와 논문이 쓰는 이름은 두 언어에서 같다.
import type { InteractionMode } from '../engine/types'

export const MODES: InteractionMode[] = ['bidirectional', 'v_from_l_only', 'l_from_v_only', 'none']

/** 논문이 쓰는 모드 이름 (Tab. 5, Tab. 10, Fig. 5) */
export const MODE_TERMS: Record<InteractionMode, string> = {
  bidirectional: 'Bidirectional Interaction',
  v_from_l_only: 'Visual Queries Language',
  l_from_v_only: 'Language Queries Visual',
  none: 'w/o Interaction',
}
