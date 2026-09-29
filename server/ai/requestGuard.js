import { createHash, randomUUID } from 'node:crypto'
import { ApiError } from '../core.js'

const DAY_MS = 86400000
const CACHE_MS = 10 * 60000
const COOLDOWN_MS = 20000
const MAX_PLANS_PER_DAY = 5

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}

export function createAiRequestGuard({ now = Date.now, maxPlans = MAX_PLANS_PER_DAY, cooldownMs = COOLDOWN_MS, cacheMs = CACHE_MS } = {}) {
  const sessions = new Map()
  const cache = new Map()
  const pending = new Set()
  return async function guardedPlan(sessionId, body, run, signal) {
    if (signal?.aborted) throw new ApiError('CANCELLED', '規劃已取消。', 499)
    const session = String(sessionId || '')
    if (!/^[a-f0-9]{32,64}$/.test(session)) throw new ApiError('SESSION', '無法確認本次工作階段，請重新整理後再試。', 400)
    const operation = body?.operation
    if (!['generate', 'replace', 'replan'].includes(operation)) throw new ApiError('INPUT', '不支援的規劃操作。', 400)
    // Only identical initial plans are cached. Edits and explicit regeneration
    // always ask the model for a fresh variation.
    const fingerprint = createHash('sha256').update(JSON.stringify(canonical({ operation, form: body.form, profile: body.profile }))).digest('hex')
    const cacheable = operation === 'generate' && body.fresh !== true
    const time = now()
    const stored = cacheable ? cache.get(fingerprint) : null
    if (stored && stored.expires > time) {
      const copy = structuredClone(stored.value)
      return { ...copy, id: `trip-${randomUUID()}`, createdAt: new Date(time).toISOString(), fromCache: true,
        days: copy.days.map(day => ({ ...day, id: `day-${randomUUID()}`,
          spots: day.spots.map(spot => ({ ...spot, id: `spot-${randomUUID()}` })) })) }
    }
    if (pending.has(session)) throw new ApiError('DUPLICATE', '已有一份行程正在規劃，請等待結果。', 429)
    let state = sessions.get(session)
    const day = Math.floor(time / DAY_MS)
    if (!state || state.day !== day) state = { day, count: 0, lastStarted: -Infinity }
    if (state.count >= maxPlans) throw new ApiError('DAILY_LIMIT', '今天的 AI 規劃次數已達安全上限，請明天再試。', 429)
    if (time - state.lastStarted < cooldownMs) throw new ApiError('COOLDOWN', '請稍候片刻，再重新規劃。', 429)
    const previousStarted = state.lastStarted
    state.count++
    state.lastStarted = time
    sessions.set(session, state)
    pending.add(session)
    try {
      const result = await run()
      if (signal?.aborted) throw new ApiError('CANCELLED', '規劃已取消。', 499)
      if (cacheable) cache.set(fingerprint, { value: structuredClone(result), expires: now() + cacheMs })
      return result
    } catch (error) {
      // A missing server credential or invalid input never reached the model.
      if (['AI_NOT_CONFIGURED', 'FREE_TIER_UNCONFIRMED', 'INPUT'].includes(error?.code)) {
        state.count--
        state.lastStarted = previousStarted
      }
      throw error
    } finally {
      pending.delete(session)
      // Bound warm-process memory; serverless instances may disappear at any time.
      if (cache.size > 100) cache.delete(cache.keys().next().value)
      if (sessions.size > 1000) sessions.delete(sessions.keys().next().value)
    }
  }
}
