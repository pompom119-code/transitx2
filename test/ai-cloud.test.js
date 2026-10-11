import test from 'node:test'
import assert from 'node:assert/strict'
import { createAiRequestGuard } from '../server/ai/requestGuard.js'
import { createGemini, MODEL } from '../server/ai/provider.js'
import { FREE_STRUCTURED_MODELS } from '../server/ai/modelCatalog.js'

const session = '0123456789abcdef0123456789abcdef'
const body = { operation: 'generate', form: { destination: '淡水', days: 1 }, profile: { id: 'friends', answers: { interests: ['美食'] } } }
const catalog = (ids = FREE_STRUCTURED_MODELS) => Response.json({ models: ids.map(id => ({ name: `models/${id}`, supportedGenerationMethods: ['generateContent'] })) })
const withCatalog = (post, ids) => (url, options) => url.includes('/v1beta/models?') ? catalog(ids) : post(url, options)
const testEnv = { GEMINI_API_KEY: 'test-only', GEMINI_FREE_TIER_CONFIRMED: 'true' }
const instant = { sleep: async () => {} }

test('Gemini provider uses server-only key and official JSON schema; no key fails closed', async () => {
  await assert.rejects(createGemini({}).generate('test', {}), error => error.code === 'AI_NOT_CONFIGURED')
  await assert.rejects(createGemini({ GEMINI_API_KEY: 'test' }).generate('test', {}), error => error.code === 'FREE_TIER_UNCONFIRMED')
  let inspected = false
  const provider = createGemini(testEnv, withCatalog(async (url, options) => {
    inspected = true
    assert.ok(url.endsWith(`/models/${MODEL}:generateContent`))
    assert.equal(options.headers['x-goog-api-key'], 'test-only')
    const payload = JSON.parse(options.body)
    assert.equal(payload.generationConfig.responseMimeType, 'application/json')
    assert.deepEqual(payload.generationConfig.responseJsonSchema, { type: 'object', properties: { answer: { type: 'string' } } })
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"answer":"ok"}' }] } }] })
  }))
  assert.deepEqual(await provider.generate('test', { type: 'object', properties: { answer: { type: 'string' } } }), { answer: 'ok' })
  assert.ok(inspected)
})

test('Gemini provider rejects rate limit, bad JSON, incomplete output, and network failure', async () => {
  const generate = fetcher => createGemini(testEnv, withCatalog(fetcher), instant).generate('test', {})
  await assert.rejects(generate(async () => new Response('', { status: 429 })), error => error.code === 'RATE_LIMIT')
  await assert.rejects(generate(async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{bad' }] } }] })), error => error.code === 'INVALID_JSON')
  await assert.rejects(generate(async () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] })), error => error.code === 'AI_INCOMPLETE')
  await assert.rejects(generate(async () => { throw new TypeError('offline') }), error => error.code === 'NETWORK')
})

test('Gemini provider retries a transient 503 without retrying a malformed 400 request', async () => {
  let calls = 0
  const provider = createGemini(testEnv, withCatalog(async () => {
    calls++
    return calls === 1 ? new Response('', { status: 503 })
      : Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"status":"ready"}' }] } }] })
  }), instant)
  assert.equal((await provider.generate('test', {})).status, 'ready')
  assert.equal(calls, 2)
  let invalidCalls = 0
  await assert.rejects(createGemini(testEnv, withCatalog(async () => { invalidCalls++; return new Response('', { status: 400 }) }), instant).generate('test', {}), error => error.code === 'AI_REQUEST_INVALID')
  assert.equal(invalidCalls, 1)
})

test('bounded overload retries exhaust each eligible model and return safe unavailable error', async () => {
  let calls = 0
  const provider = createGemini(testEnv, withCatalog(async () => {
    calls++
    return new Response('', { status: 503 })
  }), instant)
  await assert.rejects(provider.generate('test', {}), error => error.code === 'AI_UNAVAILABLE' && error.status === 503 && error.message === 'AI 目前比較忙，請稍後再試。')
  assert.equal(calls, FREE_STRUCTURED_MODELS.length * 3)
})

test('catalog selects only documented eligible IDs, prefers Flash-Lite and switches after three 503 responses', async () => {
  assert.deepEqual(FREE_STRUCTURED_MODELS.slice(0, 2), ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'])
  const calls = []
  const waits = []
  const provider = createGemini(testEnv, withCatalog(async url => {
    const id = url.match(/models\/(.*):generateContent/)?.[1]
    calls.push(id)
    return id === 'gemini-3.7-flash' ? Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"status":"ready"}' }] } }] }) : new Response('', { status: 503 })
  }, ['unapproved-model', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']), { sleep: async ms => { waits.push(ms) } })
  assert.equal((await provider.generate('test', {})).status, 'ready')
  assert.deepEqual(calls, ['gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'])
  assert.deepEqual(waits, [600, 1200])
  assert.equal(provider.model, 'gemini-3.7-flash')
  calls.length = 0
  await provider.generate('test', {})
  assert.deepEqual(calls, ['gemini-3.7-flash'])
})

test('auth and malformed request errors never fall back; a 429 moves to the next model', async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0
    const provider = createGemini(testEnv, withCatalog(async () => { calls++; return new Response('', { status }) }), instant)
    await assert.rejects(provider.generate('test', {}), error => status === 400 ? error.code === 'AI_REQUEST_INVALID' : error.upstreamStatus === status)
    assert.equal(calls, 1)
  }
  const calls = []
  const waits = []
  const provider = createGemini(testEnv, withCatalog(async url => {
    calls.push(url.match(/models\/(.*):generateContent/)?.[1])
    return calls.length === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '2' } })
      : Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"status":"ready"}' }] } }] })
  }), { sleep: async ms => { waits.push(ms) } })
  assert.equal((await provider.generate('test', {})).status, 'ready')
  assert.deepEqual(calls, FREE_STRUCTURED_MODELS.slice(0, 2))
  assert.deepEqual(waits, [])
  let limitedCalls = 0
  const limited = createGemini(testEnv, withCatalog(async () => { limitedCalls++; return new Response('', { status: 429, headers: { 'Retry-After': '60' } }) }), instant)
  await assert.rejects(limited.generate('test', {}), error => error.code === 'RATE_LIMIT' && error.retryAfterMs >= 59000 && error.retryAfterMs <= 60000)
  assert.equal(limitedCalls, FREE_STRUCTURED_MODELS.length)
})

const quota429 = (quotaId, retryDelay) => Response.json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [
  { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId }] },
  ...(retryDelay ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] : []),
] } }, { status: 429 })
const ok = () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"status":"ready"}' }] } }] })

test('per-day 429 parks a model until the Pacific-midnight reset; per-minute 429 only for its retry delay', async () => {
  let now = Date.parse('2026-10-11T12:00:00-07:00')
  const calls = []
  const exhausted = new Set(['gemini-3.5-flash-lite'])
  const provider = createGemini(testEnv, withCatalog(async url => {
    const id = url.match(/models\/(.*):generateContent/)?.[1]
    calls.push(id)
    if (exhausted.has(id)) return quota429('GenerateRequestsPerDayPerProjectPerModel-FreeTier')
    if (id === 'gemini-3.1-flash-lite' && calls.length === 2) return quota429('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '30s')
    return ok()
  }), { ...instant, now: () => now })
  await provider.generate('test', {})
  assert.deepEqual(calls, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'])
  calls.length = 0
  now += 31_000
  await provider.generate('test', {})
  assert.deepEqual(calls, ['gemini-3.1-flash-lite'], 'daily-exhausted model skipped; per-minute model back after 30 s')
  calls.length = 0
  exhausted.clear()
  now = Date.parse('2026-10-12T00:00:01-07:00')
  await provider.generate('test', {})
  assert.deepEqual(calls, ['gemini-3.5-flash-lite'], 'first model returns after the daily reset')
})

test('all models out of daily quota reports a daily-limit message; process cap is configurable', async () => {
  let calls = 0
  const provider = createGemini(testEnv, withCatalog(async () => { calls++; return quota429('GenerateRequestsPerDayPerProjectPerModel-FreeTier') }), instant)
  await assert.rejects(provider.generate('test', {}), error => error.code === 'RATE_LIMIT' && /今日免費額度已用完/.test(error.message) && error.retryAfterMs > 0)
  assert.equal(calls, FREE_STRUCTURED_MODELS.length)
  await assert.rejects(provider.generate('test', {}), error => error.code === 'RATE_LIMIT')
  assert.equal(calls, FREE_STRUCTURED_MODELS.length, 'exhausted models are not called again')

  let capped = 0
  const small = createGemini({ ...testEnv, GEMINI_MAX_CALLS_PER_DAY: '2' }, withCatalog(async () => { capped++; return ok() }), instant)
  await small.generate('a', {}); await small.generate('b', {})
  await assert.rejects(small.generate('c', {}), error => error.code === 'RATE_LIMIT' && /安全上限/.test(error.message))
  assert.equal(capped, 2)
})

test('identical plans cache briefly; fresh/edit operations bypass and sessions cool down', async () => {
  let now = 100000, calls = 0
  const guard = createAiRequestGuard({ now: () => now, cooldownMs: 20, cacheMs: 100 })
  const run = async () => ({ id: `trip-${++calls}`, days: [] })
  const first = await guard(session, body, run)
  const cached = await guard(session, structuredClone(body), run)
  assert.equal(calls, 1)
  assert.notEqual(cached.id, first.id)
  assert.equal(cached.fromCache, true)
  await assert.rejects(guard(session, { ...body, fresh: true }, run), error => error.code === 'COOLDOWN')
  now += 20
  await guard(session, { ...body, fresh: true }, run)
  assert.equal(calls, 2)
  now += 20
  await guard(session, { operation: 'replace' }, run)
  assert.equal(calls, 3)
  now += 101
  await guard(session, body, run)
  assert.equal(calls, 4)
})

test('duplicate work, abort, and daily session cap do not expose partial results', async () => {
  let now = 100000, release
  const guard = createAiRequestGuard({ now: () => now, cooldownMs: 0, maxPlans: 2 })
  const pending = guard(session, body, () => new Promise(resolve => { release = resolve }))
  await assert.rejects(guard(session, { ...body, fresh: true }, async () => ({})), error => error.code === 'DUPLICATE')
  release({ id: 'trip-one' }); await pending
  now += 1
  const cancelled = new AbortController()
  await assert.rejects(guard(session, { ...body, fresh: true }, async () => { cancelled.abort(); return { id: 'partial' } }, cancelled.signal), error => error.code === 'CANCELLED')
  await assert.rejects(guard(session, { ...body, fresh: true }, async () => ({})), error => error.code === 'DAILY_LIMIT')
})

test('missing server configuration does not burn the session allowance', async () => {
  const guard = createAiRequestGuard({ maxPlans: 1, cooldownMs: 100000 })
  await assert.rejects(guard(session, body, async () => { throw Object.assign(new Error('unconfigured'), { code: 'AI_NOT_CONFIGURED' }) }), error => error.code === 'AI_NOT_CONFIGURED')
  assert.equal((await guard(session, body, async () => ({ id: 'trip-ok', days: [] }))).id, 'trip-ok')
})
