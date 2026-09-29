import { CreateMLCEngine } from '@mlc-ai/web-llm'
import { planTrip } from '../src/services/ai/pipeline.js'
import { parseModelOutput } from '../src/services/ai/parseModelOutput.js'

const models = {
  qwen3_4b: 'Qwen3-4B-q4f16_1-MLC',
  qwen35_2b: 'Qwen3.5-2B-q4f16_1-MLC',
  qwen35_4b: 'Qwen3.5-4B-q4f16_1-MLC',
}
const params = new URLSearchParams(location.search)
const modelId = models[params.get('model')] || models.qwen3_4b
const maxRuns = Math.max(1, Math.min(4, Number(params.get('max') || 3)))
const cases = [
  { name: '東京自己攝影', destination: '東京', companions: '自己', count: 1, interests: ['攝影'], must: '東京鐵塔' },
  { name: '淡水朋友美食拍照', destination: '淡水', companions: '朋友', count: 2, interests: ['美食', '拍照'], must: '紅毛城' },
  { name: '高雄家人慢遊', destination: '高雄', companions: '家人', count: 4, interests: ['文化', '美食'], must: '駁二藝術特區' },
  { name: '大阪自己文化', destination: '大阪', companions: '自己', count: 1, interests: ['文化'], must: '大阪城' },
]
const status = document.querySelector('#status')
const summary = document.querySelector('#summary')
const results = []
let engine
const model = {
  async prepare(onProgress) {
    if (engine) return
    engine = await CreateMLCEngine(modelId, {
      initProgressCallback(report) {
        onProgress?.({ step: 0, label: '準備候選模型', downloadPercent: Math.round((report.progress || 0) * 100) })
      },
    })
  },
  async generate(system, prompt, schema) {
    const phase = JSON.parse(prompt).phase
    const maxTokens = schema.properties?.travelApproach ? 700 : schema.properties?.items ? 1500 : 500
    const reply = await engine.chat.completions.create({
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.7, top_p: 0.8, top_k: 20, presence_penalty: 1.5, frequency_penalty: 0, max_tokens: maxTokens,
      enable_thinking: false, response_format: { type: 'json_object', schema: JSON.stringify(schema) },
    })
    const content = reply.choices?.[0]?.message?.content || ''
    const finishReason = reply.choices?.[0]?.finish_reason || 'unknown'
    currentCalls.push({ phase, finishReason, tokens: reply.usage?.completion_tokens || 0, content })
    return parseModelOutput(content, { finishReason }).value
  },
}
const resolver = { async resolveDraft(draft, request) {
  const response = await fetch('/api/ai/resolve-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, request }) })
  const value = await response.json()
  if (!response.ok) throw Object.assign(new Error(value.message || '地點查核失敗'), { code: value.code || 'PLACE_PROVIDER' })
  return value
} }
let currentCalls = []
for (const sample of cases.slice(0, maxRuns)) {
  currentCalls = []
  const form = { destination: sample.destination, days: 1, dateUnknown: false, startDate: '2026-10-01', endDate: '2026-10-01', travelerCount: sample.count, places: [sample.must], optionalNotes: '' }
  const profile = { id: 'candidate-benchmark', answers: { companions: sample.companions, interests: sample.interests, exploration: '探索派', walking: '普通', budget: '中等', pace: '普通', transport: ['公車', '步行'], notes: { selected: [], text: '' } } }
  const started = performance.now()
  let plan, error
  try {
    plan = await planTrip(form, profile, model, event => { status.textContent = `${modelId} / ${sample.name}：${event.label} ${event.downloadPercent ?? ''}%` }, undefined, resolver)
  } catch (reason) { error = { message: reason.message, cause: reason.cause?.message || '', code: reason.code || '' } }
  results.push({ modelId, sample: sample.name, success: Boolean(plan), seconds: Math.round((performance.now() - started) / 100) / 10,
    days: plan?.draft.days.map(day => ({ theme: day.theme, items: day.items.map(item => ({ type: item.type, name: item.name, title: item.title, area: item.area, foods: item.foods, verificationStatus: item.verificationStatus })) })) || [],
    calls: currentCalls, error })
  summary.textContent = JSON.stringify(results, null, 2)
}
status.textContent = `${modelId}：${results.filter(result => result.success).length}/${results.length} 完整規劃通過。`
