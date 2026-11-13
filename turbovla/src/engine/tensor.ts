// 2D Tensor와 기본 연산. 모두 row-major Float32Array.
// 브라우저에서 매 설정 변경마다 forward 전체를 다시 계산하므로, 안쪽 루프는 단순한 typed-array 루프로 쓴다.

export interface Tensor {
  rows: number
  cols: number
  /** row-major: (r, c) = data[r * cols + c] */
  data: Float32Array
  /** 화면과 디버깅용 이름 (예: "V^3") */
  label: string
}

export function tensor(rows: number, cols: number, label = '', data?: Float32Array): Tensor {
  const buffer = data ?? new Float32Array(rows * cols)
  if (buffer.length !== rows * cols) {
    throw new Error(`tensor ${label}: data length ${buffer.length} does not match ${rows} × ${cols}`)
  }
  return { rows, cols, data: buffer, label }
}

/** 모양 이름표. 곱셈 식과 헷갈리지 않게 대괄호로 감싼다 (예: [1 × 8]) */
export function shapeOf(t: Tensor): string {
  return `[${t.rows} × ${t.cols}]`
}

export function get(t: Tensor, r: number, c: number): number {
  return t.data[r * t.cols + c]
}

/** 한 행을 복사 없이 본다 */
export function rowView(t: Tensor, r: number): Float32Array {
  return t.data.subarray(r * t.cols, (r + 1) * t.cols)
}

export function fromRows(rows: ArrayLike<number>[], label = ''): Tensor {
  const cols = rows.length ? rows[0].length : 0
  const out = tensor(rows.length, cols, label)
  rows.forEach((row, r) => {
    if (row.length !== cols) throw new Error(`fromRows ${label}: ragged row ${r}`)
    out.data.set(row as ArrayLike<number>, r * cols)
  })
  return out
}

export function clone(t: Tensor, label = t.label): Tensor {
  return tensor(t.rows, t.cols, label, new Float32Array(t.data))
}

export function relabel(t: Tensor, label: string): Tensor {
  return { ...t, label }
}

/** a (n × k) · b (k × m) */
export function matmul(a: Tensor, b: Tensor, label = ''): Tensor {
  if (a.cols !== b.rows) throw new Error(`matmul ${label}: ${shapeOf(a)} · ${shapeOf(b)}`)
  const n = a.rows
  const k = a.cols
  const m = b.cols
  const A = a.data
  const B = b.data
  const out = new Float32Array(n * m)
  for (let i = 0; i < n; i++) {
    const oi = i * m
    const ai = i * k
    for (let p = 0; p < k; p++) {
      const av = A[ai + p]
      if (av === 0) continue
      const bp = p * m
      for (let j = 0; j < m; j++) out[oi + j] += av * B[bp + j]
    }
  }
  return tensor(n, m, label, out)
}

/** a (n × k) · bᵀ, b는 (m × k) */
export function matmulBT(a: Tensor, b: Tensor, label = ''): Tensor {
  if (a.cols !== b.cols) throw new Error(`matmulBT ${label}: ${shapeOf(a)} · (${shapeOf(b)})ᵀ`)
  const n = a.rows
  const k = a.cols
  const m = b.rows
  const A = a.data
  const B = b.data
  const out = new Float32Array(n * m)
  for (let i = 0; i < n; i++) {
    const ai = i * k
    for (let j = 0; j < m; j++) {
      const bj = j * k
      let sum = 0
      for (let p = 0; p < k; p++) sum += A[ai + p] * B[bj + p]
      out[i * m + j] = sum
    }
  }
  return tensor(n, m, label, out)
}

/** aᵀ · b. a는 (k × n), b는 (k × m), 결과는 (n × m) */
export function matmulAT(a: Tensor, b: Tensor, label = ''): Tensor {
  if (a.rows !== b.rows) throw new Error(`matmulAT ${label}: (${shapeOf(a)})ᵀ · ${shapeOf(b)}`)
  const k = a.rows
  const n = a.cols
  const m = b.cols
  const A = a.data
  const B = b.data
  const out = new Float32Array(n * m)
  for (let p = 0; p < k; p++) {
    const ap = p * n
    const bp = p * m
    for (let i = 0; i < n; i++) {
      const av = A[ap + i]
      if (av === 0) continue
      const oi = i * m
      for (let j = 0; j < m; j++) out[oi + j] += av * B[bp + j]
    }
  }
  return tensor(n, m, label, out)
}

export function transpose(t: Tensor, label = ''): Tensor {
  const out = new Float32Array(t.rows * t.cols)
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) out[c * t.rows + r] = t.data[r * t.cols + c]
  }
  return tensor(t.cols, t.rows, label, out)
}

function assertSameShape(a: Tensor, b: Tensor, op: string): void {
  if (a.rows !== b.rows || a.cols !== b.cols) throw new Error(`${op}: ${shapeOf(a)} vs ${shapeOf(b)}`)
}

/** a + s · b */
export function addScaled(a: Tensor, b: Tensor, s: number, label = ''): Tensor {
  assertSameShape(a, b, 'addScaled')
  const out = new Float32Array(a.data.length)
  for (let i = 0; i < out.length; i++) out[i] = a.data[i] + s * b.data[i]
  return tensor(a.rows, a.cols, label, out)
}

export function add(a: Tensor, b: Tensor, label = ''): Tensor {
  return addScaled(a, b, 1, label)
}

export function scale(a: Tensor, s: number, label = ''): Tensor {
  const out = new Float32Array(a.data.length)
  for (let i = 0; i < out.length; i++) out[i] = a.data[i] * s
  return tensor(a.rows, a.cols, label, out)
}

/** 모든 행에 같은 벡터(bias)를 더한다 */
export function addRowVector(a: Tensor, v: Float32Array, label = ''): Tensor {
  if (v.length !== a.cols) throw new Error(`addRowVector: ${a.cols} vs ${v.length}`)
  const out = new Float32Array(a.data)
  for (let r = 0; r < a.rows; r++) {
    const o = r * a.cols
    for (let c = 0; c < a.cols; c++) out[o + c] += v[c]
  }
  return tensor(a.rows, a.cols, label, out)
}

/** 행마다 LayerNorm. 학습 scale/bias는 1/0으로 둔다 (caveat layer-norm-affine). */
export function layerNorm(x: Tensor, label = '', eps = 1e-5): Tensor {
  const out = new Float32Array(x.data.length)
  const n = x.cols
  const X = x.data
  for (let r = 0; r < x.rows; r++) {
    const o = r * n
    let sum = 0
    let sumSq = 0
    for (let c = 0; c < n; c++) {
      const v = X[o + c]
      sum += v
      sumSq += v * v
    }
    const mean = sum / n
    const variance = Math.max(0, sumSq / n - mean * mean)
    const inv = 1 / Math.sqrt(variance + eps)
    for (let c = 0; c < n; c++) out[o + c] = (X[o + c] - mean) * inv
  }
  return tensor(x.rows, x.cols, label, out)
}

export interface SoftmaxOptions {
  /** logits를 이 값으로 나눈다 (설명용 attention 온도) */
  temperature?: number
  /** 열(key) 단위 mask. 1이면 그 key를 가린다 */
  keyMask?: Uint8Array | null
  /** (행 × 열) 단위 허용 mask. 0이면 가린다 */
  allowed?: Uint8Array | null
}

/** 행 단위 softmax. 가려진 칸은 정확히 0이 된다. */
export function softmaxRows(logits: Tensor, label = '', options: SoftmaxOptions = {}): Tensor {
  const { temperature = 1, keyMask = null, allowed = null } = options
  const rows = logits.rows
  const cols = logits.cols
  if (keyMask && keyMask.length !== cols) throw new Error('softmaxRows: keyMask length')
  if (allowed && allowed.length !== rows * cols) throw new Error('softmaxRows: allowed size')
  const out = new Float32Array(rows * cols)
  const inv = 1 / temperature
  const L = logits.data
  if (!keyMask && !allowed) {
    // 가리는 칸이 없을 때의 빠른 경로
    for (let r = 0; r < rows; r++) {
      const o = r * cols
      let max = -Infinity
      for (let c = 0; c < cols; c++) if (L[o + c] > max) max = L[o + c]
      max *= inv
      let sum = 0
      for (let c = 0; c < cols; c++) {
        const e = Math.exp(L[o + c] * inv - max)
        out[o + c] = e
        sum += e
      }
      const norm = 1 / sum
      for (let c = 0; c < cols; c++) out[o + c] *= norm
    }
    return tensor(rows, cols, label, out)
  }
  for (let r = 0; r < rows; r++) {
    const o = r * cols
    let max = -Infinity
    for (let c = 0; c < cols; c++) {
      if ((keyMask && keyMask[c]) || (allowed && !allowed[o + c])) continue
      const v = logits.data[o + c] * inv
      if (v > max) max = v
    }
    if (max === -Infinity) continue // 모든 칸이 가려진 행은 0으로 둔다
    let sum = 0
    for (let c = 0; c < cols; c++) {
      if ((keyMask && keyMask[c]) || (allowed && !allowed[o + c])) continue
      const e = Math.exp(logits.data[o + c] * inv - max)
      out[o + c] = e
      sum += e
    }
    const norm = 1 / sum
    for (let c = 0; c < cols; c++) out[o + c] *= norm
  }
  return tensor(rows, cols, label, out)
}

/**
 * 같은 score S (n × m)에서 두 방향의 softmax를 한 번에 만든다.
 *   rowWise = 행 softmax(S)  (열 key mask 가능),  colWise = 행 softmax(Sᵀ) (m × n)
 * exp는 한 번만 계산한다. softmax는 상수를 빼도 결과가 같으므로, 전체 최댓값을 뺀 exp를 행과 열로 따로 정규화하면
 * 두 번 따로 계산한 것과 같다 (attention.test.ts가 확인). score 범위가 ±80을 넘으면 정밀도가 떨어지므로 그때는 따로 계산한다.
 */
export function biSoftmax(
  S: Tensor,
  temperature = 1,
  keyMask: Uint8Array | null = null,
  labels: [string, string] = ['', ''],
): { rowWise: Tensor; colWise: Tensor } {
  const n = S.rows
  const m = S.cols
  const inv = 1 / temperature
  const X = S.data
  let max = -Infinity
  let min = Infinity
  for (let i = 0; i < X.length; i++) {
    if (X[i] > max) max = X[i]
    if (X[i] < min) min = X[i]
  }
  if ((max - min) * inv > 80) {
    return {
      rowWise: softmaxRows(S, labels[0], { temperature, keyMask }),
      colWise: softmaxRows(transpose(S), labels[1], { temperature }),
    }
  }
  const E = new Float64Array(n * m)
  for (let i = 0; i < E.length; i++) E[i] = Math.exp((X[i] - max) * inv)
  const row = new Float32Array(n * m)
  for (let i = 0; i < n; i++) {
    const o = i * m
    let sum = 0
    for (let j = 0; j < m; j++) if (!keyMask || !keyMask[j]) sum += E[o + j]
    const norm = sum > 0 ? 1 / sum : 0
    for (let j = 0; j < m; j++) row[o + j] = keyMask && keyMask[j] ? 0 : E[o + j] * norm
  }
  const colSum = new Float64Array(m)
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) colSum[j] += E[i * m + j]
  const col = new Float32Array(m * n)
  for (let j = 0; j < m; j++) {
    const norm = 1 / colSum[j]
    for (let i = 0; i < n; i++) col[j * n + i] = E[i * m + j] * norm
  }
  return { rowWise: tensor(n, m, labels[0], row), colWise: tensor(m, n, labels[1], col) }
}

export function map(t: Tensor, fn: (v: number) => number, label = ''): Tensor {
  const out = new Float32Array(t.data.length)
  for (let i = 0; i < out.length; i++) out[i] = fn(t.data[i])
  return tensor(t.rows, t.cols, label, out)
}

export const relu = (t: Tensor, label = '') => map(t, (v) => (v > 0 ? v : 0), label)

export const tanh = (t: Tensor, label = '') => map(t, Math.tanh, label)

/** erf 근사 (Abramowitz & Stegun 7.1.26, 오차 1.5e-7) */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}

/** exact GELU (PyTorch nn.GELU 기본값) */
export const gelu = (t: Tensor, label = '') => map(t, (v) => 0.5 * v * (1 + erf(v / Math.SQRT2)), label)

export function concatRows(parts: Tensor[], label = ''): Tensor {
  if (!parts.length) throw new Error('concatRows: empty')
  const cols = parts[0].cols
  const rows = parts.reduce((sum, p) => {
    if (p.cols !== cols) throw new Error(`concatRows: cols ${p.cols} vs ${cols}`)
    return sum + p.rows
  }, 0)
  const out = new Float32Array(rows * cols)
  let offset = 0
  for (const p of parts) {
    out.set(p.data, offset)
    offset += p.data.length
  }
  return tensor(rows, cols, label, out)
}

export function sliceRows(t: Tensor, start: number, end: number, label = ''): Tensor {
  return tensor(end - start, t.cols, label, t.data.slice(start * t.cols, end * t.cols))
}

export function rowSums(t: Tensor): Float32Array {
  const out = new Float32Array(t.rows)
  for (let r = 0; r < t.rows; r++) {
    let sum = 0
    for (let c = 0; c < t.cols; c++) sum += t.data[r * t.cols + c]
    out[r] = sum
  }
  return out
}

export function maxAbsDiff(a: Tensor, b: Tensor): number {
  assertSameShape(a, b, 'maxAbsDiff')
  let max = 0
  for (let i = 0; i < a.data.length; i++) max = Math.max(max, Math.abs(a.data[i] - b.data[i]))
  return max
}
