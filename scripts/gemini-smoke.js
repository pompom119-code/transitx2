import { loadEnv } from 'vite'
import { createGemini } from '../server/ai/provider.js'

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
if (!env.GEMINI_API_KEY || env.GEMINI_FREE_TIER_CONFIRMED !== 'true') {
  console.error('Gemini Free Tier 尚未確認或金鑰未設定；沒有送出生成請求。')
  process.exitCode = 2
} else {
  try {
    const provider = createGemini(env, async (url, options) => {
      const response = await fetch(url, options)
      if (url.includes(':generateContent')) console.info(`${url.match(/models\/(.*):generateContent/)?.[1]} HTTP=${response.status}`)
      return response
    })
    const result = await provider.generate(
      '請將 status 設為 ready。',
      { type: 'object', properties: { status: { type: 'string' } }, required: ['status'], additionalProperties: false },
      AbortSignal.timeout(90000),
      '你正在執行連線測試。只回傳符合 JSON Schema 的 JSON，不要其他文字。',
    )
    if (result?.status !== 'ready') throw new Error('回應未符合連線測試語意')
    console.info(`PASS: ${provider.model} 真實 Structured JSON 輸出與解析成功。`)
  } catch (error) {
    console.error(`FAIL: ${error.code || error.name || 'ERROR'}；${error.message}`)
    process.exitCode = 1
  }
}
