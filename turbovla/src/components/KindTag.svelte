<script lang="ts">
  // 기호의 종류 이름표: 입력 데이터, 모델, embedding 벡터, parameter, 중간 값, 출력, 정답, 크기, 첨자, 연산과 표기.
  import { KIND_LABEL, type GlossKind } from '../content/glossary'
  import { ui } from '../state/store.svelte'

  let { kind }: { kind: GlossKind } = $props()
</script>

<span class="kind {kind}">{KIND_LABEL[kind][ui.lang]}</span>

<style>
  .kind {
    display: inline-block;
    flex: none;
    padding: 0 7px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--card);
    color: var(--ink);
    font-size: var(--fs-xs);
    font-weight: 600;
    line-height: 18px;
    white-space: nowrap;
  }

  /* 학습하는 것(모델, embedding, parameter)은 진한 테두리, 값(데이터, 중간 값, 출력, 정답)은 보통 테두리, 크기와 첨자와 연산은 점선 */
  .kind.model,
  .kind.embedding,
  .kind.param {
    border-color: var(--ink);
  }

  .kind.size,
  .kind.index,
  .kind.op {
    border-style: dashed;
    color: var(--muted);
  }
</style>
