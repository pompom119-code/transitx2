import { addDays } from '../tripDates.js'
import { travelStyle, answerText } from '../profile.js'

const id = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
const label = item => item.type === 'poi' ? item.name : item.type === 'food' ? `${item.area}用餐` : item.title
export function toTrip(plan, form, profile, source = 'Browser Local AI') {
  const { request, intent, draft } = plan
  const startHour = /下午才|午後才|不要太早/.test(request.specialRequirements + request.optionalNotes) ? 13 : /慢|輕鬆|悠閒/.test(request.travelPace) ? 10 : 9
  return {
    id: `trip-${id()}`, title: `${request.destination} ${request.days} 日行程`, destination: request.destination,
    startDate: request.startDate, endDate: request.endDate, dateUnknown: !request.startDate,
    profileId: profile.id, travelerCount: request.travelerCount, style: travelStyle(profile),
    budget: answerText(profile.answers.budget), isDemo: false, source, createdAt: new Date().toISOString(),
    request: { form, profile }, intent,
    days: draft.days.map((day, dayIndex) => {
      let clock = startHour * 60
      return {
        id: `day-${id()}`, label: `Day ${dayIndex + 1}`,
        date: request.startDate ? addDays(request.startDate, dayIndex) : '', title: day.theme,
        spots: day.items.map((item, itemIndex) => {
          const time = `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`
          clock += item.estimatedDurationMinutes + (itemIndex < day.items.length - 1 ? 20 : 0)
          const segment = day.segments[itemIndex]
          return {
            id: `spot-${id()}`, type: item.type, time, title: label(item),
            detail: item.type === 'food' ? item.foods.join('＋') + '・' + item.reason : item.reason,
            category: { poi: '景點', food: '餐飲', activity: '活動', break: '休息' }[item.type],
            location: item.type === 'food' ? `${item.area}・店家未指定` : item.type === 'poi' ? item.verificationStatus === 'verified' ? item.address : '位置尚未驗證' : item.area || '區域未指定',
            reason: item.reason, estimatedDuration: item.estimatedDurationMinutes,
            verificationStatus: item.verificationStatus || null,
            source: item.source || null,
            latitude: item.coordinates?.latitude ?? null, longitude: item.coordinates?.longitude ?? null,
            foods: item.type === 'food' ? item.foods : [], foodArea: item.type === 'food' ? item.area : null,
            restaurantId: item.type === 'food' ? null : undefined, restaurantOptions: item.type === 'food' ? [] : undefined,
            favorite: false, requiredPlace: request.mustVisitPlaces.find(place => item.type === 'poi' && item.name.includes(place)) || '',
            transport: segment || null, transportMode: '交通待確認', transportMinutes: null,
            transportDetail: '尚未連接路線資料，請自行確認移動方式',
          }
        }),
      }
    }),
  }
}
