import { mount } from 'svelte'
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/noto-sans-kr/500.css'
import '@fontsource/noto-sans-kr/700.css'
import 'katex/dist/katex.min.css'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

// 개발용: 개발 서버에서 브라우저 콘솔로 forward의 모양을 본다. 예: turbovla.shapes()
if (import.meta.env.DEV) {
  void Promise.all([import('./engine/debug'), import('./engine/forward'), import('./engine/presets'), import('./state/store.svelte')]).then(
    ([debug, engine, presets, store]) => {
      Object.assign(window, {
        turbovla: {
          ui: store.ui,
          forward: engine.forward,
          presetConfig: presets.presetConfig,
          defaultState: presets.defaultState,
          shapes: () => console.table(debug.shapeReport(store.ui.trace)),
        },
      })
    },
  )
}

export default app
