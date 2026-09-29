import { AiOutputError, parseModelOutput } from './parseModelOutput.js'

export const LOCAL_MODEL = 'Qwen3-1.7B-q4f16_1-MLC'
let enginePromise

export function localCapability() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return { supported: false, reason: '此瀏覽器沒有 WebGPU；本機 AI 無法執行。可改用支援 WebGPU 的瀏覽器。' }
  return { supported: true, reason: '' }
}

export const localModel = {
  async prepare(onProgress, signal) {
    const capability = localCapability()
    if (!capability.supported) throw new Error(capability.reason)
    let lastProgress = Date.now()
    if (!enginePromise) enginePromise = import('@mlc-ai/web-llm').then(({ CreateMLCEngine }) => CreateMLCEngine(LOCAL_MODEL, {
      initProgressCallback(report) {
        lastProgress = Date.now()
        onProgress?.({ step: 0, label: '正在下載／準備本機 AI 模型', downloadPercent: Math.round((report.progress || 0) * 100), detail: report.text || '' })
      },
    })).catch(error => { enginePromise = null; throw new Error(`本機 AI 模型載入失敗：${error.message}`) })
    let timer, interval, onAbort
    try {
      await Promise.race([enginePromise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('本機 AI 模型載入超過 20 分鐘，請檢查網路後重試。')), 1200000)
        interval = setInterval(() => { if (Date.now() - lastProgress > 600000) reject(new Error('本機 AI 模型下載沒有進度，請檢查模型 CDN 連線或改用伺服器 AI。')) }, 10000)
        onAbort = () => reject(signal.reason || new Error('已取消規劃'))
        signal?.addEventListener('abort', onAbort, { once: true })
      })])
    } finally {
      clearTimeout(timer); clearInterval(interval)
      signal?.removeEventListener('abort', onAbort)
    }
  },
  async generateRaw(system, prompt, schema, signal) {
    const engine = await enginePromise
    if (!engine) throw new Error('本機 AI 尚未準備好')
    if (signal?.aborted) throw signal.reason || new Error('已取消規劃')
    const maxTokens = schema.properties?.travelApproach ? 700 : schema.properties?.items ? 1500 : 500
    let timer, onAbort
    const inference = engine.chat.completions.create({
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.7, top_p: 0.8, top_k: 20, presence_penalty: 1.5, frequency_penalty: 0,
      max_tokens: maxTokens, enable_thinking: false,
      response_format: { type: 'json_object', schema: JSON.stringify(schema) },
    })
    let reply
    try {
      reply = await Promise.race([inference, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new AiOutputError('INFERENCE_TIMEOUT', '本機模型推論逾時')), 180000)
        onAbort = () => reject(signal.reason || new Error('已取消規劃'))
        signal?.addEventListener('abort', onAbort, { once: true })
      })])
    } catch (error) {
      try { await engine.interruptGenerate?.() } catch { /* keep the original error */ }
      throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    if (signal?.aborted) throw signal.reason || new Error('已取消規劃')
    const raw = {
      content: reply.choices?.[0]?.message?.content || '',
      finishReason: reply.choices?.[0]?.finish_reason || 'unknown',
      usage: reply.usage || null,
    }
    if (import.meta.env.DEV) console.debug('[TransitX local AI raw]', { model: LOCAL_MODEL, ...raw })
    return raw
  },
  async generate(system, prompt, schema, signal) {
    const raw = await this.generateRaw(system, prompt, schema, signal)
    const parsed = parseModelOutput(raw.content, raw)
    if (parsed.repaired && import.meta.env.DEV) console.debug('[TransitX local AI JSON repaired]', { model: LOCAL_MODEL, finishReason: raw.finishReason })
    return parsed.value
  },
}

// Explicit experimental implementation of the same planning-model contract.
// Never selected automatically by the production client.
export class LocalWebGPUProvider {
  ready() { return localCapability().supported }
  prepare(onProgress, signal) { return localModel.prepare(onProgress, signal) }
  generate(system, prompt, schema, signal) { return localModel.generate(system, prompt, schema, signal) }
}
