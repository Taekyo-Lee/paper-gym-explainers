# Paper Gym Explainers

논문의 텐서와 연산을 단계마다 따라가 보는 설명 페이지 모음입니다.

**주소:** https://taekyo-lee.github.io/paper-gym-explainers/

| 설명 페이지 | 논문 | 주소 |
|---|---|---|
| TurboVLA Explainer | TurboVLA (arXiv 2607.27205) | https://taekyo-lee.github.io/paper-gym-explainers/turbovla/ |

> **가상 값 고지.** 화면의 값(입력 feature, 가중치, attention, 출력)은 모두 설명을 위해 만든 가상 값입니다. 텐서 모양과 연산 순서만 논문(또는 공식 코드, 화면의 기준 토글)을 따릅니다. 화면에 나오는 성공률과 지연 시간 같은 숫자는 논문의 표에서 그대로 옮긴 것이고, 이 페이지가 계산한 값이 아닙니다. 벤치마크 창의 장면 사진은 논문 Fig. 7, 8에서 잘라 온 것입니다.

## TurboVLA Explainer 사용법

화면은 1600 × 900 이상에서 보도록 맞췄습니다(1440에서는 위쪽 구조도가 가로로 스크롤됩니다).

- 위쪽 구조도의 단계를 누르거나 ←/→ 키로 Inputs부터 Action chunk까지 옮겨 갑니다. 화살표마다 텐서 모양이 적혀 있습니다.
- 오른쪽 파라미터 패널에서 프리셋(LIBERO, RoboTwin 2.0)과 카메라 수, 층 수, action horizon 같은 값을 바꾸면 텐서 모양과 그림이 바로 다시 계산됩니다.
- 점선 밑줄이 있는 기호에 마우스를 올리면 그 기호의 뜻, 종류, 모양이 뜹니다. 수식 카드의 "기호" 단추는 그 식의 기호를 표로 보여 줍니다.
- 아래 막대에서 기술적 주의 목록, 2017 Transformer와의 비교, L1/L2 loss 비교, 벤치마크 설명을 엽니다.
- 오른쪽 위에서 한국어/영어와 light/dark 테마를 고릅니다.

## 개발

설명 페이지마다 폴더 하나(Vite + Svelte 5 + TypeScript)입니다.

```bash
cd turbovla
npm ci
npm run dev      # 개발 서버 (http://localhost:5173/)
npm run check    # 타입 검사
npm test         # 단위 테스트 (Vitest)
npm run smoke    # 스크린샷 smoke test (Playwright)
npm run build    # 배포용 빌드 (dist/)
```

`main`에 커밋이 올라오면 GitHub Actions(`.github/workflows/deploy.yml`)가 검사, 테스트, 빌드를 거쳐 첫 화면(`site/index.html`)과 빌드한 앱을 GitHub Pages에 올립니다.

새 설명 페이지를 더할 때는 폴더를 만들고, 워크플로에 같은 단계(설치, 검사, 빌드, `site/<폴더>/`에 복사)를 더하고, `site/index.html`에 링크를 답니다. 앱의 `BASE_PATH`는 `/paper-gym-explainers/<폴더>/`입니다.
