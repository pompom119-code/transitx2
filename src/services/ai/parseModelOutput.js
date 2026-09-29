import { jsonrepair } from 'jsonrepair'

export class AiOutputError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'AiOutputError'
    this.code = code
    this.details = details
  }
}

function objectCandidates(output) {
  const candidates = []
  let start = -1
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = 0; index < output.length; index++) {
    const char = output[index]
    if (start < 0) {
      if (char === '{') { start = index; depth = 1 }
      continue
    }
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (!depth) {
        candidates.push(output.slice(start, index + 1))
        start = -1
      }
    }
  }
  if (start >= 0) candidates.push(output.slice(start))
  return candidates
}

export function parseModelOutput(content, { finishReason = 'stop' } = {}) {
  const output = typeof content === 'string' ? content.trim() : ''
  if (!output) throw new AiOutputError('NO_OUTPUT', '模型沒有輸出內容', { finishReason })
  if (output.length > 200000) throw new AiOutputError('OUTPUT_TOO_LARGE', '模型輸出超過安全長度', { finishReason })
  // A length stop can omit later itinerary items even when a repairer can close the JSON.
  if (finishReason === 'length') throw new AiOutputError('OUTPUT_TRUNCATED', '模型輸出達到 token 上限', { finishReason })
  const withoutThinking = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const candidates = objectCandidates(withoutThinking)
  if (!candidates.length) throw new AiOutputError('NO_JSON_OBJECT', '模型沒有提供 JSON 物件', { finishReason })
  for (const candidate of candidates) {
    try { return { value: JSON.parse(candidate), repaired: false } } catch { /* try repair */ }
    try { return { value: JSON.parse(jsonrepair(candidate)), repaired: true } } catch { /* try next object */ }
  }
  throw new AiOutputError('INVALID_JSON', '模型輸出的 JSON 無法修復', { finishReason, candidateCount: candidates.length })
}
