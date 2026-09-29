import { ApiError, requestJson } from '../core.js'

// Each ID below was present in this key's 2026-09-28 official models.list
// response, has generateContent, and is listed by Google as Structured Output
// capable with free Standard input/output. The live list is checked again at
// runtime; this allowlist is not a guess or a substitute for account access.
export const FREE_STRUCTURED_MODELS = Object.freeze([
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
])

export async function listEligibleModels(env, fetcher = fetch, signal) {
  if (!env.GEMINI_API_KEY) throw new ApiError('AI_NOT_CONFIGURED', 'AI 尚未設定伺服器金鑰。', 503)
  if (env.GEMINI_FREE_TIER_CONFIRMED !== 'true') throw new ApiError('FREE_TIER_UNCONFIRMED', '尚未確認 Gemini Free Tier。', 503)
  const available = new Set()
  let pageToken = ''
  for (let page = 0; page < 5; page++) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const data = await requestJson(url.toString(), { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal }, fetcher, 20000)
    for (const model of data.models || []) {
      if (model.supportedGenerationMethods?.includes('generateContent')) available.add(model.name)
    }
    pageToken = data.nextPageToken || ''
    if (!pageToken) break
    if (page === 4) throw new ApiError('AI_MODEL_CATALOG', '模型清單過長，暫時無法安全選擇 AI 模型。', 503)
  }
  const eligible = FREE_STRUCTURED_MODELS.filter(id => available.has(`models/${id}`))
  if (!eligible.length) throw new ApiError('AI_NO_MODEL', '目前找不到可用的免費結構化 AI 模型。', 503)
  return eligible
}
