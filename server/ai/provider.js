import { ApiError, requestJson } from '../core.js'
import { AI_SYSTEM } from '../../src/services/ai/planningPrompts.js'
export const MODEL = 'gemini-3.5-flash-lite'
export function createGemini(env, fetcher = fetch) {
  let day = '', calls = 0
  return {
    ready: () => Boolean(env.GEMINI_API_KEY && env.GEMINI_FREE_TIER_CONFIRMED === 'true'),
    async generate(prompt, schema, signal, system = AI_SYSTEM) {
      if (!env.GEMINI_API_KEY) throw new ApiError('AI_NOT_CONFIGURED', 'AI 尚未設定 GEMINI_API_KEY；請先完成伺服器設定。', 503)
      if (env.GEMINI_FREE_TIER_CONFIRMED !== 'true') throw new ApiError('FREE_TIER_UNCONFIRMED', '請確認 Gemini 專案未啟用付費，並設定 GEMINI_FREE_TIER_CONFIRMED=true。', 503)
      const today = new Date().toISOString().slice(0,10)
      if (day !== today) { day = today; calls = 0 }
      if (calls >= 20) throw new ApiError('RATE_LIMIT', '本機每日安全上限 20 次已用完；不會自動改用付費服務。', 429)
      calls++
      const data = await requestJson('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
        method:'POST', signal, headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
        body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt}]}],
          generationConfig:{temperature:0.35,maxOutputTokens:24000,responseMimeType:'application/json',responseJsonSchema:schema}}),
      }, fetcher, 90000)
      const candidate = data.candidates?.[0]
      if (candidate?.finishReason !== 'STOP') throw new ApiError('AI_INCOMPLETE', 'AI 未完成有效行程，請縮短天數或稍後重試。')
      const text = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('')
      try { return JSON.parse(text) } catch { throw new ApiError('INVALID_JSON','AI 回傳的 JSON 無法解析。') }
    },
  }
}
