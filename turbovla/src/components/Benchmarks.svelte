<script lang="ts">
  // 벤치마크 설명 창 (2026-11-13): 논문이 실험한 두 벤치마크 LIBERO와 RoboTwin 2.0을 나란히 설명한다.
  // 숫자는 논문에서 그대로 옮긴다: 설정 App. A.1–A.2, 평가 §4.1과 App. B.1, 결과 Tab. 1, 2, 12, 13.
  // suite와 clean/randomized의 뜻은 각 벤치마크 논문의 정의다(TurboVLA 논문은 이름만 쓴다). 출처 줄에 밝힌다.
  import { copyFor } from '../content/i18n'
  import { ui } from '../state/store.svelte'

  const c = $derived(copyFor(ui.lang))
  const b = $derived(c.bench)

  /** 비교 표: 줄마다 [이름, LIBERO, RoboTwin 2.0, 출처] */
  const rows = $derived([
    [b.rowRobot, b.liberoRobot, b.robotwinRobot, '§4'],
    [b.rowTasks, b.liberoTasks, b.robotwinTasks, '§4.1'],
    [b.rowCameras, b.liberoCameras, b.robotwinCameras, `App. A.2, ${b.sourceCode}`],
    [b.rowImage, '256 × 256', '224 × 224', 'App. A.2'],
    [b.rowState, b.liberoState, b.robotwinState, `App. A.2, ${b.sourceCode}`],
    [b.rowAction, b.liberoAction, b.robotwinAction, `App. A.2, LIBERO, ${b.sourceCode}`],
    [b.rowHorizon, 'H = 12', 'H = 50', 'App. A.2'],
    [b.rowData, b.liberoData, b.robotwinData, '§4.1, App. A.2'],
    [b.rowEncoder, 'DINOv3 ViT-B/16', 'DINOv3 ViT-L/16', 'App. A.1'],
    [b.rowEval, b.liberoEval, b.robotwinEval, '§4.1, App. B.1'],
    [b.rowRun, b.liberoRun, b.robotwinRun, `§3.1, App. B.1, ${b.sourceCode}`],
    [b.rowResult, b.liberoResult, b.robotwinResult, 'Tab. 1, 2'],
  ])

  /** 논문 rollout 그림에서 고른 장면 (public/bench, 시작, 중간, 끝 세 장) */
  const img = (name: string) => `${import.meta.env.BASE_URL}bench/${name}.jpg`

  /** LIBERO suite 4개와 TurboVLA 성공률 (Tab. 1). 장면과 지시문은 논문 Fig. 7 */
  const suites = $derived([
    { name: 'Spatial', text: b.suiteSpatial, value: 97.0, img: 'libero-spatial', task: 'Pick up the black bowl in the top drawer of the wooden cabinet and place it on the plate' },
    { name: 'Object', text: b.suiteObject, value: 100.0, img: 'libero-object', task: 'Pick up the milk and place it in the basket' },
    { name: 'Goal', text: b.suiteGoal, value: 98.2, img: 'libero-goal', task: 'Put the wine bottle on top of the cabinet' },
    { name: 'Long', text: b.suiteLong, value: 95.2, img: 'libero-long', task: 'Put both moka pots on the stove' },
  ])

  /** RoboTwin 2.0 과제 장면 (논문 Fig. 8): 한 팔로 하는 과제와 두 팔이 함께 하는 과제 */
  const twinTasks = $derived([
    { name: 'Move Stapler to Pad', text: b.taskStapler, img: 'robotwin-stapler' },
    { name: 'Hand Over Block', text: b.taskHandover, img: 'robotwin-handover' },
  ])

  /** RoboTwin 2.0 두 조건과 TurboVLA 성공률 (Tab. 2) */
  const conditions = $derived([
    { name: 'Clean', text: b.condClean, value: 88.02 },
    { name: 'Randomized', text: b.condRandomized, value: 88.1 },
  ])

  /** RoboTwin 2.0 과제 예 (Tab. 12의 50개 가운데) */
  const EXAMPLES = ['Stack Bowls Three', 'Handover Block', 'Open Laptop', 'Press Stapler', 'Hanging Mug', 'Place Dual Shoes']
</script>

<div class="bench">
  <p class="lead">{b.lead}</p>

  <table>
    <thead>
      <tr>
        <th scope="col"></th>
        <th scope="col">LIBERO</th>
        <th scope="col">RoboTwin 2.0</th>
        <th scope="col" class="src">{b.source}</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as [name, libero, robotwin, src] (name)}
        <tr>
          <th scope="row">{name}</th>
          <td>{libero}</td>
          <td>{robotwin}</td>
          <td class="src">{src}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <section>
    <h3>{b.suitesTitle}</h3>
    <ul class="scenes">
      {#each suites as s (s.name)}
        <li>
          <div class="scene-head">
            <strong>LIBERO-{s.name}</strong>
            <span class="value">{s.value.toFixed(1)}%</span>
          </div>
          <span>{s.text}</span>
          <img src={img(s.img)} alt={`LIBERO-${s.name}: ${s.task}`} width="458" height="150" loading="lazy" />
          <span class="task" lang="en">“{s.task}”</span>
        </li>
      {/each}
    </ul>
    <p class="note">{b.suitesNote} {b.imgCredit}</p>
  </section>

  <div class="cols">
    <section>
      <h3>{b.twinTasksTitle}</h3>
      <ul class="scenes one">
        {#each twinTasks as s (s.name)}
          <li>
            <strong lang="en">{s.name}</strong>
            <span>{s.text}</span>
            <img src={img(s.img)} alt={`RoboTwin 2.0: ${s.name}`} width="458" height="150" loading="lazy" />
          </li>
        {/each}
      </ul>
    </section>
    <section>
      <h3>{b.condTitle}</h3>
      <ul class="cards">
        {#each conditions as s (s.name)}
          <li>
            <strong>{s.name}</strong>
            <span>{s.text}</span>
            <span class="value">{s.value.toFixed(2)}%</span>
          </li>
        {/each}
      </ul>
      <p class="note">{b.examplesLead} <span lang="en">{EXAMPLES.join(', ')}</span></p>
      <p class="note">{b.condNote}</p>
    </section>
  </div>
</div>

<style>
  .bench {
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-size: var(--fs-sm);
  }

  .lead {
    margin: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 5px 10px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }

  thead th {
    border-bottom: 1.5px solid var(--line-strong);
    font-weight: 700;
  }

  tbody th {
    width: 9.5em;
    color: var(--muted);
    font-weight: 600;
    white-space: nowrap;
  }

  .src {
    width: 8em;
    color: var(--muted);
    font-size: var(--fs-xs);
    white-space: nowrap;
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  h3 {
    margin: 0 0 6px;
    font-size: var(--fs-sm);
    font-weight: 700;
  }

  .cards {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cards li {
    display: grid;
    grid-template-columns: 8.5em minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--card);
  }

  .value {
    color: var(--accent-ink);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .scenes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .scenes.one {
    grid-template-columns: 1fr;
  }

  .scenes li {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--card);
  }

  .scene-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .scenes img {
    display: block;
    width: 100%;
    max-width: 458px;
    height: auto;
    border-radius: 4px;
  }

  .task {
    color: var(--muted);
    font-size: var(--fs-xs);
  }

  .note {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: var(--fs-xs);
  }
</style>
