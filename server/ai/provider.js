import { ApiError, requestJson } from '../core.js'
import { AI_SYSTEM } from '../../src/services/ai/planningPrompts.js'
import { FREE_STRUCTURED_MODELS, listEligibleModels } from './modelCatalog.js'

export const MODEL = FREE_STRUCTURED_MODELS[0]
const MAX_ATTEMPTS_PER_MODEL = 3
const OVERLOAD_COOLDOWN_MS = 5 * 60_000
const CATALOG_TTL_MS = 15 * 60_000
const MAX_CALLS_PER_PROCESS_DAY = 40

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(new ApiError('CANCELLED', '規劃已取消。', 499))
  return new Promise((resolve, reject) => {
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); resolve(undefined) }
    const cancel = () => { clearTimeout(timer); reject(new ApiError('CANCELLED', '規劃已取消。', 499)) }
    const timer = setTimeout(finish, ms)
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

/** AIProvider contract: ready(): boolean; generate(prompt, schema, signal, system): Promise<object>. */
export class GeminiAIProvider {
  constructor(env, fetcher = fetch, options = {}) {
    this.env = env
    this.fetcher = fetcher
    this.now = options.now || Date.now
    this.sleep = options.sleep || wait
    this.model = MODEL
    this.day = ''
    this.calls = 0
    this.catalog = null
    this.catalogExpires = 0
    this.catalogPromise = null
    this.overloadedUntil = new Map()
  }

  ready() { return Boolean(this.env.GEMINI_API_KEY && this.env.GEMINI_FREE_TIER_CONFIRMED === 'true') }

  async eligibleModels(signal) {
    if (this.catalog && this.catalogExpires > this.now()) return this.catalog
    if (!this.catalogPromise) {
      this.catalogPromise = listEligibleModels(this.env, this.fetcher, signal)
        .then(models => { this.catalog = models; this.catalogExpires = this.now() + CATALOG_TTL_MS; return models })
        .finally(() => { this.catalogPromise = null })
    }
    return this.catalogPromise
  }

  async generate(prompt, schema, signal, system = AI_SYSTEM) {
    const env = this.env
    if (!env.GEMINI_API_KEY) throw new ApiError('AI_NOT_CONFIGURED', 'AI 尚未設定 GEMINI_API_KEY；請先完成伺服器設定。', 503)
    if (env.GEMINI_FREE_TIER_CONFIRMED !== 'true') throw new ApiError('FREE_TIER_UNCONFIRMED', '請確認 Gemini 專案維持 Free Tier。', 503)
    const today = new Date(this.now()).toISOString().slice(0, 10)
    if (this.day !== today) { this.day = today; this.calls = 0 }

    const eligible = await this.eligibleModels(signal)
    const preferred = env.GEMINI_MODEL || MODEL
    if (env.GEMINI_MODEL && (!FREE_STRUCTURED_MODELS.includes(preferred) || !eligible.includes(preferred))) {
      throw new ApiError('AI_MODEL_CONFIG', '指定的 AI 模型不在此金鑰可用的免費模型清單中。', 503)
    }
    const ordered = eligible.includes(preferred) ? [preferred, ...eligible.filter(id => id !== preferred)] : eligible
    for (const id of ordered) {
      if ((this.overloadedUntil.get(id) || 0) > this.now()) continue
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
        if (signal?.aborted) throw new ApiError('CANCELLED', '規劃已取消。', 499)
        if (this.calls >= MAX_CALLS_PER_PROCESS_DAY) throw new ApiError('RATE_LIMIT', 'AI 服務今日安全上限已用完，請明天再試。', 429)
        this.calls++
        let data
        try {
          data = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`, {
            method: 'POST', signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.35, maxOutputTokens: 24000,
                responseMimeType: 'application/json', responseJsonSchema: schema } }),
          }, this.fetcher, 90000)
        } catch (error) {
          if (error.upstreamStatus === 503) {
            if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
              await this.sleep(600 * 2 ** attempt, signal)
              continue
            }
            this.overloadedUntil.set(id, this.now() + OVERLOAD_COOLDOWN_MS)
            break
          }
          // 400/401/403 are configuration/auth errors. 429 is a quota signal,
          // not permission to evade the limit by trying another model.
          if (error.upstreamStatus === 429 && error.retryAfterMs != null && error.retryAfterMs <= 10_000 && attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
            await this.sleep(error.retryAfterMs, signal)
            continue
          }
          if (error.upstreamStatus === 400) throw new ApiError('AI_REQUEST_INVALID', 'AI 請求格式無效，請聯絡維護者。', 502)
          throw error
        }
        const candidate = data.candidates?.[0]
        if (candidate?.finishReason !== 'STOP') throw new ApiError('AI_INCOMPLETE', 'AI 未完成有效行程，請稍後重試。')
        const content = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('')
        let value
        try { value = JSON.parse(content) } catch { throw new ApiError('INVALID_JSON', 'AI 回傳格式不正確。') }
        this.model = id
        return value
      }
    }
    throw new ApiError('AI_UNAVAILABLE', 'AI 目前比較忙，請稍後再試。', 503)
  }
}

export const createGemini = (env, fetcher = fetch, options = {}) => new GeminiAIProvider(env, fetcher, options)
