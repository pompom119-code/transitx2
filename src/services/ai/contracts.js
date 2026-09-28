import { addDays, tripFormError } from '../tripDates.js'
import { answerText, travelerCount } from '../profile.js'

const text = { type: 'string' }
const integer = { type: 'integer' }
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const list = (items, minItems = 0, maxItems = 30) => ({ type: 'array', items, minItems, maxItems })

export const intentSchema = object({
  travelApproach: text, pace: text, foodFocus: text, poiFocus: text,
  walkingPlan: text, transportPlan: text, dailyThemes: list(text, 1, 14),
})
export const draftItemSchema = object({
  type: { type: 'string', enum: ['poi', 'food', 'activity', 'break'] },
  name: text, title: text, area: text, foods: list(text, 0, 5),
  reason: text, estimatedDurationMinutes: integer,
})
export const dayDraftSchema = object({ theme: text, items: list(draftItemSchema, 1, 9) })
export const draftSchema = object({
  destination: text, travelerCount: integer,
  days: list(object({ date: text, theme: text, items: list(draftItemSchema, 1, 9) }), 1, 14),
})

export function assertContract(value, schema, path = 'AI') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} 必須是物件`)
    for (const key of schema.required) if (!(key in value)) throw new Error(`${path}.${key} 缺少`)
    for (const key of Object.keys(value)) if (!schema.properties[key]) throw new Error(`${path}.${key} 不允許`)
    for (const [key, rule] of Object.entries(schema.properties)) assertContract(value[key], rule, `${path}.${key}`)
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) throw new Error(`${path} 數量錯誤`)
    value.forEach((item, index) => assertContract(item, schema.items, `${path}[${index}]`))
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length > 600 || (schema.enum && !schema.enum.includes(value))) throw new Error(`${path} 文字格式錯誤`)
  } else if (!Number.isInteger(value) || value < 0 || value > 600) throw new Error(`${path} 數值格式錯誤`)
}

export function normalizeRequest(form, profile) {
  const error = tripFormError(form)
  if (error) throw new Error(error)
  if (!profile?.answers) throw new Error('請先選擇旅行設定。')
  const answers = profile.answers
  const request = {
    destination: form.destination.trim(), startDate: form.dateUnknown ? '' : form.startDate,
    endDate: form.dateUnknown ? '' : form.endDate, days: form.days,
    travelerType: answerText(answers.companions), travelerCount: Number.isInteger(form.travelerCount) ? form.travelerCount : travelerCount(profile),
    interests: answerText(answers.interests), explorationLevel: answerText(answers.exploration),
    transportPreference: answerText(answers.transport), walkingPreference: answerText(answers.walking),
    budget: answerText(answers.budget), travelPace: answerText(answers.pace),
    specialRequirements: answerText(answers.notes, '無'),
    mustVisitPlaces: Array.isArray(form.places) ? form.places.map(value => String(value).trim()).filter(Boolean) : [],
    optionalNotes: String(form.optionalNotes || '').trim(),
  }
  if (request.mustVisitPlaces.length > 14 || request.optionalNotes.length > 500) throw new Error('指定地點或補充需求過長。')
  if (request.travelerCount < 1 || request.travelerCount > 20 || (request.travelerType === '自己' && request.travelerCount !== 1)) throw new Error('同行人數與旅行設定不一致。')
  return request
}

const normalize = value => String(value || '').normalize('NFKC').replace(/臺/g, '台').replace(/[\s·・、，,]/g, '').toLowerCase()
const otherCity = /台北101|臺北101|高雄駁二|東京晴空塔|大阪城|西門町|淡水老街|駁二藝術特區|東京鐵塔/i
export function validateDraft(draft, request, { requireComplete = true } = {}) {
  assertContract(draft, draftSchema)
  if (normalize(draft.destination) !== normalize(request.destination)) throw new Error('AI 目的地與輸入不符')
  if (draft.travelerCount !== request.travelerCount || draft.days.length !== request.days) throw new Error('AI 人數或天數與輸入不符')
  const allItems = draft.days.flatMap(day => day.items)
  draft.days.forEach((day, index) => {
    const expected = request.startDate ? addDays(request.startDate, index) : ''
    if (day.date !== expected) throw new Error('AI 日期與輸入不符')
    if (day.items.some(item => item.estimatedDurationMinutes < 10 || item.estimatedDurationMinutes > 240)) throw new Error('AI 停留時間不合理')
    const duration = day.items.reduce((sum, item) => sum + item.estimatedDurationMinutes, 0)
    const afternoon = /下午才|午後才|不要太早/.test(request.specialRequirements + request.optionalNotes)
    const startHour = afternoon ? 13 : /慢|輕鬆|悠閒/.test(request.travelPace) ? 10 : 9
    if (duration + Math.max(0, day.items.length - 1) * 20 > (22 - startHour) * 60) throw new Error('單日安排超出可用時間')
    if (requireComplete && (day.items.length < 3 || !day.items.some(item => item.type === 'poi') || !day.items.some(item => item.type === 'food') || day.items.filter(item => item.type === 'poi' || item.type === 'activity').length < 2)) throw new Error('每日需有景點、餐飲與完整活動安排')
    const pois = day.items.filter(item => item.type === 'poi').map(item => normalize(item.name))
    if (new Set(pois).size !== pois.length) throw new Error('同一天不可重複安排同一景點')
    if (pois.some((first, left) => pois.some((second, right) => left !== right && first.length >= 3 && second.includes(first)))) throw new Error('景點名稱高度重疊，可能是同地重複或虛構名稱')
    if (day.items.some(item => item.type === 'food' && item.foods.some(food => pois.some(poi => poi.length >= 3 && normalize(food).includes(poi))))) throw new Error('餐飲內容不能冒用景點名稱')
    const meals = day.items.filter(item => item.type === 'food').map(item => normalize(item.area) + ':' + item.foods.map(normalize).join('|'))
    if (new Set(meals).size !== meals.length) throw new Error('同一天餐飲建議重複')
  })
  for (const must of request.mustVisitPlaces) {
    if (!allItems.some(item => item.type === 'poi' && normalize(item.name).includes(normalize(must)))) throw new Error(`遺漏指定地點：${must}`)
  }
  for (const item of allItems) {
    const narrative = [item.name, item.title, item.reason].join(' ')
    if (/(?:營業|開放|打烊|關門).{0,10}\d{1,2}(?:[:：]\d{2})?[點時]|\d{1,2}(?:[:：]\d{2})?[點時].{0,10}(?:營業|開放|打烊|關門)|(?:即時|目前).{0,6}(?:人潮|人少|排隊)|評分\s*\d(?:\.\d)?|公車.{0,8}\d+\s*分鐘(?:後)?到/.test(narrative)) throw new Error('AI 宣稱未經查證的營業、人潮、評分或即時交通資訊')
    if (item.type === 'poi' && !item.name.trim()) throw new Error('景點缺少名稱')
    if (item.type === 'food' && (!item.area.trim() || !item.foods.length || item.name.trim() || item.title.trim() || /餐廳|食堂|小吃店|咖啡館|老店|分店/.test(item.area))) throw new Error('餐飲只能提供區域與食物，不得指定店名')
    if (item.type === 'food' && (item.estimatedDurationMinutes < 30 || item.estimatedDurationMinutes > 120 || item.foods.some(food => !food.trim() || /(\p{Script=Han})\1/u.test(food) || /特色小吃|在地美食|當地美食|美食體驗|老街|餐飲/.test(food)))) throw new Error('餐飲內容或停留時間不合理')
    if (item.type === 'food' && item.foods.some(food => /(?:地區料理|本地餐食|傳統餐食|在地風味小吃|在地小吃|當地小吃|傳統飲食文化|台菜[／/]傳統料理|當地料理|在地料理)/.test(food))) throw new Error('餐飲須提出可辨識的食物，不可只寫籠統料理類別')
    if (item.type === 'activity' && !item.title.trim()) throw new Error('活動缺少名稱')
    if (item.type === 'break' && !item.title.trim()) throw new Error('休息缺少名稱')
    if (item.type !== 'food' && item.foods.length) throw new Error('餐飲內容只能放在 food 項目，不能藏在休息或活動中')
    if (item.type === 'activity' && /公車|捷運|地鐵|地铁|巴士|交通|接駁|轉乘|歸程|返程|回程/.test(item.title)) throw new Error('交通移動不是活動，應交由 Transport Resolver 處理')
    if (item.type === 'activity' && /少走路|步行少|減少步行/.test(request.walkingPreference + request.specialRequirements) && /步行|徒步|散步|緩步/.test(item.title) && item.estimatedDurationMinutes > 45) throw new Error('活動步行時間與少走路需求不符')
    if (/(?:搭乘|利用|轉乘|接駁).{0,8}(?:捷運|地鐵|地铁|metro|MRT)/i.test(narrative) && /公車|步行/.test(request.transportPreference) && !/捷運|地鐵|地铁|metro|MRT/i.test(request.transportPreference)) throw new Error('交通方式與旅行設定偏好不符')
    if (item.type !== 'poi' && item.name.trim()) throw new Error('非景點項目不得有店家／景點名稱')
    if (/牛肉|牛排|牛舌|beef/i.test(request.specialRequirements) && /不吃牛|忌牛|無牛|no beef/i.test(request.specialRequirements) && item.type === 'food' && item.foods.some(food => /牛肉|牛排|牛舌|beef/i.test(food))) throw new Error('餐飲違反不吃牛肉的需求')
    if (item.type === 'poi' && otherCity.test(item.name) && !normalize(item.name).includes(normalize(request.destination)) && !normalize(request.destination).includes('台北') && /台北101|臺北101|西門町/.test(item.name)) throw new Error('景點疑似跨目的地')
  }
  return draft
}
