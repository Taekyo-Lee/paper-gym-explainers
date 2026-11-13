// 기호 풀이. 수식과 단계 패널에 나오는 모든 기호의 뜻, 종류, 모양.
// - 수식과 그림의 KaTeX 안에서 기호를 g(key, tex)로 감싸면(\htmlClass{gl gl-<key>}) 마우스를 올렸을 때 풀이가 뜬다(GlossaryTip).
// - 수식 카드의 "기호" 단추는 그 식에 든 key를 모아 표로 보인다(glossKeys).
// - 종류는 그 기호가 "무엇"인지다: 입력 데이터, 모델(함수), embedding 벡터, parameter, 중간 값, 출력, 정답, 크기, 첨자, 연산.
// - 사실은 논문(§3, App. A)과 공식 코드를 따른다. 논문과 공식 코드가 다르면 note에 밝힌다.
import type { ForwardTrace } from '../engine/types'
import type { Lang } from './i18n'

export type GlossKind = 'input' | 'model' | 'embedding' | 'param' | 'tensor' | 'output' | 'target' | 'size' | 'index' | 'op'

export const KIND_LABEL: Record<GlossKind, Record<Lang, string>> = {
  input: { ko: '입력 데이터', en: 'Input data' },
  model: { ko: '모델 (함수)', en: 'Model (function)' },
  embedding: { ko: 'embedding 벡터', en: 'Embedding vector' },
  param: { ko: '학습되는 parameter', en: 'Learned parameter' },
  tensor: { ko: '중간 값', en: 'Intermediate value' },
  output: { ko: '출력', en: 'Output' },
  target: { ko: '정답', en: 'Target' },
  size: { ko: '크기', en: 'Size' },
  index: { ko: '첨자', en: 'Index' },
  op: { ko: '연산과 표기', en: 'Operation or notation' },
}

interface Text {
  /** 짧은 이름 (예: 이미지 encoder) */
  name: string
  /** 한두 문장 풀이 */
  meaning: string
}

export interface GlossEntry {
  /** 표에 보일 기호 (KaTeX) */
  tex: string
  kind: GlossKind
  ko: Text
  en: Text
  /** 지금 설정의 모양 (예: [512 × 256]). 모양이 없는 기호(함수, 첨자)나 지금 설정에서 없는 항은 undefined */
  shape?: (t: ForwardTrace) => string | undefined
  /** 논문과 공식 코드가 다른 점, 화면 값에 대한 주의. 기준이나 설정에 따라 다르면 함수로 쓴다 */
  note?: Record<Lang, string> | ((t: ForwardTrace) => Record<Lang, string> | undefined)
}

/** 지금 설정의 모양. 계산할 수 없으면 null */
export function glossShape(e: GlossEntry, t: ForwardTrace): string | null {
  if (!e.shape) return null
  try {
    return e.shape(t) ?? null
  } catch {
    return null
  }
}

/** 지금 설정의 주의 문장. 없으면 null */
export function glossNote(e: GlossEntry, t: ForwardTrace, lang: Lang): string | null {
  if (!e.note) return null
  try {
    const note = typeof e.note === 'function' ? e.note(t) : e.note
    return note ? note[lang] : null
  } catch {
    return null
  }
}

const sh = (rows: number, cols: number) => `[${rows} × ${cols}]`
const D = 256
const P = (t: ForwardTrace) => (t.config.imageSize / t.config.patchSize) ** 2
const KP = (t: ForwardTrace) => t.Zv.rows
const NL = (t: ForwardTrace) => t.Zl.rows
const NS = (t: ForwardTrace) => t.state.Zs.rows
const H = (t: ForwardTrace) => t.config.H
const DA = (t: ForwardTrace) => t.config.actionDim

export const GLOSSARY = {
  // ---------------------------------------------------------------- 입력과 policy (§3.1)
  O: {
    tex: String.raw`\mathcal{O}_t`,
    kind: 'input',
    ko: { name: 'observation', meaning: 't 시점에 카메라 K대가 찍은 이미지 묶음입니다.' },
    en: { name: 'Observation', meaning: 'The images the K cameras take at time t.' },
    shape: (t) => `[${t.config.K} × ${t.config.imageSize} × ${t.config.imageSize} × 3]`,
  },
  I: {
    tex: String.raw`I^{(i)}_t`,
    kind: 'input',
    ko: { name: '카메라 이미지', meaning: 't 시점에 i번째 카메라가 찍은 RGB 이미지 한 장입니다.' },
    en: { name: 'Camera image', meaning: 'One RGB image taken by camera i at time t.' },
    shape: (t) => `[${t.config.imageSize} × ${t.config.imageSize} × 3]`,
  },
  x: {
    tex: 'x',
    kind: 'input',
    ko: { name: '지시문', meaning: '로봇에게 주는 영어 문장입니다. 이 문장을 토큰으로 나눠 encoder에 넣습니다.' },
    en: { name: 'Instruction', meaning: 'The English sentence given to the robot. It is split into tokens for the encoder.' },
  },
  s: {
    tex: 's_t',
    kind: 'input',
    ko: { name: '로봇 state', meaning: 't 시점의 로봇 state입니다. 실수 여러 개로 된 벡터 하나입니다(LIBERO 8개: 손끝 위치 3, 회전 3, gripper 손가락 2).' },
    en: { name: 'Robot state', meaning: 'The robot’s state at time t: one vector of real numbers (LIBERO has 8: end-effector position 3, rotation 3, gripper fingers 2).' },
    shape: (t) => sh(1, t.config.stateDim),
  },
  pi: {
    tex: String.raw`\pi_\theta`,
    kind: 'model',
    ko: { name: 'policy', meaning: 'observation, 지시문, state를 받아 action chunk를 내는 모델 전체입니다. 아래의 encoder, V-L Interaction, decoder를 모두 합친 것입니다.' },
    en: { name: 'Policy', meaning: 'The whole model that maps the observation, instruction, and state to an action chunk: the encoders, V-L Interaction, and decoder together.' },
  },
  theta: {
    tex: String.raw`\theta`,
    kind: 'param',
    ko: { name: '모델의 parameter', meaning: 'policy가 학습하는 모든 가중치입니다. BERT만 학습하지 않습니다(frozen).' },
    en: { name: 'Model parameters', meaning: 'All weights the policy learns. Only BERT stays frozen.' },
  },
  R: {
    tex: String.raw`\mathbb{R}^{a \times b}`,
    kind: 'op',
    ko: { name: '모양 표기', meaning: '실수로 된 a행 b열 행렬이라는 뜻입니다. 화면의 [a × b] 모양 이름표와 같습니다.' },
    en: { name: 'Shape notation', meaning: 'A matrix of real numbers with a rows and b columns, the same as the [a × b] shape labels on screen.' },
  },
  H: {
    tex: 'H',
    kind: 'size',
    ko: { name: 'action horizon', meaning: '한 번에 내는 action chunk의 step 수입니다(LIBERO 12, RoboTwin 50).' },
    en: { name: 'Action horizon', meaning: 'The number of steps in one action chunk (LIBERO 12, RoboTwin 50).' },
  },
  da: {
    tex: 'd_a',
    kind: 'size',
    ko: { name: 'action 차원', meaning: 'step 하나의 action이 가진 값의 수입니다(LIBERO 7: 손끝 이동 3 + 회전 3 + gripper 1, RoboTwin 14: 두 팔 관절 6씩 + gripper 2).' },
    en: { name: 'Action dimension', meaning: 'How many values one step’s action has (LIBERO 7: move 3 + rotate 3 + gripper 1; RoboTwin 14: 6 joints per arm + 2 grippers).' },
  },
  Ahat: {
    tex: String.raw`\hat{\mathbf{A}}_t`,
    kind: 'output',
    ko: { name: '예측한 action chunk', meaning: '모델이 t 시점에 내는 앞으로 H step의 action입니다. 행 하나가 step 하나입니다.' },
    en: { name: 'Predicted action chunk', meaning: 'The actions for the next H steps that the model outputs at time t, one row per step.' },
    shape: (t) => sh(H(t), DA(t)),
  },
  t: {
    tex: 't',
    kind: 'index',
    ko: { name: '시점', meaning: '지금 시점입니다. observation과 state는 시점마다 바뀌고, 지시문은 바뀌지 않아서 지시문 토큰에는 t를 붙이지 않습니다.' },
    en: { name: 'Time step', meaning: 'The current time. Observations and state change over time; the instruction does not, so the instruction tokens carry no t.' },
  },
  // ---------------------------------------------------------------- 지시문 encoder (Eq. 3)
  ftext: {
    tex: String.raw`f_{\text{text}}`,
    kind: 'model',
    ko: { name: '지시문 encoder (BERT)', meaning: 'BERT-base-uncased입니다. 토큰마다 768차원 feature를 냅니다. 학습하지 않고 그대로 씁니다(frozen).' },
    en: { name: 'Instruction encoder (BERT)', meaning: 'BERT-base-uncased. It gives a 768-dim feature per token and is frozen (not trained).' },
    note: { ko: '이 페이지는 BERT를 실행하지 않고 단어 사전으로 feature를 만듭니다.', en: 'This page does not run BERT; it builds the features from a small word list.' },
  },
  Pl: {
    tex: 'P_l',
    kind: 'model',
    ko: { name: '지시문 projection', meaning: 'BERT 출력(768차원)을 공통 차원 d = 256으로 바꾸는 층입니다(공식 코드는 Linear 하나). 학습합니다.' },
    en: { name: 'Instruction projection', meaning: 'A layer that maps the 768-dim BERT output to the shared dimension d = 256 (one Linear in the official code). It is trained.' },
  },
  Zl: {
    tex: 'Z^{l}',
    kind: 'tensor',
    ko: { name: '지시문 토큰', meaning: '지시문 토큰마다 256차원 벡터 하나입니다. 행 하나가 토큰 하나입니다.' },
    en: { name: 'Instruction tokens', meaning: 'One 256-dim vector per instruction token, one row per token.' },
    shape: (t) => sh(NL(t), D),
  },
  Nl: {
    tex: 'N_l',
    kind: 'size',
    ko: { name: '지시문 토큰 수', meaning: '지시문을 나눈 토큰 수입니다([CLS]와 [SEP] 포함).' },
    en: { name: 'Number of instruction tokens', meaning: 'How many tokens the instruction is split into, including [CLS] and [SEP].' },
    note: { ko: 'LIBERO 공식 코드는 [PAD]로 늘 21칸을 채웁니다.', en: 'The official LIBERO code always pads to 21 slots with [PAD].' },
  },
  d: {
    tex: 'd',
    kind: 'size',
    ko: { name: '공통 차원', meaning: '모든 토큰이 같이 쓰는 벡터 길이 256입니다.' },
    en: { name: 'Shared dimension', meaning: 'The vector length every token uses: 256.' },
  },
  // ---------------------------------------------------------------- 이미지 encoder (Eq. 4)
  fimg: {
    tex: String.raw`f_{\text{img}}`,
    kind: 'model',
    ko: { name: '이미지 encoder (DINOv3)', meaning: '이미지를 16 × 16 픽셀 patch로 나눠 patch마다 feature를 내는 ViT입니다(LIBERO ViT-B/16, RoboTwin ViT-L/16). 함께 학습합니다.' },
    en: { name: 'Image encoder (DINOv3)', meaning: 'A ViT that splits the image into 16 × 16-pixel patches and gives a feature per patch (LIBERO ViT-B/16, RoboTwin ViT-L/16). It is trained along with the rest.' },
    note: { ko: '이 페이지는 DINOv3를 실행하지 않고 장면 그림에서 feature를 만듭니다.', en: 'This page does not run DINOv3; it builds the features from the scene drawing.' },
  },
  Pv: {
    tex: 'P_v',
    kind: 'model',
    ko: { name: '이미지 projection', meaning: 'DINOv3 출력을 공통 차원 d = 256으로 바꾸는 층입니다. 학습합니다.' },
    en: { name: 'Image projection', meaning: 'A layer that maps the DINOv3 output to the shared dimension d = 256. It is trained.' },
    note: { ko: '공식 코드는 LayerNorm, MLP(→ 1,024 → 256)와 skip Linear, LayerNorm으로 되어 있습니다.', en: 'In the official code it is LayerNorm, an MLP (→ 1,024 → 256) with a skip Linear, then LayerNorm.' },
  },
  Pvf: {
    tex: String.raw`P_v\!\left(f_{\text{img}}\!\left(I^{(i)}_t\right)\right)`,
    kind: 'tensor',
    ko: { name: 'patch 내용', meaning: '이미지 encoder가 낸 patch feature를 이미지 projection으로 256차원에 맞춘 값입니다. 그 patch에 무엇이 보이는지를 담습니다.' },
    en: { name: 'Patch content', meaning: 'The patch features from the image encoder, mapped to 256 dims by the image projection. It carries what the patch shows.' },
    shape: (t) => sh(P(t), D),
  },
  Epos: {
    tex: String.raw`E^{(i)}_{\text{pos}}`,
    kind: 'embedding',
    ko: { name: '위치 embedding', meaning: '각 patch가 이미지 안 어디에 있는지 알려 주려고 patch마다 더하는 벡터입니다.' },
    en: { name: 'Position embedding', meaning: 'A vector added to each patch to tell where it sits in the image.' },
    // 공식 코드 기준의 LIBERO에는 이 항이 없다 (모양도 없다)
    shape: (t) => (t.Zv_parts.pos ? sh(P(t), D) : undefined),
    note: (t) =>
      t.config.basis === 'paper'
        ? {
            ko: '논문은 학습하는 값인지 정해진 값인지 말하지 않습니다. 화면의 값은 설명용 2D sinusoidal입니다. 공식 코드는 다르게 합니다: LIBERO에는 이 항이 없고, RoboTwin은 학습하는 위치표에 view별 scale을 곱합니다.',
            en: 'The paper does not say whether it is learned or fixed. The values on screen are an illustrative 2D sinusoid. The official code differs: LIBERO has no such term, and RoboTwin multiplies a learned position table by a per-view scale.',
          }
        : t.config.profile === 'libero'
          ? {
              ko: 'LIBERO 공식 코드에는 이 항이 없어서 더하지 않습니다(논문 기준에서는 더합니다).',
              en: 'The official LIBERO code has no such term, so nothing is added (the paper basis adds it).',
            }
          : {
              ko: 'RoboTwin 공식 코드는 view마다 학습하는 위치표에 view별 학습 scale을 곱해 더합니다. 화면의 값은 가상 위치표에 가상 scale 0.5를 곱한 것입니다.',
              en: 'The official RoboTwin code adds a learned position table times a learned per-view scale. On screen, a made-up table is multiplied by a made-up scale of 0.5.',
            },
  },
  posScale: {
    tex: String.raw`s^{(i)}`,
    kind: 'param',
    ko: { name: 'view별 scale', meaning: 'RoboTwin 공식 코드가 위치 embedding에 곱하는 학습 숫자입니다(카메라마다 하나).' },
    en: { name: 'Per-view scale', meaning: 'A learned number (one per camera) that the official RoboTwin code multiplies the position embedding by.' },
    note: { ko: '실제 값은 checkpoint에 있어 알 수 없어서 0.5로 둡니다.', en: 'The real value lives in the checkpoint, so 0.5 is used here.' },
  },
  eview: {
    tex: String.raw`e^{(i)}_{\text{view}}`,
    kind: 'embedding',
    ko: { name: '카메라 embedding', meaning: '어느 카메라에서 온 토큰인지 알려 주는 벡터입니다. 카메라마다 하나를 학습하고, 그 카메라의 모든 patch에 같은 벡터를 더합니다.' },
    en: { name: 'Camera embedding', meaning: 'A vector that says which camera a token came from. One is learned per camera and added to every patch of that camera.' },
    shape: () => sh(1, D),
  },
  Zvi: {
    tex: String.raw`Z^{v,(i)}_t`,
    kind: 'tensor',
    ko: { name: '한 카메라의 이미지 토큰', meaning: 'i번째 카메라 이미지의 토큰입니다. patch 하나가 토큰(행) 하나입니다.' },
    en: { name: 'One camera’s image tokens', meaning: 'The tokens of camera i’s image, one token (row) per patch.' },
    shape: (t) => sh(P(t), D),
  },
  Zv: {
    tex: 'Z^{v}_t',
    kind: 'tensor',
    ko: { name: '이미지 토큰', meaning: '모든 카메라의 이미지 토큰을 세로로 이어 붙인 것입니다.' },
    en: { name: 'Image tokens', meaning: 'The image tokens of all cameras, stacked vertically.' },
    shape: (t) => sh(KP(t), D),
  },
  K: {
    tex: 'K',
    kind: 'size',
    ko: { name: '카메라 수', meaning: 'observation에 쓰는 카메라(view) 수입니다(LIBERO 2, RoboTwin 3).' },
    en: { name: 'Number of cameras', meaning: 'How many cameras (views) the observation uses (LIBERO 2, RoboTwin 3).' },
  },
  i: {
    tex: 'i',
    kind: 'index',
    ko: { name: '카메라 번호', meaning: '몇 번째 카메라인지입니다(1부터 K까지).' },
    en: { name: 'Camera index', meaning: 'Which camera (1 to K).' },
  },
  // ---------------------------------------------------------------- state encoder (Eq. 5)
  fstate: {
    tex: String.raw`f_{\text{state}}`,
    kind: 'model',
    ko: { name: 'state encoder', meaning: '로봇 state 벡터 하나를 state 토큰 몇 개(논문 2개)로 바꾸는 작은 MLP입니다. 학습합니다.' },
    en: { name: 'State encoder', meaning: 'A small MLP that turns the one robot-state vector into a few state tokens (2 in the paper). It is trained.' },
    note: { ko: '논문은 "가벼운 projection 네트워크"라고만 합니다. 공식 코드는 LayerNorm, Linear, GELU, Linear 뒤 출력을 토큰으로 나누고 위치 벡터를 더해 LayerNorm을 거칩니다.', en: 'The paper only calls it a lightweight projection network. The official code runs LayerNorm, Linear, GELU, and Linear, splits the output into tokens, adds position vectors, and applies LayerNorm.' },
  },
  Zs: {
    tex: 'Z^{s}_t',
    kind: 'tensor',
    ko: { name: 'state 토큰', meaning: 'state encoder가 낸 토큰입니다. V-L Interaction을 거치지 않고 바로 decoder memory로 갑니다.' },
    en: { name: 'State tokens', meaning: 'The tokens from the state encoder. They skip the V-L Interaction and go straight into the decoder memory.' },
    shape: (t) => sh(NS(t), D),
  },
  Ns: {
    tex: 'N_s',
    kind: 'size',
    ko: { name: 'state 토큰 수', meaning: 'state 하나를 몇 개의 토큰으로 나타내는지입니다(논문 2).' },
    en: { name: 'Number of state tokens', meaning: 'How many tokens one state becomes (2 in the paper).' },
  },
  // ---------------------------------------------------------------- V-L Interaction (Eq. 2, 6, 7, 8)
  Phi: {
    tex: String.raw`\Phi_{vl}`,
    kind: 'model',
    ko: { name: 'V-L Interaction module', meaning: '이미지 토큰과 지시 토큰을 N개 층에 걸쳐 서로 묻게 해서 섞는 모듈입니다. Grounding DINO의 가중치로 시작해 학습합니다.' },
    en: { name: 'V-L Interaction module', meaning: 'Mixes image and instruction tokens by letting them query each other across N layers. It starts from Grounding DINO weights and is trained.' },
  },
  Zvl: {
    tex: 'Z^{vl}_t',
    kind: 'tensor',
    ko: { name: 'V-L Interaction 출력', meaning: '마지막 interaction 층의 이미지 토큰과 지시 토큰을 세로로 이어 붙인 것입니다. w/o Interaction 모드에서는 층을 건너뛰므로 encoder가 낸 토큰을 그대로 이어 붙입니다.' },
    en: { name: 'V-L Interaction output', meaning: 'The last interaction layer’s image and instruction tokens, stacked vertically. In the w/o Interaction mode the layers are skipped, so the encoder tokens are stacked as they are.' },
    shape: (t) => sh(KP(t) + NL(t), D),
  },
  Fusion: {
    tex: String.raw`\text{FusionLayer}_{\ell}`,
    kind: 'model',
    ko: { name: 'interaction 층 하나', meaning: 'ℓ번째 층입니다. 두 방향 cross-attention으로 이미지 토큰과 지시 토큰을 함께 갱신합니다.' },
    en: { name: 'One interaction layer', meaning: 'Layer ℓ. It updates the image and instruction tokens together with cross-attention in both directions.' },
  },
  ell: {
    tex: String.raw`\ell`,
    kind: 'index',
    ko: { name: '층 번호', meaning: '몇 번째 interaction 층인지입니다(1부터 N까지).' },
    en: { name: 'Layer index', meaning: 'Which interaction layer (1 to N).' },
  },
  N: {
    tex: 'N',
    kind: 'size',
    ko: { name: 'interaction 층 수', meaning: 'V-L Interaction을 몇 층 쌓는지입니다(논문 6).' },
    en: { name: 'Number of interaction layers', meaning: 'How many V-L Interaction layers are stacked (6 in the paper).' },
  },
  Vprev: {
    tex: String.raw`V^{\ell-1}_t`,
    kind: 'tensor',
    ko: { name: '층에 들어가는 이미지 토큰', meaning: 'ℓ번째 층에 들어가는 이미지 토큰입니다. 첫 층에서는 encoder가 낸 이미지 토큰입니다.' },
    en: { name: 'Image tokens entering the layer', meaning: 'The image tokens that enter layer ℓ. For the first layer these are the encoder’s image tokens.' },
    shape: (t) => sh(KP(t), D),
  },
  Lprev: {
    tex: String.raw`L^{\ell-1}_t`,
    kind: 'tensor',
    ko: { name: '층에 들어가는 지시 토큰', meaning: 'ℓ번째 층에 들어가는 지시 토큰입니다. 첫 층에서는 encoder가 낸 지시문 토큰입니다.' },
    en: { name: 'Instruction tokens entering the layer', meaning: 'The instruction tokens that enter layer ℓ. For the first layer these are the encoder’s instruction tokens.' },
    shape: (t) => sh(NL(t), D),
  },
  Vnext: {
    tex: String.raw`V^{\ell}_t`,
    kind: 'tensor',
    ko: { name: '층을 나온 이미지 토큰', meaning: 'ℓ번째 층이 갱신한 이미지 토큰입니다.' },
    en: { name: 'Image tokens leaving the layer', meaning: 'The image tokens after layer ℓ updates them.' },
    shape: (t) => sh(KP(t), D),
  },
  Lnext: {
    tex: String.raw`L^{\ell}_t`,
    kind: 'tensor',
    ko: { name: '층을 나온 지시 토큰', meaning: 'ℓ번째 층이 갱신한 지시 토큰입니다.' },
    en: { name: 'Instruction tokens leaving the layer', meaning: 'The instruction tokens after layer ℓ updates them.' },
    shape: (t) => sh(NL(t), D),
  },
  Lmid: {
    tex: String.raw`L'^{\ell}_t`,
    kind: 'tensor',
    ko: { name: '텍스트 블록 전의 지시 토큰', meaning: '공식 코드에서 cross-attention으로 갱신한 뒤, 텍스트 블록에 들어가기 전의 지시 토큰입니다.' },
    en: { name: 'Instruction tokens before the text block', meaning: 'In the official code, the instruction tokens after the cross-attention update and before the text block.' },
    shape: (t) => sh(NL(t), D),
  },
  AttnVL: {
    tex: String.raw`\text{Attn}_{v \leftarrow l}`,
    kind: 'model',
    ko: { name: '이미지가 묻는 cross-attention', meaning: '이미지 토큰이 Query, 지시 토큰이 Key와 Value인 attention입니다. 결과를 이미지 토큰에 더합니다. 학습하는 projection이 있습니다.' },
    en: { name: 'Cross-attention where the image asks', meaning: 'Attention with image tokens as the Query and instruction tokens as Key and Value. The result is added to the image tokens. Its projections are trained.' },
  },
  AttnLV: {
    tex: String.raw`\text{Attn}_{l \leftarrow v}`,
    kind: 'model',
    ko: { name: '지시가 묻는 cross-attention', meaning: '지시 토큰이 Query, 이미지 토큰이 Key와 Value인 attention입니다. 결과를 지시 토큰에 더합니다. 학습하는 projection이 있습니다.' },
    en: { name: 'Cross-attention where the instruction asks', meaning: 'Attention with instruction tokens as the Query and image tokens as Key and Value. The result is added to the instruction tokens. Its projections are trained.' },
  },
  Avl: {
    tex: String.raw`A_{v\leftarrow l}`,
    kind: 'tensor',
    ko: { name: '이미지가 묻는 attention 행렬', meaning: 'patch마다 지시 토큰에 준 attention입니다. 행마다 합이 1입니다(score 행렬 S를 지시 토큰 축으로 softmax).' },
    en: { name: 'Attention matrix where the image asks', meaning: 'How much each patch attends to each instruction token. Each row sums to 1 (softmax of the score matrix S over the instruction tokens).' },
    shape: (t) => sh(KP(t), NL(t)),
  },
  Alv: {
    tex: String.raw`A_{l\leftarrow v}`,
    kind: 'tensor',
    ko: { name: '지시가 묻는 attention 행렬', meaning: '지시 토큰마다 patch에 준 attention입니다. 행마다 합이 1입니다(score 행렬 S를 patch 축으로 softmax).' },
    en: { name: 'Attention matrix where the instruction asks', meaning: 'How much each instruction token attends to each patch. Each row sums to 1 (softmax of the score matrix S over the patches).' },
    shape: (t) => sh(NL(t), KP(t)),
  },
  S: {
    tex: 'S',
    kind: 'tensor',
    ko: { name: 'score 행렬', meaning: 'softmax 전의 점수입니다. 두 방향이 같은 S를 쓰고, 어느 축으로 softmax하는지만 다릅니다(공식 코드).' },
    en: { name: 'Score matrix', meaning: 'The scores before softmax. Both directions share this S and differ only in which axis the softmax runs over (official code).' },
    shape: (t) => sh(KP(t), NL(t)),
  },
  gamma: {
    tex: String.raw`\gamma`,
    kind: 'param',
    ko: { name: 'layer scale', meaning: 'attention 출력에 채널마다 곱하는 학습 벡터입니다(공식 코드). 층마다, 방향마다 따로 있습니다.' },
    en: { name: 'Layer scale', meaning: 'A learned vector multiplied channel-wise into the attention output (official code), one per layer and direction.' },
    note: { ko: '실제 값은 checkpoint에 있어 알 수 없어서 모든 칸을 0.5로 둡니다.', en: 'The real values live in the checkpoint, so 0.5 is used everywhere.' },
  },
  hadamard: {
    tex: String.raw`\odot`,
    kind: 'op',
    ko: { name: '칸마다 곱하기', meaning: '같은 자리의 값끼리 곱합니다(element-wise 곱).' },
    en: { name: 'Element-wise product', meaning: 'Multiplies values at the same position.' },
  },
  LNop: {
    tex: String.raw`\mathrm{LN}`,
    kind: 'model',
    ko: { name: 'LayerNorm', meaning: '토큰마다 값의 평균을 0, 분산을 1로 맞추는 정규화입니다.' },
    en: { name: 'LayerNorm', meaning: 'Normalizes each token’s values to mean 0 and variance 1.' },
    note: { ko: '학습하는 scale과 bias는 이 페이지에서 1과 0으로 둡니다.', en: 'Its learned scale and bias are set to 1 and 0 on this page.' },
  },
  SA: {
    tex: String.raw`\mathrm{SA}`,
    kind: 'model',
    ko: { name: 'self-attention', meaning: '지시 토큰끼리 서로 묻는 attention입니다(공식 코드의 텍스트 블록, 문장 단위 mask).' },
    en: { name: 'Self-attention', meaning: 'Attention among the instruction tokens (the official code’s text block, with a per-sentence mask).' },
  },
  TextBlock: {
    tex: String.raw`\text{TextBlock}`,
    kind: 'model',
    ko: { name: '텍스트 블록', meaning: '공식 코드에서 cross-attention 뒤에 지시 토큰만 한 번 더 거치는 self-attention과 FFN입니다. 논문에는 없습니다.' },
    en: { name: 'Text block', meaning: 'In the official code, the self-attention and FFN that only the instruction tokens go through after the cross-attention. It is not in the paper.' },
  },
  VN: {
    tex: 'V^{N}_t',
    kind: 'tensor',
    ko: { name: '마지막 층의 이미지 토큰', meaning: 'N번째(마지막) interaction 층을 나온 이미지 토큰입니다.' },
    en: { name: 'Image tokens from the last layer', meaning: 'The image tokens out of the N-th (last) interaction layer.' },
    shape: (t) => sh(KP(t), D),
  },
  LNout: {
    tex: 'L^{N}_t',
    kind: 'tensor',
    ko: { name: '마지막 층의 지시 토큰', meaning: 'N번째(마지막) interaction 층을 나온 지시 토큰입니다.' },
    en: { name: 'Instruction tokens from the last layer', meaning: 'The instruction tokens out of the N-th (last) interaction layer.' },
    shape: (t) => sh(NL(t), D),
  },
  concat: {
    tex: String.raw`[\,\cdot\,;\,\cdot\,]`,
    kind: 'op',
    ko: { name: '이어 붙이기 (concatenation)', meaning: '세미콜론으로 나눈 행렬들을 위아래로 이어 붙입니다. 열 수(256)는 그대로이고 행 수가 더해집니다.' },
    en: { name: 'Concatenation', meaning: 'Stacks the matrices separated by semicolons on top of each other. The column count (256) stays; the row counts add up.' },
  },
  // ---------------------------------------------------------------- decoder (Eq. 9)
  memory: {
    tex: String.raw`\left[Z^{vl}_t ; Z^{s}_t\right]`,
    kind: 'tensor',
    ko: { name: 'decoder memory', meaning: 'V-L Interaction 출력과 state 토큰을 이어 붙인 것입니다. decoder의 action query가 이것을 Key와 Value로 읽습니다.' },
    en: { name: 'Decoder memory', meaning: 'The V-L Interaction output with the state tokens appended. The decoder’s action queries read it as Key and Value.' },
    shape: (t) => sh(t.memory.rows, D),
  },
  Dtheta: {
    tex: String.raw`D_\theta`,
    kind: 'model',
    ko: { name: 'action decoder', meaning: 'action query가 memory에 묻는 3층 transformer decoder와 출력 MLP입니다(ACT 방식). 학습합니다.' },
    en: { name: 'Action decoder', meaning: 'A 3-layer transformer decoder in which the action queries ask the memory, plus an output MLP (ACT style). It is trained.' },
  },
  Qa: {
    tex: 'Q_a',
    kind: 'embedding',
    ko: { name: 'action query', meaning: 'step마다 하나씩, 학습하는 벡터 H개입니다. 입력과 관계없이 늘 같은 값이고, decoder에서 memory에 묻는 Query가 됩니다.' },
    en: { name: 'Action queries', meaning: 'H learned vectors, one per step. They are the same for every input and become the Queries that ask the memory in the decoder.' },
    shape: (t) => sh(H(t), D),
  },
  q: {
    tex: 'q_k',
    kind: 'embedding',
    ko: { name: 'action query 하나', meaning: 'k번째 query입니다. chunk의 k번째 step(t+k−1)을 맡습니다.' },
    en: { name: 'One action query', meaning: 'The k-th query. It is responsible for step k of the chunk (t+k−1).' },
    shape: () => sh(1, D),
  },
  // ---------------------------------------------------------------- 학습 (§3.4)
  L1: {
    tex: String.raw`\mathcal{L}_{\ell_1}`,
    kind: 'op',
    ko: { name: 'ℓ1 loss', meaning: '예측 chunk와 정답 chunk의 차이를 칸마다 절댓값으로 바꿔 평균한 값입니다. 학습할 때만 씁니다.' },
    en: { name: 'ℓ1 loss', meaning: 'The absolute differences between the predicted and target chunks, averaged. Used only in training.' },
    note: {
      ko: '논문은 ℓ1 loss라고만 씁니다. 공식 코드는 평균을 냅니다: LIBERO는 에피소드 끝에서 채운 step을 빼고 평균하고, RoboTwin은 채운 step까지 모두 평균합니다.',
      en: 'The paper only says ℓ1 loss. The official code takes a mean: LIBERO leaves out the padded steps at the end of an episode, and RoboTwin averages over everything, padded steps included.',
    },
  },
  Astar: {
    tex: String.raw`\mathbf{A}^{*}_t`,
    kind: 'target',
    ko: { name: '정답 action chunk', meaning: '시연(데모)에서 t 시점부터 H step 동안 실제로 한 action입니다.' },
    en: { name: 'Target action chunk', meaning: 'The actions the demonstration actually took for H steps from time t.' },
    shape: (t) => sh(H(t), DA(t)),
  },
  astar: {
    tex: String.raw`a^{*}_{t}`,
    kind: 'target',
    ko: { name: '정답 action 하나', meaning: '시연에서 한 step에 한 action입니다.' },
    en: { name: 'One target action', meaning: 'The demonstration’s action at one step.' },
    shape: (t) => sh(1, DA(t)),
  },
  // ---------------------------------------------------------------- 2017 Transformer의 attention (수식 패널, 2017 비교 창)
  Qm: {
    tex: 'Q',
    kind: 'tensor',
    ko: { name: 'Query 행렬', meaning: '묻는 쪽 토큰을 학습하는 projection으로 바꾼 행렬입니다.' },
    en: { name: 'Query matrix', meaning: 'The asking tokens, transformed by a learned projection.' },
  },
  Km: {
    tex: 'K',
    kind: 'tensor',
    ko: { name: 'Key 행렬', meaning: '답하는 쪽 토큰을 학습하는 projection으로 바꾼 행렬입니다. Query와 곱해 점수를 냅니다.' },
    en: { name: 'Key matrix', meaning: 'The answering tokens, transformed by a learned projection. Multiplied with the Query to give scores.' },
  },
  Vm: {
    tex: 'V',
    kind: 'tensor',
    ko: { name: 'Value 행렬', meaning: '답하는 쪽 토큰에서 실제로 가져올 내용입니다. attention 가중치로 섞어 결과를 만듭니다.' },
    en: { name: 'Value matrix', meaning: 'The content taken from the answering tokens, mixed by the attention weights.' },
  },
  dk: {
    tex: 'd_k',
    kind: 'size',
    ko: { name: 'head 하나의 차원', meaning: 'head 하나에서 Query와 Key 벡터의 길이입니다. 점수를 이 값의 제곱근으로 나눠 크기를 맞춥니다.' },
    en: { name: 'Head dimension', meaning: 'The length of the Query and Key vectors in one head. Scores are divided by its square root.' },
    // TurboVLA에서는 두 곳의 값이 다르다: V-L Interaction(내부 차원 ÷ head 수, 공식 코드)과 decoder(256 ÷ 8)
    note: (t) => {
      const inner = t.config.interactionInnerDim
      const h = t.config.interactionHeads
      const dec = D / t.config.decoderHeads
      const n = inner.toLocaleString('en-US')
      // 공식 코드 기준에서는 텍스트 블록의 self-attention도 있다 (256 ÷ head 수, interaction.ts)
      const text = t.config.basis === 'code'
      return {
        ko:
          `TurboVLA에서는 attention마다 값이 다릅니다. V-L Interaction의 cross-attention은 내부 차원 ${n} ÷ head ${h}개 = ${inner / h}입니다(공식 코드는 head 4개).` +
          (text ? ` 텍스트 블록의 self-attention은 ${D} ÷ head ${h}개 = ${D / h}입니다.` : '') +
          ` decoder는 ${D} ÷ head ${t.config.decoderHeads}개 = ${dec}입니다.`,
        en:
          `In TurboVLA each attention has its own value. The V-L Interaction cross-attention uses inner dimension ${n} ÷ ${h} heads = ${inner / h} (the official code uses 4 heads).` +
          (text ? ` The text block’s self-attention uses ${D} ÷ ${h} heads = ${D / h}.` : '') +
          ` The decoder uses ${D} ÷ ${t.config.decoderHeads} heads = ${dec}.`,
      }
    },
  },
  softmax: {
    tex: String.raw`\operatorname{softmax}`,
    kind: 'op',
    ko: { name: 'softmax', meaning: '행마다 값을 0과 1 사이로 바꿔 합이 1이 되게 합니다. 그래서 attention은 "어디를 얼마나 보는지"의 비율이 됩니다.' },
    en: { name: 'Softmax', meaning: 'Turns each row into values between 0 and 1 that sum to 1, so attention becomes a share of where to look.' },
  },
  transpose: {
    tex: String.raw`{}^{\top}`,
    kind: 'op',
    ko: { name: '전치', meaning: '행과 열을 바꿉니다.' },
    en: { name: 'Transpose', meaning: 'Swaps rows and columns.' },
  },
  attnFn: {
    tex: String.raw`\text{Attention}`,
    kind: 'op',
    ko: { name: 'attention 연산', meaning: 'Query와 Key를 비교한 점수를 softmax로 가중치로 바꾸고, 그 가중치로 Value를 섞습니다. 2017 Transformer의 식이고, 이 연산에는 학습하는 값이 없습니다(Q, K, V를 만드는 projection이 학습합니다).' },
    en: { name: 'Attention', meaning: 'Compares the Queries with the Keys, turns the scores into weights with a softmax, and mixes the Values with those weights. This is the 2017 Transformer’s formula; the operation itself has nothing to learn (the projections that make Q, K and V do).' },
  },
  ij: {
    tex: 'i, j',
    kind: 'index',
    ko: { name: '행 번호와 열 번호', meaning: 'mask의 i행 j열 칸입니다. i는 지금 계산하는 토큰이고 j는 그 토큰이 볼 토큰입니다. j > i는 아직 만들지 않은 뒤쪽 토큰입니다.' },
    en: { name: 'Row and column numbers', meaning: 'The cell in row i, column j of the mask. i is the token being computed and j is the token it looks at. j > i is a later token that has not been produced yet.' },
  },
  M: {
    tex: 'M',
    kind: 'op',
    ko: { name: 'mask', meaning: '볼 수 없는 칸에 −∞를 더하는 행렬입니다. softmax 뒤 그 칸이 0이 됩니다. TurboVLA decoder는 mask가 없습니다(M = 0).' },
    en: { name: 'Mask', meaning: 'A matrix that adds −∞ to cells that must not be seen, so they become 0 after the softmax. The TurboVLA decoder uses none (M = 0).' },
  },
  // ---------------------------------------------------------------- loss 장난감
  iDemo: {
    tex: 'i',
    kind: 'index',
    ko: { name: '시연 번호', meaning: '이 창의 시연 5개 중 몇 번째인지입니다. 합 기호는 시연 5개의 차이를 모두 더합니다.' },
    en: { name: 'Demonstration number', meaning: 'Which of the 5 demonstrations in this window. The sum adds up the differences for all 5.' },
  },
  p: {
    tex: 'p',
    kind: 'output',
    ko: { name: '예측 값', meaning: '이 창에서 한 step의 예측 값(숫자 하나)입니다.' },
    en: { name: 'Prediction', meaning: 'The predicted value at one step in this window (a single number).' },
  },
  ai: {
    tex: String.raw`a^{*}_i`,
    kind: 'target',
    ko: { name: '시연의 정답 값', meaning: '이 창에서 i번째 시연이 그 step에 준 정답 값(숫자 하나)입니다.' },
    en: { name: 'Demonstration target', meaning: 'The target value that demonstration i gives at that step in this window (a single number).' },
  },
} satisfies Record<string, GlossEntry>

export type GlossKey = keyof typeof GLOSSARY

export function isGlossKey(key: string): key is GlossKey {
  return key in GLOSSARY
}

/** 기호를 풀이 key로 감싼다 (KaTeX \htmlClass). 마우스를 올리면 GlossaryTip이 풀이를 보인다 */
export function g(key: GlossKey, tex: string): string {
  return String.raw`\htmlClass{gl gl-${key}}{${tex}}`
}

/** TeX 안에 든 풀이 key를 나온 순서대로, 겹치지 않게 모은다 (수식 카드의 기호 표) */
export function glossKeys(tex: string): GlossKey[] {
  const out: GlossKey[] = []
  for (const m of tex.matchAll(/\bgl-([A-Za-z0-9_]+)/g)) {
    const key = m[1]
    if (isGlossKey(key) && !out.includes(key)) out.push(key)
  }
  return out
}
