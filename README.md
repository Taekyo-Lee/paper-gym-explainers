# Paper Gym Explainers

논문의 텐서와 연산을 단계마다 따라가 보는 설명 페이지 모음입니다.

**첫 화면:** https://taekyo-lee.github.io/paper-gym-explainers/

## 설명 페이지

| 설명 페이지 | 논문 | 주소 |
|---|---|---|
| [TurboVLA Explainer](turbovla/) | TurboVLA (arXiv 2607.27205) | https://taekyo-lee.github.io/paper-gym-explainers/turbovla/ |

설명 페이지마다 폴더가 하나씩 있고, 그 페이지의 소개와 사용법은 폴더의 README에 있습니다.

> **가상 값 고지.** 설명 페이지의 값(입력 feature, 가중치, attention, 출력)은 설명을 위해 만든 가상 값입니다. 텐서 모양과 연산 순서만 논문을 따릅니다. 화면에 나오는 성공률 같은 논문의 숫자는 논문의 표에서 옮긴 것이고, 페이지가 계산한 값이 아닙니다.

## 구조

- `<폴더>/`: 설명 페이지 하나. 정적 웹 앱이고(지금은 Vite + Svelte 5 + TypeScript), 폴더의 README에 소개, 사용법, 개발 명령이 있습니다.
- `site/index.html`: 첫 화면(설명 페이지 목록).
- `.github/workflows/deploy.yml`: 배포 워크플로.

## 배포

`main`에 push하면 GitHub Actions가 설명 페이지마다 설치, 타입 검사, 단위 테스트, smoke test, 빌드를 거쳐 첫 화면과 함께 GitHub Pages에 올립니다. 설명 페이지의 주소는 `https://taekyo-lee.github.io/paper-gym-explainers/<폴더>/`이고, 앱은 그 경로(`BASE_PATH=/paper-gym-explainers/<폴더>/`)로 빌드합니다.

## 새 설명 페이지 더하기

1. `<폴더>/`에 앱을 둡니다. 기본 배포 경로는 `/paper-gym-explainers/<폴더>/`로 하고, 브라우저 저장 key는 페이지마다 다르게 합니다(모든 페이지가 같은 주소를 쓰므로 key가 같으면 설정이 섞입니다).
2. `.github/workflows/deploy.yml`에 그 폴더의 설치, 검사, 빌드 단계와 `site/<폴더>/`로 복사하는 단계를 더합니다.
3. `site/index.html`과 이 README의 표에 링크를 더합니다.
