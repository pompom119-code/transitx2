import { addDays } from '../tripDates.js'
import { distanceKm, insideGeometry } from './geo.js'

export function validateSmartTrip(trip, request, sourceIds, center, radiusKm, geometry) {
  if (!trip || trip.days?.length !== request.days || trip.destination !== request.destination) throw new Error('行程天數或目的地不一致。')
  const used = new Set(), must = new Set(request.mustVisitPlaces.map(value=>value.normalize('NFKC').trim()))
  for (let dayIndex=0;dayIndex<trip.days.length;dayIndex++) {
    const day = trip.days[dayIndex]
    if (day.date !== (request.startDate ? addDays(request.startDate,dayIndex) : '')) throw new Error('行程日期不一致。')
    if (day.spots.filter(spot=>spot.type==='poi').length < 1) throw new Error('目前能取得的地點資料不足以安排完整行程。')
    let previous = ''
    for (const spot of day.spots) {
      if (previous && spot.time < previous) throw new Error('行程時間順序錯誤。')
      previous = spot.time
      if (spot.type !== 'poi') continue
      if (!sourceIds.has(spot.poiId) || !/OpenStreetMap|Wikipedia/.test(spot.source || '') || !Number.isFinite(spot.latitude) || !Number.isFinite(spot.longitude)) throw new Error('行程包含未查核的地點。')
      if (distanceKm(spot,center) > radiusKm + 1) throw new Error('行程包含目的地範圍外的地點。')
      if (insideGeometry(spot,geometry) === false) throw new Error('行程包含目的地行政區外的地點。')
      if (used.has(spot.poiId)) throw new Error('行程重複安排地點。')
      used.add(spot.poiId)
      if (spot.requiredPlace) must.delete(spot.requiredPlace.normalize('NFKC').trim())
    }
  }
  if (must.size) throw new Error(`部分指定地點無法合理安排：${[...must].join('、')}`)
  return trip
}
