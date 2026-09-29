import test from 'node:test'
import assert from 'node:assert/strict'
import { planTrip } from '../src/services/ai/pipeline.js'
import { normalizeRequest, validateDraft } from '../src/services/ai/contracts.js'
import { toTrip } from '../src/services/ai/tripAdapter.js'
import { createPlaceResolver, verifyAndResolve } from '../server/ai/places.js'
import { createPlanner } from '../server/ai/planner.js'
import { ApiError } from '../server/core.js'
import { addDays } from '../src/services/tripDates.js'

const form = (destination = '淡水', days = 1, places = []) => ({ destination, days,
  startDate: '2026-10-01', endDate: addDays('2026-10-01', days - 1), dateUnknown: false,
  places, optionalNotes: '下午可以保留一些自由時間', travelerCount: 2 })
const profile = (companions = '朋友', interests = ['美食', '拍照'], notes = '') => ({ id: 'test', answers: {
  companions, interests, exploration: '探索派', transport: ['公車', '步行'], walking: '普通',
  budget: '中等', pace: '輕鬆', notes: { selected: [], text: notes },
} })
const intent = days => ({ travelApproach: '按同行者偏好規劃', pace: '午後慢遊', foodFocus: '在地料理',
  poiFocus: '文化與拍照', walkingPlan: '控制步行量', transportPlan: '交通待查核',
  dailyThemes: Array.from({ length: days }, (_, i) => `第 ${i + 1} 天主題`) })
const item = (type, value, duration = 60) => ({ type, name: type === 'poi' ? value : '',
  title: type === 'poi' || type === 'food' ? '' : value, area: type === 'food' ? '目的地餐飲區' : '',
  foods: type === 'food' ? ['米飯'] : [], reason: '符合旅行設定', estimatedDurationMinutes: duration })
function fixtureModel(seed = 0) {
  const prompts = []
  return { prompts, async prepare() {}, async generate(_system, prompt) {
    const input = JSON.parse(prompt); prompts.push(input)
    if (input.phase === 'travel-intent') return intent(input.request.days)
    if (input.phase === 'itinerary-construction-repair') return item(input.instruction.includes('type 必須是 poi') ? 'poi' : input.instruction.includes('type 必須是 food') ? 'food' : 'activity', '河岸散步', 40)
    const assigned = input.assignedMustVisit.map(place => item('poi', place))
    const interest = input.request.interests.replace(/、/g, '')
    const items = [...assigned, item('poi', `${input.request.destination}${interest}測試點${seed}`), item('food', ''), item('break', '午後休息', 30)]
    return { theme: `依照${interest}安排`, items }
  } }
}
const noopResolvers = { places: { async resolvePlace(value) { return { ...value, verificationStatus: 'pending', address: null, coordinates: null } } } }

test('two-phase planner passes every profile and request field; no model-supplied factual fields survive', async () => {
  const input = form('淡水', 2, ['紅毛城'])
  const traveler = profile('朋友', ['美食', '拍照'], '不吃牛肉')
  const model = fixtureModel(1), events = []
  const plan = await planTrip(input, traveler, model, event => events.push(event), undefined, noopResolvers)
  assert.equal(model.prompts[0].phase, 'travel-intent')
  assert.equal(model.prompts[1].phase, 'itinerary-construction')
  assert.equal(model.prompts[0].request.travelerCount, 2)
  assert.equal(model.prompts[0].request.specialRequirements, '不吃牛肉')
  assert.deepEqual(model.prompts[0].request.mustVisitPlaces, ['紅毛城'])
  assert.equal(plan.draft.days.length, 2)
  assert.ok(plan.draft.days[0].items.some(value => value.name === '紅毛城'))
  assert.ok(plan.draft.days[0].items.some(value => value.type === 'food' && value.restaurantId === null))
  assert.ok(plan.draft.days[0].segments.every(value => value.status === 'unresolved' && value.minutes === null))
  assert.deepEqual(events.slice(0, 2).map(value => value.step), [0, 1])
  assert.deepEqual(events.slice(-2).map(value => value.step), [3, 4])
  assert.ok(events.filter(value => value.step === 2).length >= 3)
  const trip = toTrip(plan, input, traveler)
  assert.ok(trip.days[0].spots.every(value => value.transportMinutes === null))
  assert.ok(trip.days[0].spots.some(value => value.type === 'food' && value.restaurantId === null))
})

test('solo is exactly one traveler, companion count can be explicitly set', () => {
  assert.equal(normalizeRequest({ ...form(), travelerCount: null }, profile('自己')).travelerCount, 1)
  assert.throws(() => normalizeRequest(form(), profile('自己')), /同行人數/)
  assert.equal(normalizeRequest({ ...form(), travelerCount: 4 }, profile('家人')).travelerCount, 4)
})

test('rejects wrong destination, date, count, missing must-visit, named restaurants and dietary conflict', () => {
  const request = normalizeRequest(form('淡水', 1, ['紅毛城']), profile('朋友', ['美食'], '不吃牛肉'))
  const base = { destination: '淡水', travelerCount: 2, days: [{ date: request.startDate, theme: '測試', items: [item('poi', '紅毛城'), item('poi', '漁人碼頭'), item('food', ''), item('activity', '河岸散步', 40)] }] }
  validateDraft(base, request)
  assert.throws(() => validateDraft({ ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('food', ''), item('activity', '紅毛城攝影')] }] }, request), /至少兩個不同景點/)
  for (const changed of [
    { ...base, destination: '東京' }, { ...base, travelerCount: 3 },
    { ...base, days: [{ ...base.days[0], date: '2026-10-02' }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '漁人碼頭'), item('food', '')] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), { ...item('food', ''), name: '某某老店' }] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), { ...item('food', ''), foods: ['牛肉麵'] }] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('poi', '紅毛城'), item('food', '')] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('poi', '紅毛城老街'), item('food', '')] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), { ...item('food', ''), foods: ['紅毛城'] }, item('activity', '拍照', 30)] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), { ...item('food', ''), foods: ['紅毛城肉圓'] }, item('activity', '拍照', 30)] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), { ...item('food', ''), foods: ['紅肉肉'] }, item('break', '休息', 30)] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), { ...item('food', ''), foods: ['紅毛城老街特色小吃'] }, item('break', '休息', 30)] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('food', '', 10), item('break', '休息', 30)] }] },
    { ...base, days: [{ ...base.days[0], items: [{ ...item('poi', '紅毛城'), reason: '下午2點開放遊客' }, item('food', ''), item('break', '休息', 30)] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('food', ''), item('poi', '紅毛城周邊文化空間')] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('food', ''), item('activity', '公車接駁與歸程')] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('food', ''), { ...item('break', '午餐休息'), foods: ['蚵仔煎'] }] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), { ...item('food', ''), foods: ['台菜/傳統料理'] }, item('activity', '拍照')] }] },
    { ...base, days: [{ ...base.days[0], items: [item('poi', '紅毛城'), item('food', ''), { ...item('activity', '返回旅館'), reason: '利用捷運系統返回' }] }] },
  ]) assert.throws(() => validateDraft(changed, request))
})

test('same destination and different profiles reach the model intact; no city template branch', async () => {
  const cases = [profile('朋友', ['美食', '拍照']), profile('自己', ['攝影', '文化']),
    profile('家人', ['經典'], '少走路'), profile('朋友', ['美食'], '預算低')]
  const signatures = []
  for (const [index, traveler] of cases.entries()) {
    const input = { ...form(), travelerCount: traveler.answers.companions === '自己' ? 1 : 2 }
    const model = fixtureModel(index)
    const plan = await planTrip(input, traveler, model, undefined, undefined, noopResolvers)
    signatures.push(plan.draft.days[0].items.map(value => value.name || value.title || value.foods.join('')).join('|'))
    assert.equal(model.prompts[0].request.interests, traveler.answers.interests.join('、'))
    assert.equal(model.prompts[0].request.travelerType, traveler.answers.companions)
  }
  assert.equal(new Set(signatures).size, 4)
})

test('a model omission cannot silently remove the user-provided must-visit POI', async () => {
  const input = form('淡水', 1, ['紅毛城'])
  const model = fixtureModel()
  const original = model.generate.bind(model)
  model.generate = async (...args) => {
    const value = await original(...args)
    if (Array.isArray(value.items)) value.items = value.items.filter(entry => entry.name !== '紅毛城')
    return value
  }
  const plan = await planTrip(input, profile(), model, undefined, undefined, noopResolvers)
  assert.ok(plan.draft.days[0].items.some(value => value.type === 'poi' && value.name === '紅毛城'))
})

test('missing meal is generated by the model in phase two, never inserted from a city fixture', async () => {
  const phases = []
  const model = { async prepare() {}, async generate(_system, prompt) {
    const input = JSON.parse(prompt); phases.push(input.phase)
    if (input.phase === 'travel-intent') return intent(input.request.days)
    if (input.phase === 'itinerary-construction-repair') {
      if (input.requiredType === 'poi') return item('poi', '漁人碼頭')
      assert.equal(input.requiredType, 'food')
      return { ...item('food', '', 50), area: '淡水老街', foods: ['阿給', '魚丸湯'] }
    }
    return { theme: '慢遊', items: [item('poi', '紅毛城'), item('activity', '河岸拍照', 50)] }
  } }
  const plan = await planTrip(form('淡水', 1, ['紅毛城']), profile(), model, undefined, undefined, noopResolvers)
  assert.deepEqual(phases, ['travel-intent', 'itinerary-construction', 'itinerary-construction-repair', 'itinerary-construction-repair'])
  assert.equal(plan.draft.days[0].items.filter(value => value.type === 'poi').length, 2)
  assert.deepEqual(plan.draft.days[0].items.find(value => value.type === 'food').foods, ['阿給', '魚丸湯'])
})

test('out-of-destination POI triggers one model replan instead of saving a false location', async () => {
  let draftCalls = 0, checks = 0
  const model = { async prepare() {}, async generate(_system, prompt) {
    const input = JSON.parse(prompt)
    if (input.phase === 'travel-intent') return intent(input.request.days)
    draftCalls++
    return { theme: '正確地理', items: [item('poi', '紅毛城'), item('poi', draftCalls === 1 ? '觀音亭' : '漁人碼頭'), item('food', '')] }
  } }
  const resolvers = { async resolveDraft(draft) {
    checks++
    if (draft.days[0].items.some(value => value.name === '觀音亭')) throw new ApiError('GEOGRAPHY', '「觀音亭」不在「淡水」附近', 422)
    return { ...draft, days: draft.days.map(day => ({ ...day, segments: [], items: day.items })) }
  } }
  const plan = await planTrip(form('淡水', 1, ['紅毛城']), profile(), model, undefined, undefined, resolvers)
  assert.equal(draftCalls, 2)
  assert.equal(checks, 2)
  assert.ok(plan.draft.days[0].items.some(value => value.name === '漁人碼頭'))
  assert.ok(!plan.draft.days[0].items.some(value => value.name === '觀音亭'))
})

test('place resolver verifies provider coordinates and rejects a known out-of-city POI', async () => {
  const results = query => query.includes('紅毛城')
    ? [{ name: '紅毛城', lat: '25.175', lon: '121.433', display_name: '紅毛城, 淡水區, 臺灣', address: { country_code: 'tw' }, osm_id: 2 }]
    : query.includes('台北101')
      ? [{ name: '台北101', lat: '25.033', lon: '121.565', display_name: '台北101, 台北市, 臺灣', address: { country_code: 'tw' }, osm_id: 3 }]
      : [{ name: '淡水區', type: 'administrative', lat: '25.181', lon: '121.453', display_name: '淡水區, 臺灣', address: { country_code: 'tw' } }]
  const resolver = createPlaceResolver(async url => Response.json(results(new URL(url).searchParams.get('q'))))
  const region = await resolver.resolveDestination('淡水')
  const verified = await resolver.resolvePlace(item('poi', '紅毛城'), '淡水', region)
  assert.equal(verified.verificationStatus, 'verified')
  assert.equal(verified.coordinates.latitude, 25.175)
  await assert.rejects(resolver.resolvePlace(item('poi', '台北101'), '淡水', region), error => error.code === 'GEOGRAPHY')
})

test('destination resolution does not select an unrelated same-name village over a city', async () => {
  const resolver = createPlaceResolver(async url => {
    const query = new URL(url).searchParams.get('q')
    return Response.json(query === '高雄市'
      ? [{ name: '高雄市', type: 'administrative', lat: '22.62', lon: '120.31', address: { country_code: 'tw' } }]
      : [{ name: '高雄', type: 'station', lat: '22.64', lon: '120.30', address: { country_code: 'tw' } },
        { name: '高雄村', type: 'village', lat: '22.15', lon: '110.71', address: { country_code: 'cn' } }])
  })
  const region = await resolver.resolveDestination('高雄')
  assert.equal(region.name, '高雄市')
  assert.equal(region.address.country_code, 'tw')
})

test('administrative city wins over a same-name station or foreign town', async () => {
  const resolver = createPlaceResolver(async () => Response.json([
    { name: '台南', type: 'station', lat: '22.92', lon: '120.28', address: { country_code: 'tw' } },
    { name: '台南', type: 'town', lat: '32.81', lon: '120.35', address: { country_code: 'cn' } },
    { name: '臺南市', type: 'administrative', lat: '22.99', lon: '120.18', address: { country_code: 'tw' } },
  ]))
  const region = await resolver.resolveDestination('台南')
  assert.equal(region.name, '臺南市')
  assert.equal(region.address.country_code, 'tw')
})

test('place resolver rejects synthetic suffix POIs and resolves verified multilingual aliases', async () => {
  const resolver = createPlaceResolver(async url => {
    const query = new URL(url).searchParams.get('q')
    if (query === '東京') return Response.json([{ name: '東京', type: 'administrative', lat: '35.71', lon: '139.79', address: { country_code: 'jp' } }])
    if (query === 'Tokyo Skytree') return Response.json([{ name: 'Tokyo Skytree', type: 'attraction', lat: '35.71', lon: '139.81',
      address: { country_code: 'jp' }, namedetails: { 'name:zh': '東京晴空塔（天空樹）', 'name:en': 'Tokyo Skytree' } }])
    if (query.includes('晴空塔')) return Response.json([{ name: '东京晴空塔', type: 'station', lat: '35.71', lon: '139.81',
      address: { country_code: 'jp' }, namedetails: { 'name:zh': '东京晴空塔', 'name:en': 'Tokyo Skytree' } }])
    if (query.includes('周邊文化空間')) return Response.json([{ name: '台中國家歌劇院', type: 'theatre', lat: '24.16', lon: '120.64', address: { country_code: 'tw' } }])
    return Response.json([])
  })
  const region = await resolver.resolveDestination('東京')
  const skytree = await resolver.resolvePlace({ name: '東京晴空塔' }, '東京', region)
  assert.equal(skytree.verificationStatus, 'verified')
  assert.equal(skytree.source, 'OpenStreetMap / Nominatim')
  const fake = await resolver.resolvePlace({ name: '台中國家歌劇院周邊文化空間' }, '東京', region)
  assert.equal(fake.verificationStatus, 'pending')
})

test('place resolver recognizes an official map alternate name without trusting unrelated locations', async () => {
  const resolver = createPlaceResolver(async url => {
    const query = new URL(url).searchParams.get('q')
    if (query === '淡水') return Response.json([{ name: '淡水區', type: 'administrative', lat: '25.181', lon: '121.453', address: { country_code: 'tw' } }])
    if (query.includes('淡水老街')) return Response.json([{ name: '中正路', type: 'living_street', lat: '25.172', lon: '121.438',
      address: { country_code: 'tw' }, namedetails: { name: '中正路', alt_name: '淡水老街', 'alt_name:en': 'Tamsui Old Street' } }])
    return Response.json([])
  })
  const region = await resolver.resolveDestination('淡水')
  const place = await resolver.resolvePlace({ name: '淡水老街' }, '淡水', region)
  assert.equal(place.verificationStatus, 'verified')
  assert.equal(place.coordinates.latitude, 25.172)
})

test('AI-invented POIs and meal areas cannot enter final trip without provider verification', async () => {
  const request = normalizeRequest(form('淡水', 1, ['紅毛城']), profile())
  const fakeResolver = { async resolveDestination() { return {} }, async resolvePlace(value) {
    return { ...value, verificationStatus: ['紅毛城', '漁人碼頭'].includes(value.name) ? 'verified' : 'pending' }
  } }
  const draft = items => ({ destination: '淡水', travelerCount: 2,
    days: [{ date: request.startDate, theme: '測試', items }] })
  await assert.rejects(verifyAndResolve(draft([item('poi', '紅毛城'), item('poi', '觀音亭'), { ...item('food', ''), area: '淡水' }]), request, fakeResolver),
    error => error.code === 'PLACE_UNVERIFIED')
  await assert.rejects(verifyAndResolve(draft([item('poi', '紅毛城'), item('poi', '漁人碼頭'), { ...item('food', ''), area: '永康街' }]), request, fakeResolver),
    error => error.code === 'FOOD_AREA_UNVERIFIED')
})

test('generic area suffixes are stripped only for factual meal-area lookup', async () => {
  const request = normalizeRequest(form('東京', 1, ['東京鐵塔']), profile())
  const lookedUp = []
  const resolver = { async resolveDestination() { return {} }, async resolvePlace(value) {
    lookedUp.push(value.name)
    return { ...value, verificationStatus: ['東京鐵塔', '淺草寺', '銀座'].includes(value.name) ? 'verified' : 'pending' }
  } }
  const draft = { destination: '東京', travelerCount: 2, days: [{ date: request.startDate, theme: '攝影',
    items: [item('poi', '東京鐵塔'), item('poi', '淺草寺'), { ...item('food', ''), area: '銀座地區' }] }] }
  const result = await verifyAndResolve(draft, request, resolver)
  assert.ok(lookedUp.includes('銀座'))
  assert.equal(result.days[0].items[2].area, '銀座地區')
})

test('provider rate limit stops generation; no fallback itinerary', async () => {
  const planner = createPlanner({}, { provider: { ready: () => true, async generate() { throw new ApiError('RATE_LIMIT', 'quota', 429) } },
    places: { resolveDestination: async () => ({}), resolvePlace: async value => value } })
  await assert.rejects(planner({ operation: 'generate', form: form(), profile: profile() }), error => error.code === 'RATE_LIMIT')
})
