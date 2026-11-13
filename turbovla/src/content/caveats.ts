// 기술적 주의 (technical caveats)의 화면 문구. ID와 조건은 engine/caveats.ts.
// 문구 규칙: 명사만 잇지 말고 말하듯 쓴다.

import type { CaveatId } from '../engine/caveats'
import type { Lang } from './i18n'

export interface CaveatCopy {
  title: string
  body: string
}

export const CAVEATS: Record<CaveatId, Record<Lang, CaveatCopy>> = {
  'virtual-values': {
    ko: {
      title: '모든 값은 가상 값입니다',
      body: '입력 feature, 가중치, 중간값, 출력이 모두 설명을 위해 만든 값입니다. 텐서 모양과 연산 순서만 지금 고른 기준(논문 또는 공식 코드)을 따릅니다.',
    },
    en: {
      title: 'Every value is made up',
      body: 'Input features, weights, intermediate values, and outputs are all invented for illustration. Only the tensor shapes and the order of operations follow the basis you picked (paper or official code).',
    },
  },
  'encoders-not-run': {
    ko: {
      title: 'DINOv3와 BERT를 실행하지 않습니다',
      body: '이미지 feature와 단어 feature(식의 P_v(f_img(I))와 P_l(f_text(x)))는 encoder를 돌리지 않고 장면 그림과 단어 사전에서 바로 만듭니다. 그래서 DINOv3의 768/1,024차원 출력과 BERT의 768차원 출력은 화면에 나오지 않습니다. 단어 feature는 그 단어와 자리 번호만으로 정해서 문장의 다른 단어에 영향을 받지 않습니다. 실제 BERT는 문장 전체 문맥을 반영한 feature를 냅니다.',
    },
    en: {
      title: 'DINOv3 and BERT are not run',
      body: 'The image and word features (P_v(f_img(I)) and P_l(f_text(x)) in the equations) are built directly from the scene drawing and a small word list, without running the encoders. That is why the 768/1,024-dim DINOv3 output and the 768-dim BERT output never appear on screen. Each word feature depends only on the word and its slot, not on the rest of the sentence. Real BERT gives every token a feature that reflects the whole sentence.',
    },
  },
  'scene-views': {
    ko: {
      title: '카메라 view는 한 장의 그림을 잘라 낸 것입니다',
      body: '장면은 탁상을 위에서 내려다본 그림 한 장이고, 카메라 view는 그 그림을 축에 맞춰 잘라 확대한 것입니다. 실제 wrist 카메라는 팔과 함께 움직이며 비스듬히 보지만, 여기서는 위치가 고정되어 있고 state를 바꿔도 그림은 그대로입니다. left, right, far, near 개념 채널은 이미지 안의 위치가 아니라 탁상 좌표에서 정합니다.',
    },
    en: {
      title: 'Camera views are crops of one drawing',
      body: 'The scene is a single top-down drawing of the table, and each camera view is an axis-aligned, zoomed crop of it. A real wrist camera moves with the arm and looks at an angle; here it stays put, and changing the state does not change the picture. The left, right, far, and near concept channels come from table coordinates, not from the position inside the image.',
    },
  },
  'concept-channels': {
    ko: {
      title: 'feature 차원에 뜻을 정해 두었습니다',
      body: 'd = 256 중 앞 24차원을 bowl, blue, left, stack 같은 개념 채널로 정했고, 32–127은 질감, 128–223은 위치, 224–255는 카메라에 씁니다. 실제 모델의 feature에는 이런 구획이 없습니다.',
    },
    en: {
      title: 'Feature dimensions have assigned meanings',
      body: 'The first 24 of the 256 dimensions are concept channels such as bowl, blue, left, and stack. Dimensions 32–127 hold texture, 128–223 position, and 224–255 the camera. Real model features have no such layout.',
    },
  },
  'head-roles': {
    ko: {
      title: 'head마다 역할을 정해 두었습니다',
      body: 'interaction과 decoder의 head마다 맡는 개념 묶음을 정했습니다. 예를 들어 물체와 색, 위치, 동작과 관계, state, 잡음 같은 식입니다. 학습된 실제 head가 이렇게 나뉜다는 근거는 없습니다.',
    },
    en: {
      title: 'Each head has an assigned role',
      body: 'Every interaction and decoder head is given a group of concepts, such as objects and colors, position, actions and relations, the robot state, or just noise. There is no evidence that trained heads split up this way.',
    },
  },
  'designed-queries': {
    ko: {
      title: 'action query와 state 경로도 설계한 것입니다',
      body: 'action query는 물체, 색, 동작 개념을 찾고, 앞쪽 step일수록 state 토큰을 더 찾도록 만들었습니다. state encoder(f_state)의 마지막 Linear는 state 토큰이 개념 채널 proprio에 크게 쓰도록 정했고, decoder의 state head가 그 채널을 찾습니다. query 자체는 지시문과 무관하고(실제 learned query처럼), 지시 정보는 memory 쪽에 있습니다. 학습된 실제 모델이 이렇게 동작한다는 근거는 없습니다.',
    },
    en: {
      title: 'Action queries and the state path are designed',
      body: 'The action queries are built to look for objects, colors, and actions, and earlier steps look more at the state tokens. The last Linear of the state encoder (f_state) is set up to write strongly into the proprio concept channel, and a decoder state head looks for that channel. The queries themselves do not depend on the instruction (like real learned queries); the instruction information lives in the memory. There is no evidence that a trained model behaves this way.',
    },
  },
  'low-rank-weights': {
    ko: {
      title: '가중치는 구조가 있는 가상 행렬입니다',
      body: 'attention의 projection(W_Q, W_K, W_V, W_O)은 개념 채널 24칸을 읽고 쓰는 저랭크 행렬(rank 24 이하)입니다. FFN(rank 8)과 출력 MLP(rank 16)는 개념 채널과 무관한 무작위 저랭크 행렬이고, 크기가 작은 f_state만 dense 행렬을 그대로 씁니다. 행렬 모양(예: [256 × 1,024])과 연산 결과는 그대로이고, 계산 순서만 결합법칙으로 바꿔 브라우저에서 빠르게 돌립니다. 두 계산이 같다는 것은 단위 테스트로 확인했습니다. 실제 학습된 가중치는 full-rank입니다.',
    },
    en: {
      title: 'Weights are structured stand-ins',
      body: 'The attention projections (W_Q, W_K, W_V, W_O) are low-rank matrices (rank 24 or less) that read and write the 24 concept channels. The FFNs (rank 8) and the output MLP (rank 16) are random low-rank matrices unrelated to the concept channels, and only the small f_state uses plain dense matrices. Matrix shapes (such as [256 × 1,024]) and results are unchanged; only the order of multiplication is rearranged so the browser can keep up. Unit tests check that both orders give the same result. Real trained weights are full-rank.',
    },
  },
  'layer-norm-affine': {
    ko: {
      title: 'LayerNorm의 학습 값은 1과 0으로 둡니다',
      body: 'LayerNorm에는 학습되는 scale과 bias가 있지만, 여기서는 1과 0으로 두고 정규화만 합니다.',
    },
    en: {
      title: 'LayerNorm uses scale 1 and bias 0',
      body: 'LayerNorm normally has a learned scale and bias. Here they are fixed at 1 and 0, so it only normalizes.',
    },
  },
  temperature: {
    ko: {
      title: 'attention 온도는 설명용입니다',
      body: '논문에는 없는 값입니다. softmax에 넣기 전에 score를 이 값으로 나눕니다. 1이면 원래 식과 같습니다.',
    },
    en: {
      title: 'Attention temperature is for illustration',
      body: 'The paper has no such setting. Scores are divided by this value before the softmax; at 1 the formula is unchanged.',
    },
  },
  tokenizer: {
    ko: {
      title: '토큰화는 흉내 낸 것입니다',
      body: '소문자로 바꾼 뒤 단어(영문자와 숫자 묶음)와 문장부호를 따로 떼어 토큰으로 만들고 [CLS]와 [SEP]을 붙였습니다. 실제 BERT는 WordPiece라서 한 단어가 여러 토큰이 될 수 있습니다(예: ketchup → ke ##tch ##up). 공식 코드 기준(LIBERO)에서는 21칸에 맞추려고 [CLS]와 [SEP] 사이에 19개까지만 남깁니다.',
    },
    en: {
      title: 'Tokenization is simplified',
      body: 'The instruction is lowercased, split into words (runs of letters and digits) and punctuation marks, and wrapped in [CLS] and [SEP]. Real BERT uses WordPiece, so one word can become several tokens (for example, ketchup → ke ##tch ##up). Under the official-code basis with LIBERO, only the first 19 tokens are kept between [CLS] and [SEP] so that everything fits in 21 slots.',
    },
  },
  'inference-only': {
    ko: {
      title: '추론만 보여 줍니다',
      body: 'dropout과 drop path는 끄고, 학습(loss와 역전파)은 하지 않습니다. 계산은 float32로 합니다. 공식 평가는 bf16입니다.',
    },
    en: {
      title: 'Inference only',
      body: 'Dropout and drop path are off, and there is no training (no loss or backpropagation). Everything runs in float32, while the official evaluation uses bf16.',
    },
  },
  'internals-from-code': {
    ko: {
      title: '논문에 없는 내부 구조는 공식 코드를 따릅니다',
      body: '논문이 말하지 않는 부분은 두 기준 모두 공식 코드를 따랐습니다. interaction attention은 두 방향이 Q·K projection과 score 행렬 하나를 같이 쓰고, 기본값인 head 4개에서 head 하나의 차원은 256입니다(내부 차원 1,024를 head 수로 나눈 값). state encoder(f_state)는 LayerNorm, Linear, GELU, Linear를 거친 출력을 나눠 state 토큰을 만듭니다(공식 코드는 2개). decoder는 층마다 입력을 먼저 정규화한 뒤 query끼리 self-attention을 하고, 이어서 memory에 cross-attention을 하고, 마지막으로 FFN을 거칩니다. decoder에서는 mask를 쓰지 않습니다.',
    },
    en: {
      title: 'Internals the paper leaves out follow the official code',
      body: 'Wherever the paper is silent, both bases follow the official code. In the interaction attention, the two directions share one Q·K projection and one score matrix, and with the default 4 heads each head has 256 dimensions (the inner dimension 1,024 divided by the head count). The state encoder (f_state) runs LayerNorm, Linear, GELU, and Linear, then splits the output into state tokens (two in the official code). In each decoder layer the input is normalized first, then the queries attend to each other, then they attend to the memory, and finally they pass through an FFN. The decoder uses no masks.',
    },
  },
  'attention-maps': {
    ko: {
      title: 'attention 그림은 설명용입니다',
      body: '논문에는 attention map 그림이 없습니다. 여기 보이는 attention은 가상 가중치와 설계한 개념 채널에서 나온 값이라, 학습된 TurboVLA가 실제로 어디를 보는지 보여 주지 않습니다. “bowls”를 고르면 그릇 patch가 진해지는 것도 그렇게 되도록 장면과 가중치를 설계했기 때문입니다.',
    },
    en: {
      title: 'The attention pictures are for illustration',
      body: 'The paper has no attention-map figures. The attention shown here comes from made-up weights and designed concept channels, so it does not show where the trained TurboVLA actually looks. Bowl patches light up for “bowls” because the scene and weights were designed to do that.',
    },
  },
  'action-script': {
    ko: {
      title: 'action 그래프는 스크립트입니다',
      body: 'decoder 출력이 아니라, 목표 물체로 다가가 잡는 궤적을 따로 그렸습니다. 목표 물체는 이렇게 고릅니다. 지시문의 첫 물체 단어(bowl이나 plate, 바로 앞에 색 단어가 있으면 그 색 단어)를 Query로 두고 첫 interaction 층의 L←V attention을 봅니다. 물체마다 그 물체가 보이는 patch의 attention을 평균해서, 평균이 가장 큰 물체를 목표로 삼습니다. 한 방향 모드에서 L←V 갱신이 꺼져 있어도 이 attention은 계산되므로 그대로 씁니다. w/o Interaction 모드이거나 지시문에 물체 단어가 없으면 decoder 마지막 층 cross-attention이 가장 많이 간 물체를 고릅니다. 이때는 patch에 지시 정보가 없어서 지시와 다른 물체로 갈 수 있습니다. 가상 가중치의 한계이고, 논문의 w/o Interaction 성공률과는 관계없습니다. decoder가 실제로 계산한 출력은 가상 가중치라 의미가 없어서 따로 보여 줍니다.',
    },
    en: {
      title: 'The action plot is scripted',
      body: 'It is not the decoder output. It is a trajectory that reaches for a target object. The target is chosen with the first object word in the instruction (bowl or plate, or the color word right before it, if there is one) as the Query: the object whose visible patches get the highest average first-layer L←V attention wins. This attention is computed even when a one-way mode switches the L←V update off, so the same rule applies there. In the w/o Interaction mode, or when the instruction has no object word, the target is the object that the last decoder layer’s cross-attention looks at most. In that case the patches carry no instruction information, so the arm may head for the wrong object. That is a limit of the made-up weights and has nothing to do with the paper’s w/o Interaction result. The real decoder output is shown separately; with made-up weights it carries no meaning.',
    },
  },
  'epos-values': {
    ko: {
      title: 'E_pos 값은 설명용입니다',
      body: '2D sinusoidal로 만든 값입니다. 논문은 E_pos의 형태를 말하지 않고, LIBERO 공식 코드에는 이 항이 아예 없습니다.',
    },
    en: {
      title: 'E_pos values are illustrative',
      body: 'They are 2D sinusoids. The paper does not say what form E_pos takes, and the official LIBERO code has no such term at all.',
    },
  },
  'residual-placement': {
    ko: {
      title: 'residual 위치는 가정입니다',
      body: 'Eq. 7을 글자 그대로 읽어, 정규화하기 전 값에 attention 출력을 더합니다. 논문은 LayerNorm과 residual의 관계를 말하지 않습니다.',
    },
    en: {
      title: 'Residual placement is an assumption',
      body: 'Eq. 7 is read literally: the attention output is added to the value before normalization. The paper does not say how LayerNorm and the residual relate.',
    },
  },
  'text-block-omitted': {
    ko: {
      title: '텍스트 블록(self-attention과 FFN)을 계산하지 않습니다',
      body: '공식 코드는 cross-attention 뒤에 텍스트 쪽만 self-attention과 FFN을 한 번 더 거칩니다. 논문 기준에서는 이 블록을 표시만 합니다.',
    },
    en: {
      title: 'The text block (self-attention and FFN) is skipped',
      body: 'In the official code, the text stream goes through one more self-attention and FFN after the cross-attention. Under the paper basis this block is only marked, not computed.',
    },
  },
  'gamma-virtual': {
    ko: {
      title: 'γ 값은 가상입니다',
      body: 'layer scale γ와 RoboTwin E_pos의 scale은 실제 값이 checkpoint에 있어 알 수 없습니다. 공식 코드에서 γ는 층마다, 방향마다 따로 있는 256차원 벡터라서 채널마다 곱하는 값이 다릅니다. 여기서는 모든 층, 방향, 채널에 같은 값 0.5를 곱하고, E_pos scale도 view마다 0.5로 둡니다. 변화가 눈에 보이도록 고른 값입니다.',
    },
    en: {
      title: 'γ is a made-up value',
      body: 'The real layer scale γ and the RoboTwin E_pos scale live in the checkpoint and are unknown. In the official code, γ is a 256-dim vector for each layer and each direction, so every channel gets its own factor. Here every layer, direction, and channel is multiplied by the same 0.5, and the E_pos scale is 0.5 for every view. The value was picked so that the effect is visible.',
    },
  },
  'subsentence-mask': {
    ko: {
      title: '텍스트 self-attention은 코드의 문장 mask를 씁니다',
      body: '공식 코드처럼 [CLS], [SEP], 마침표, 물음표를 경계로 블록을 만들고, 블록 안의 토큰끼리만 서로 봅니다. [CLS]와 [PAD]는 자기 자신만 봅니다. 맨 끝 칸의 경계 토큰은 블록을 열지 않으므로, [SEP]이 맨 끝 칸이면(RoboTwin처럼 padding이 없을 때) 마지막 마침표나 물음표 뒤의 단어(없으면 모든 단어)가 자기 자신만 봅니다. 이것도 코드 그대로입니다. 공식 코드는 LIBERO 벤치마크 지시문 40개를 suite별 길이(11, 14, 21)로 따로 다루지만, 여기서는 LIBERO 지시문을 모두 21칸으로 다룹니다. RoboTwin은 padding 없이 실제 토큰 수만큼입니다.',
    },
    en: {
      title: 'Text self-attention uses the code’s sentence mask',
      body: 'As in the official code, [CLS], [SEP], periods, and question marks mark block boundaries, and tokens only see others in the same block. [CLS] and [PAD] see only themselves. A boundary token in the very last slot opens no block, so when [SEP] is last (no padding, as in RoboTwin) the words after the last period or question mark (all words, if there is none) see only themselves. That also matches the code. The official code handles the 40 LIBERO benchmark instructions with per-suite lengths (11, 14, 21); here every LIBERO instruction uses 21 slots, while RoboTwin uses the real token count (no padding).',
    },
  },
  'interaction-modes': {
    ko: {
      title: '한 방향 모드와 w/o Interaction 모드는 가정입니다',
      body: '공식 코드에는 이 모드가 없습니다. 한 방향 모드는 꺼진 방향의 갱신만 빼서 구현했고, 공식 코드 기준에서는 텍스트 블록(self-attention과 FFN)도 그대로 남깁니다. w/o Interaction 모드는 interaction 층 전체를 건너뜁니다(공식 코드 기준의 텍스트 블록도 포함). 그래서 이미지 토큰과 지시 토큰을 섞지 않은 채 이어 붙여 decoder에 넘기고, interaction 층이 0개(N = 0)인 것과 같습니다. 논문의 “w/o Interaction” 실험이 정확히 이렇게 했는지는 알 수 없습니다.',
    },
    en: {
      title: 'The one-way modes and the w/o Interaction mode are assumptions',
      body: 'The official code has no such modes. In a one-way mode, only the switched-off direction stops updating; under the official-code basis the text block (self-attention and FFN) still runs. The “No mixing” mode skips the interaction layers entirely (including the text block under the official-code basis), so the image tokens and instruction tokens are stacked unmixed and handed to the decoder, the same as having zero interaction layers (N = 0). Whether the paper’s “w/o Interaction” run did exactly this is unknown.',
    },
  },
  'real-robot-shapes': {
    ko: {
      title: '실제 로봇 과제지만 모양은 프리셋 값입니다',
      body: '“Stack the three bowls”는 논문의 실제 로봇 실험 과제입니다. 실제 로봇의 이미지 크기와 state, action 차원은 논문에 없어서, 텐서 모양은 지금 고른 프리셋을 따릅니다.',
    },
    en: {
      title: 'A real-robot task with preset shapes',
      body: '“Stack the three bowls” is the paper’s real-robot task. The paper does not give the real robot’s image size or state and action sizes, so the tensor shapes follow the current preset.',
    },
  },
  'robotwin-execution': {
    ko: {
      title: 'RoboTwin 실행 방식은 논문에 없습니다',
      body: '공식 평가 설정은 매 step 다시 예측하고 겹치는 chunk를 평균합니다(temporal ensemble). 논문의 RoboTwin 숫자가 이 방식으로 나왔는지는 알 수 없습니다.',
    },
    en: {
      title: 'RoboTwin execution is not in the paper',
      body: 'The official evaluation config predicts again at every step and averages the overlapping chunks (temporal ensembling). Whether the paper’s RoboTwin numbers used this is unknown.',
    },
  },
}

/**
 * caveat의 종류. 화면의 주의 표시와 패널에 이름표로 단다.
 * - assumption (가정): 논문이 말하지 않거나 알 수 없어서 정한 것
 * - simplification (단순화): 설명하려고 실제 모델과 다르게 만든 것
 */
export type CaveatKind = 'assumption' | 'simplification'

export const CAVEAT_KIND: Record<CaveatId, CaveatKind> = {
  'virtual-values': 'simplification',
  'encoders-not-run': 'simplification',
  'scene-views': 'simplification',
  'concept-channels': 'simplification',
  'head-roles': 'simplification',
  'attention-maps': 'simplification',
  'designed-queries': 'simplification',
  'low-rank-weights': 'simplification',
  'layer-norm-affine': 'simplification',
  temperature: 'simplification',
  tokenizer: 'simplification',
  'inference-only': 'simplification',
  'internals-from-code': 'assumption',
  'action-script': 'simplification',
  'epos-values': 'assumption',
  'residual-placement': 'assumption',
  'text-block-omitted': 'assumption',
  'gamma-virtual': 'simplification',
  'subsentence-mask': 'simplification',
  'interaction-modes': 'assumption',
  'real-robot-shapes': 'assumption',
  'robotwin-execution': 'assumption',
}

/** 설정에 따라 해당하는 caveat의 조건 ("언제" 해당하는지). 늘 해당하는 caveat에는 없다 */
export const CAVEAT_WHEN: Partial<Record<CaveatId, Record<Lang, string>>> = {
  'epos-values': { ko: '논문 기준일 때', en: 'Paper basis' },
  'residual-placement': { ko: '논문 기준이고 모드가 w/o Interaction이 아닐 때', en: 'Paper basis, in any mode except w/o Interaction' },
  'text-block-omitted': { ko: '논문 기준이고 모드가 w/o Interaction이 아닐 때', en: 'Paper basis, in any mode except w/o Interaction' },
  'gamma-virtual': { ko: '공식 코드 기준에서 모드가 w/o Interaction이 아니거나 RoboTwin 설정일 때', en: 'Official code basis, and either a mode other than w/o Interaction or RoboTwin' },
  'subsentence-mask': { ko: '공식 코드 기준이고 모드가 w/o Interaction이 아닐 때', en: 'Official code basis, in any mode except w/o Interaction' },
  'interaction-modes': { ko: '모드가 “양방향”이 아닐 때', en: 'Any mode except “Both ways”' },
  'real-robot-shapes': { ko: '지시문이 “Stack the three bowls”일 때', en: 'The instruction “Stack the three bowls”' },
  'robotwin-execution': { ko: 'RoboTwin 2.0 설정일 때', en: 'RoboTwin 2.0 setup' },
}
