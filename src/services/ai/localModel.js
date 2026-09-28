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
  async generate(system, prompt, schema, signal) {
    const engine = await enginePromise
    if (!engine) throw new Error('本機 AI 尚未準備好')
    if (signal?.aborted) throw signal.reason || new Error('已取消規劃')
    const maxTokens = schema.properties?.travelApproach ? 700 : schema.properties?.items ? 1500 : 500
    const reply = await engine.chat.completions.create({
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.7, top_p: 0.8, presence_penalty: 1.5, max_tokens: maxTokens, enable_thinking: false,
      response_format: { type: 'json_object', schema: JSON.stringify(schema) },
    })
    if (signal?.aborted) throw signal.reason || new Error('已取消規劃')
    const content = reply.choices?.[0]?.message?.content
    try { return JSON.parse(content) } catch { throw new Error('本機 AI 沒有回傳有效 JSON') }
  },
}
