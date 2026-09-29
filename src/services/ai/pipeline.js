import { normalizeRequest, assertContract, intentSchema, dayDraftSchema, draftItemSchema, validateDraft } from './contracts.js'
import { addDays } from '../tripDates.js'
import { systemForSchema, intentPrompt, draftPrompt, missingItemPrompt } from './planningPrompts.js'
import { resolveDraft } from './resolvers.js'

const retryableOutputCodes = new Set(['NO_OUTPUT', 'NO_JSON_OBJECT', 'OUTPUT_TRUNCATED', 'INVALID_JSON', 'INFERENCE_TIMEOUT'])

export async function generateValidated(model, prompt, schema, validate, signal) {
  let correction = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw signal.reason || new Error('已取消規劃')
    let result, failure
    try {
      const payload = prompt(correction)
      result = await model.generate(systemForSchema(schema, payload), payload, schema, signal)
    } catch (error) {
      if (error.code && !retryableOutputCodes.has(error.code)) throw error
      if (!error.code && !/沒有回傳有效 JSON/.test(error.message)) throw error
      failure = error
    }
    try {
      if (failure) throw failure
      assertContract(result, schema)
      validate(result)
      return result
    } catch (error) {
      if (error.code && !retryableOutputCodes.has(error.code)) throw error
      correction = `前次結果無效：${error.message}。請修正並完整輸出 JSON。`
      if (attempt === 2) throw new Error('AI 暫時無法完成這次規劃，請稍後再試或縮短旅程天數。', { cause: error })
    }
  }
}

export async function planTrip(form, profile, model, onProgress = (_event) => {}, signal, providers = {}) {
  const request = normalizeRequest(form, profile)
  onProgress({ step: 0, label: '正在準備 AI' })
  await model.prepare?.(onProgress, signal)
  onProgress({ step: 1, label: '正在理解你的旅行方式' })
  const rawIntent = await generateValidated(model, correction => intentPrompt(request, correction), intentSchema, () => {}, signal)
  const intent = { ...rawIntent, dailyThemes: Array.from({ length: request.days }, (_, index) => rawIntent.dailyThemes[index] || rawIntent.travelApproach) }
  onProgress({ step: 2, label: '正在安排每天內容' })
  const buildDay = async (dayIndex, geographyCorrection = '') => {
    onProgress({ step: 2, label: `正在安排第 ${dayIndex + 1}／${request.days} 天`, dayIndex, dayCount: request.days })
    const assigned = request.mustVisitPlaces.filter((_, index) => index % request.days === dayIndex)
    const oneDayRequest = { ...request, days: 1, startDate: request.startDate ? addDays(request.startDate, dayIndex) : '', mustVisitPlaces: assigned }
    const authoritative = value => {
      const seenPois = new Set()
      const normalizedItems = (value.items?.map(item => item.type === 'food' ? { ...item, name: '', title: '', estimatedDurationMinutes: Math.max(30, item.estimatedDurationMinutes) }
        : item.type === 'activity' || item.type === 'break' ? { ...item, name: '' }
          : { ...item, title: '', area: '', estimatedDurationMinutes: Math.max(30, item.estimatedDurationMinutes) }) || [])
      const poiNames = new Set(normalizedItems.filter(item => item.type === 'poi').map(item => item.name.normalize('NFKC').replace(/\s/g, '').toLowerCase()))
      const seenFoods = new Set()
      const items = normalizedItems
        .filter(item => {
          if (item.type === 'food') {
            const foods = item.foods.map(food => food.normalize('NFKC').replace(/\s/g, '').toLowerCase())
            const key = `${item.area}|${foods.join('|')}`
            if (seenFoods.has(key) || foods.some(food => [...poiNames].some(poi => poi.length >= 3 && food.includes(poi)) || /(\p{Script=Han})\1/u.test(food) || /特色小吃|在地美食|當地美食|美食體驗|老街|餐飲/.test(food)) || /餐廳|食堂|小吃店|咖啡館|老店|分店/.test(item.area)) return false
            seenFoods.add(key)
          }
          if (item.type === 'activity' && assigned.some(must => item.title.includes(must))) return false
          if (item.type !== 'poi') return true
          const key = item.name.normalize('NFKC').replace(/\s/g, '').toLowerCase()
          if (seenPois.has(key)) return false
          seenPois.add(key)
          return true
        })
      for (const must of assigned) {
        if (!items.some(item => item.type === 'poi' && item.name.includes(must))) {
          items.splice(Math.min(1, items.length), 0, { type: 'poi', name: must, title: '', area: '', foods: [],
            reason: '你指定的必訪地點，已保留在本日行程', estimatedDurationMinutes: 60 })
        }
      }
      return { destination: request.destination, travelerCount: request.travelerCount,
        days: [{ date: oneDayRequest.startDate, theme: value.theme, items }] }
    }
    const oneDay = await generateValidated(model, correction => draftPrompt(request, intent, dayIndex,
      [geographyCorrection, correction].filter(Boolean).join('；')), dayDraftSchema, value => {
      const partial = authoritative(value)
      if (partial.days[0].items.length >= 9 && (!partial.days[0].items.some(item => item.type === 'food') || partial.days[0].items.filter(item => item.type === 'poi').length < 2)) throw new Error('九個項目仍缺兩個景點或餐飲')
      validateDraft(partial, oneDayRequest, { requireComplete: false })
    }, signal)
    const day = authoritative(oneDay).days[0]
    const needed = []
    while (day.items.filter(item => item.type === 'poi').length + needed.filter(type => type === 'poi').length < 2) needed.push('poi')
    if (!day.items.some(item => item.type === 'food')) needed.push('food')
    while (day.items.filter(item => item.type === 'poi' || item.type === 'activity').length + needed.filter(type => type === 'poi' || type === 'activity').length < 2) needed.push('activity')
    while (day.items.length + needed.length < 3) needed.push('activity')
    for (const type of needed) {
      onProgress({ step: 2, label: `正在補齊第 ${dayIndex + 1} 天的${{ poi: '景點', food: '餐飲', activity: '活動' }[type]}` })
      const item = await generateValidated(model, correction => missingItemPrompt(oneDayRequest, intent, day, type, correction), draftItemSchema, value => {
        if (value.type !== type) throw new Error(`需要 ${type}，AI 輸出其他類型`)
        const cleaned = value.type === 'food' ? { ...value, name: '', title: '', estimatedDurationMinutes: Math.max(30, value.estimatedDurationMinutes) } : value.type === 'activity' ? { ...value, name: '' } : value
        if (type === 'poi' && day.items.some(existing => existing.type === 'poi' && existing.name === cleaned.name)) throw new Error('景點重複')
        validateDraft({ destination: request.destination, travelerCount: request.travelerCount,
          days: [{ ...day, items: [...day.items, cleaned] }] }, oneDayRequest, { requireComplete: false })
      }, signal)
      const cleaned = item.type === 'food' ? { ...item, name: '', title: '', estimatedDurationMinutes: Math.max(30, item.estimatedDurationMinutes) } : item.type === 'activity' ? { ...item, name: '' } : item
      day.items.splice(type === 'food' ? Math.min(1, day.items.length) : day.items.length, 0, cleaned)
    }
    validateDraft({ destination: request.destination, travelerCount: request.travelerCount, days: [day] }, oneDayRequest)
    return day
  }
  const days = []
  for (let dayIndex = 0; dayIndex < request.days; dayIndex++) days.push(await buildDay(dayIndex))
  const draft = { destination: request.destination, travelerCount: request.travelerCount, days }
  validateDraft(draft, request)
  let resolved
  for (let attempt = 0; attempt < 3; attempt++) {
    onProgress({ step: 3, label: attempt ? '地理查核未通過，重新安排景點' : '正在確認景點與餐飲資料' })
    try { resolved = providers.resolveDraft ? await providers.resolveDraft(draft, request, signal) : await resolveDraft(draft, providers); break }
    catch (error) {
      if (!['GEOGRAPHY', 'PLACE_UNVERIFIED', 'FOOD_AREA_UNVERIFIED'].includes(error.code) || attempt === 2) throw error
      const name = error.message.match(/「([^」]+)」/)?.[1]
      const index = days.findIndex(day => day.items.some(item => item.type === 'poi' && item.name === name || item.type === 'food' && item.area === name))
      if (index < 0 || request.mustVisitPlaces.some(must => name?.includes(must))) throw error
      days[index] = await buildDay(index, `前次提出的「${name}」無法確認屬於目的地，這次不可再使用；請改選可確認屬於「${request.destination}」的真實景點。`)
      validateDraft(draft, request)
    }
  }
  onProgress({ step: 4, label: '正在檢查完整行程' })
  validateDraft(draft, request)
  return { request, intent, draft: resolved }
}
