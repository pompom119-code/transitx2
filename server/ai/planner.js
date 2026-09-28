import { ApiError } from '../core.js'
import { createGemini, MODEL } from './provider.js'
import { planTrip } from '../../src/services/ai/pipeline.js'
import { toTrip } from '../../src/services/ai/tripAdapter.js'
import { createPlaceResolver, verifyAndResolve } from './places.js'
import { normalizeRequest } from '../../src/services/ai/contracts.js'

function editForm(trip, day, operation, replacing) {
  const existing = day.spots.filter(spot => spot.type === 'poi' && (operation !== 'replace' || spot.id !== replacing.id)).map(spot => spot.title)
  return {
    destination: trip.destination, days: 1, dateUnknown: !day.date, travelerCount: trip.travelerCount,
    startDate: day.date || '', endDate: day.date || '', places: existing,
    optionalNotes: operation === 'replace'
      ? `只找一個可替換「${replacing.title}」的新景點。既有景點：${existing.join('、')}。勿重複。`
      : `保留既有景點並重新安排這一天。既有景點：${existing.join('、')}。`,
  }
}

export function createPlanner(env, dependencies = {}) {
  const provider = dependencies.provider || createGemini(env, dependencies.fetcher)
  const places = dependencies.places || createPlaceResolver(dependencies.fetcher)
  let busy = false
  const model = {
    async prepare(_onProgress, _signal) {
      if (!provider.ready()) await provider.generate('', {}, undefined)
    },
    generate(system, prompt, schema, signal) { return provider.generate(prompt, schema, signal, system) },
  }
  return async (body, progress = (_event) => {}, signal) => {
    if (busy) throw new ApiError('BUSY', '已有行程正在規劃，請稍候。', 429)
    const operation = body?.operation
    if (!['generate', 'replace', 'replan'].includes(operation)) throw new ApiError('INPUT', '不支援的規劃操作。', 400)
    const trip = body.trip
    const day = operation === 'generate' ? null : trip?.days?.[body.dayIndex]
    const replacing = operation === 'replace' ? day?.spots?.find(spot => spot.id === body.spotId) : null
    if (operation !== 'generate' && (!day || !trip?.request?.profile || (operation === 'replace' && !replacing))) throw new ApiError('INPUT', '無法讀取要編輯的原始行程。', 400)
    if (replacing?.requiredPlace) throw new ApiError('INPUT', '指定地點不可由 AI 替換；請手動編輯。', 400)
    const form = operation === 'generate' ? body.form : editForm(trip, day, operation, replacing)
    const profile = operation === 'generate' ? body.profile : trip.request.profile
    try { normalizeRequest(form, profile) } catch (error) { throw new ApiError('INPUT', error.message, 400) }
    busy = true
    try {
      const resolvers = dependencies.resolvers || { resolveDraft: (draft, request, abortSignal) => verifyAndResolve(draft, request, places, abortSignal) }
      const plan = await planTrip(form, profile, model, event => progress(event), signal, resolvers)
      const result = toTrip(plan, form, profile, `Gemini / ${MODEL}`)
      if (operation === 'generate') return result
      const newDay = result.days[0]
      if (operation === 'replan') {
        return { ...newDay, id: day.id, label: day.label, date: day.date,
          spots: newDay.spots.map(spot => {
            const original = day.spots.find(old => old.title === spot.title)
            return original ? { ...spot, id: original.id, favorite: original.favorite } : spot
          }) }
      }
      const existingNames = new Set(day.spots.map(spot => spot.title))
      const candidate = newDay.spots.find(spot => spot.type === 'poi' && !existingNames.has(spot.title))
      if (!candidate) throw new ApiError('VALIDATION', 'AI 沒找到可靠的新景點，原行程未變更。', 422)
      return { ...candidate, id: replacing.id, time: replacing.time, favorite: replacing.favorite,
        transport: { from: candidate.title, to: day.spots[day.spots.indexOf(replacing) + 1]?.title || '', status: 'unresolved' },
        transportMode: '交通待確認', transportMinutes: null }
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (/請|缺少|不符|遺漏|過長/.test(error.message)) throw new ApiError('VALIDATION', error.message, 422)
      throw error
    } finally { busy = false }
  }
}
