import test from 'node:test'
import assert from 'node:assert/strict'
import { aiPlanner } from './fixtures/mockPlanner.js'
import { busRoutes, busStops } from '../src/data/mockData.js'
import { answerText, isPresetProfile, travelerCount } from '../src/services/profile.js'
import { rankTransitSearch, resolveStop } from '../src/services/transitService.js'
import { addDays, inclusiveDays, parseDate, tripFormError } from '../src/services/tripDates.js'

globalThis.window = globalThis

test('date utilities keep the selected range and day count coherent', () => {
  assert.equal(addDays('2026-09-23', 3), '2026-09-26')
  assert.equal(inclusiveDays('2026-09-23', '2026-09-26'), 4)
  assert.equal(parseDate('2026-02-30'), null)
  assert.equal(inclusiveDays('2026-09-26', '2026-09-23'), 0)
  const form = { destination: '東京', startDate: '2026-09-23', endDate: '2026-09-26', days: 4 }
  assert.equal(tripFormError(form), '')
  assert.match(tripFormError({ ...form, days: 5 }), /不一致/)
  assert.match(tripFormError({ ...form, endDate: '2026-09-22' }), /不能早於/)
  assert.match(tripFormError({ ...form, destination: '東' }), /至少兩個字/)
  assert.equal(tripFormError({ ...form, dateUnknown: true, days: 5 }), '')
})

test('profiles remain human readable and distinguish presets from user settings', () => {
  assert.equal(answerText({ selected: ['不吃牛肉'], text: '需無障礙' }), '不吃牛肉、需無障礙')
  assert.equal(travelerCount({ answers: { companions: '自己' } }), 1)
  assert.equal(travelerCount({ answers: { companions: '情侶' } }), 2)
  assert.equal(travelerCount({ answers: { companions: '家人' } }), 4)
  assert.equal(isPresetProfile({ id: 'solo' }), true)
  assert.equal(isPresetProfile({ id: 'custom-1' }), false)
})

test('bus search ranks exact route and stop ahead of partial matches', () => {
  const route307 = rankTransitSearch('307')
  assert.equal(route307.routes[0].id, '307')
  const route666 = rankTransitSearch('666')
  assert.equal(route666.routes[0].id, '666')
  assert.equal(route666.routes.some((route) => route.id === '795'), false)
  assert.equal(rankTransitSearch('石碇高中').stops[0].name, '石碇高中')
  assert.deepEqual(rankTransitSearch('不存在的站牌').routes, [])
})

test('every listed mock stop has a resolvable page and matching route', () => {
  for (const route of busRoutes) {
    assert.deepEqual(route.inbound, [...route.outbound].reverse())
    assert.ok(route.outbound.length >= 2)
    for (const name of route.outbound) {
      const stop = resolveStop(name)
      assert.ok(stop, `${name} should resolve`)
      assert.ok(stop.routes.includes(route.id), `${name} should list route ${route.id}`)
    }
  }
  for (const stop of busStops) {
    assert.ok(resolveStop(stop.id))
    for (const routeId of stop.routes) {
      assert.ok(busRoutes.find((route) => route.id === routeId)?.outbound.includes(stop.name))
    }
  }
})

test('mock planner carries profile, destination, dates and spots consistently', async () => {
  const form = { destination: '東京', startDate: '2026-09-23', endDate: '2026-09-25', days: 3, places: ['淺草寺'], dateUnknown: false }
  const profile = { id: 'solo-test', answers: { companions: '自己', exploration: '在地派', budget: '經濟實用' } }
  const trip = await aiPlanner.generateTrip(form, profile)
  assert.equal(trip.travelerCount, 1)
  assert.equal(trip.destination, '東京')
  assert.equal(trip.isDemo, true)
  assert.equal(trip.days.length, 3)
  assert.deepEqual(trip.days.map((day) => day.date), ['2026-09-23', '2026-09-24', '2026-09-25'])
  assert.equal(trip.days[0].spots[0].title, '淺草寺')
  assert.ok(trip.days.every((day) => day.spots.every((spot) => spot.location.startsWith('東京・'))))
  assert.ok(trip.days.every((day) => day.spots.every((spot) => ['公車', '步行'].includes(spot.transportMode))))
})
