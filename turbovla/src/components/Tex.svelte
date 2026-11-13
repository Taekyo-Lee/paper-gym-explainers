<script lang="ts">
  import katex from 'katex'

  let { tex, display = true }: { tex: string; display?: boolean } = $props()

  // \htmlId, \htmlClass는 기호 ↔ 시각 요소 하이라이트와 기호 풀이에 쓴다.
  const html = $derived(
    katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      trust: (ctx) => ctx.command === '\\htmlId' || ctx.command === '\\htmlClass',
      strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'warn'),
    }),
  )
</script>

<span class="tex" class:display>{@html html}</span>

<style>
  .tex.display :global(.katex-display) {
    margin: 0;
  }
</style>
