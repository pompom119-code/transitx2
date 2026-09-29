import { loadEnv } from 'vite'
import { listEligibleModels } from '../server/ai/modelCatalog.js'

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
if (!env.GEMINI_API_KEY || env.GEMINI_FREE_TIER_CONFIRMED !== 'true') {
  console.error('金鑰或 Free Tier 確認未設定；沒有送出生成請求。')
  process.exitCode = 2
} else {
  const eligible = await listEligibleModels(env)
  console.info(`OFFICIAL_ELIGIBLE_IDS=${eligible.join(',')}`)
  const schema = { type: 'object', properties: { status: { type: 'string' } }, required: ['status'], additionalProperties: false }
  const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Return JSON with status ready.' }] }],
    generationConfig: { maxOutputTokens: 128, responseMimeType: 'application/json', responseJsonSchema: schema } })
  for (const id of eligible) {
    const started = performance.now()
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body, signal: AbortSignal.timeout(40000),
      })
      const elapsed = Math.round(performance.now() - started)
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        console.info(`${id} HTTP=${response.status} MS=${elapsed} STATUS=${detail.error?.status || 'UNKNOWN'}`)
        continue
      }
      const data = await response.json()
      const candidate = data.candidates?.[0]
      const text = candidate?.content?.parts?.map(part => part.text || '').join('') || ''
      let valid = false
      try { valid = JSON.parse(text).status === 'ready' } catch { /* report invalid without raw output */ }
      console.info(`${id} HTTP=${response.status} MS=${elapsed} FINISH=${candidate?.finishReason || 'NONE'} VALID_JSON=${valid}`)
    } catch (error) {
      console.info(`${id} HTTP=0 MS=${Math.round(performance.now() - started)} ERROR=${error.name || 'NETWORK'}`)
    }
  }
}
