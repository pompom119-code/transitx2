import test from 'node:test'
import assert from 'node:assert/strict'
import { parseModelOutput } from '../src/services/ai/parseModelOutput.js'
import { friendlyPlanningError } from '../src/services/ai/errors.js'

test('extracts the first JSON object from prose and a Markdown fence', () => {
  const result = parseModelOutput('好的，以下是行程：\n```json\n{"theme":"淡水 { 一日遊","items":[]}\n```\n祝旅途愉快')
  assert.equal(result.value.theme, '淡水 { 一日遊')
  assert.equal(result.repaired, false)
})

test('repairs a trailing comma without inventing fields', () => {
  const result = parseModelOutput('{"theme":"文化日","items":[],}')
  assert.deepEqual(result.value, { theme: '文化日', items: [] })
  assert.equal(result.repaired, true)
})

test('rejects empty, prose-only and overlong outputs with explicit codes', () => {
  assert.throws(() => parseModelOutput(''), { code: 'NO_OUTPUT' })
  assert.throws(() => parseModelOutput('我來幫你安排'), { code: 'NO_JSON_OBJECT' })
  assert.throws(() => parseModelOutput('x'.repeat(200001)), { code: 'OUTPUT_TOO_LARGE' })
})

test('never accepts a token-limited response as a complete itinerary', () => {
  assert.throws(() => parseModelOutput('{"theme":"文化日","items":[]} ', { finishReason: 'length' }), { code: 'OUTPUT_TRUNCATED' })
})

test('ignores a Qwen thinking block before the final object', () => {
  const result = parseModelOutput('<think>先做 { 草稿 }</think>\n{"theme":"正式結果"}')
  assert.equal(result.value.theme, '正式結果')
})

test('technical JSON and model errors never become user-facing copy', () => {
  const error = new Error('AI 回傳資料未通過驗證：本機 AI 沒有回傳有效 JSON')
  const message = friendlyPlanningError(error)
  assert.match(message, /智慧規劃暫時無法完成/)
  assert.doesNotMatch(message, /JSON|Schema|WebGPU|模型/)
  assert.equal(friendlyPlanningError({ code: 'AI_UNAVAILABLE' }), 'AI 目前比較忙，請稍後再試。')
})
