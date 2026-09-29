import { distanceKm } from './geo.js'

export function nearbyFoodOptions(anchor, foodPois, request) {
  const needs = `${request.specialRequirements || ''} ${request.optionalNotes || ''}`
  const vegetarian = /素食|不吃肉|vegan|vegetarian/i.test(needs)
  const noBeef = /不吃牛|忌牛|無牛|no beef/i.test(needs)
  return foodPois.filter(poi => distanceKm(poi, anchor) <= 1.2)
    .filter(poi => !vegetarian || /vegetarian|vegan/.test(poi.tags?.diet || '') || poi.category === 'cafe')
    .filter(poi => !noBeef || !/牛肉|beef/i.test(`${poi.name} ${poi.tags?.cuisine || ''}`))
    .sort((a,b) => distanceKm(a,anchor)-distanceKm(b,anchor)).slice(0,5)
    .map(poi => ({ id:poi.id, name:poi.name, latitude:poi.latitude, longitude:poi.longitude, source:poi.source, distanceKm:Number(distanceKm(poi,anchor).toFixed(2)) }))
}

export function foodSuggestion(request) {
  const needs = `${request.specialRequirements || ''} ${request.optionalNotes || ''}`
  if (/素食|不吃肉|vegan|vegetarian/i.test(needs)) return '在附近安排符合飲食需求的一餐，點餐前請確認食材。'
  if (/過敏|不吃牛|忌牛|無牛/.test(needs)) return '在附近安排一餐，點餐前請確認飲食限制。'
  if (/小資|經濟|低預算|省錢/.test(`${request.budget} ${needs}`)) return '在附近找一份價格合適的餐點，店家由你挑選。'
  return '在附近安排一餐，依當下喜好挑選店家。'
}
