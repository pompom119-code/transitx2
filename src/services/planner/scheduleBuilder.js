import { distanceKm } from './geo.js'
import { reasonText } from './types.js'
import { nearbyFoodOptions, foodSuggestion } from './foodPlanner.js'

export function targetCount(request) {
  const pace = `${request.travelPace} ${request.specialRequirements} ${request.optionalNotes}`
  if (/不要排太滿|悠閒|輕鬆|晚起|慢遊/.test(pace) || /長輩|步行少|隨緣/.test(request.walkingPreference)) return 2
  if (/充實|早起/.test(pace) && !/步行少|隨緣/.test(request.walkingPreference)) return 4
  return 3
}
export function startMinute(request) {
  const notes = `${request.travelPace} ${request.specialRequirements} ${request.optionalNotes}`
  if (/下午才|午後才|下午出發/.test(notes)) return 13 * 60
  if (/晚起|不要太早/.test(notes)) return 10 * 60 + 30
  if (/早起/.test(notes)) return 8 * 60 + 30
  return /悠閒|輕鬆|慢遊/.test(notes) ? 10 * 60 : 9 * 60 + 30
}
export function durationFor(poi, request) {
  const base = { museum:100, theme_park:150, zoo:140, park:70, garden:65, natural:75, viewpoint:45, artwork:30, historic:65, attraction:65, gallery:70, marketplace:70, arts_centre:75, theatre:90, mall:75, pedestrian:55, cafe:55 }[poi.category] || 60
  const pace = `${request.travelPace} ${request.specialRequirements} ${request.optionalNotes}`
  return Math.max(25, Math.min(180, Math.round(base * (/悠閒|輕鬆|慢遊/.test(pace) ? 1.2 : /充實/.test(pace) ? .85 : 1) / 5) * 5))
}
const timeText = minute => `${String(Math.floor(minute / 60)).padStart(2,'0')}:${String(minute % 60).padStart(2,'0')}`
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
function moveMinutes(a,b,request) {
  const km = distanceKm(a,b)
  const slow = /少|輕鬆|隨緣|長輩/.test(`${request.walkingPreference} ${request.specialRequirements}`)
  const walking = Math.round(km * 1.3 / (slow ? 3 : 4.5) * 60)
  return km > (slow ? .8 : 2) ? Math.min(75, Math.round(km * 6 + 12)) : Math.max(5, Math.min(55,walking))
}
export function buildDay(route, foodPois, request, dayIndex, scores, seed = 0) {
  let clock = startMinute(request)
  const mealMinute=clock>=13*60?18*60:12*60
  const mealTitle=mealMinute===18*60?'附近晚餐':'附近用餐'
  let last = null
  const spots = []
  let lunchAdded = false
  for (let index = 0; index < route.length; index++) {
    const poi = route[index]
    const travel = last ? moveMinutes(last,poi,request) : 0
    if (!lunchAdded && (clock + travel >= mealMinute || index === route.length - 1 && clock + travel + durationFor(poi,request) > mealMinute)) {
      const anchor = last || poi
      const options = nearbyFoodOptions(anchor,foodPois,request)
      spots.push({ id:`spot-${id()}`, type:'food', time:timeText(Math.max(clock,mealMinute)), title:mealTitle, detail:foodSuggestion(request), category:'餐飲', location:'附近・店家自行選擇', reason:foodSuggestion(request), estimatedDuration:/悠閒|輕鬆/.test(request.travelPace)?75:60, verificationStatus:null, source:null, latitude:anchor.latitude, longitude:anchor.longitude, foods:[], foodArea:null, restaurantOptions:options, favorite:false, requiredPlace:'', transportMode:'步行距離僅供估算', transportMinutes:null, transportDetail:'未解析道路與公車路線，請自行確認移動方式' })
      clock = Math.max(clock,mealMinute) + spots.at(-1).estimatedDuration
      lunchAdded = true
    }
    // The meal is anchored at the previous stop. Travel to the next POI follows
    // the meal, so the displayed arrival time includes both durations.
    clock += travel
    if (/夜市|Night Market/i.test(poi.name) && clock < 17*60+30) {
      if (clock < 16*60) spots.push({id:`spot-${id()}`,type:'break',time:timeText(clock),title:'自由探索與休息',detail:'保留彈性時間；晚間地點的實際營業資訊請自行確認。',category:'休息',location:request.destination,reason:'避免過早安排晚間地點',estimatedDuration:17*60+30-clock,verificationStatus:null,source:null,latitude:last?.latitude??poi.latitude,longitude:last?.longitude??poi.longitude,favorite:false,requiredPlace:'',transportMode:'移動方式待確認',transportMinutes:null,transportDetail:'請自行確認移動方式'})
      clock=17*60+30
    }
    const breakdown = scores.get(poi.id)
    const duration = durationFor(poi,request)
    spots.push({ id:`spot-${id()}`, poiId:poi.id, type:'poi', time:timeText(clock), title:poi.name, detail:reasonText(breakdown?.reasonCodes,seed+dayIndex+index), category:poi.category, location:poi.address || `${request.destination}・位置已查核`, reason:reasonText(breakdown?.reasonCodes,seed+dayIndex+index), reasonCodes:breakdown?.reasonCodes || [], estimatedDuration:duration, verificationStatus:'verified', source:poi.source, latitude:poi.latitude, longitude:poi.longitude, favorite:false, requiredPlace:poi.mustVisit ? (poi.mustVisitName || poi.name) : '', transportMode:last ? (travel <= 20 ? '步行估算' : '移動方式待確認') : '起點', transportMinutes:last ? travel : null, transportDetail:last ? `直線距離 ${distanceKm(last,poi).toFixed(1)} 公里；實際道路與交通時間請確認` : '今日第一站', openingHours:poi.openingHours || null })
    clock += duration
    last = poi
  }
  if (!lunchAdded && route.length) {
    const anchor = route[Math.max(0,Math.floor(route.length/2))]
    const options = nearbyFoodOptions(anchor,foodPois,request)
    const insertAt = Math.min(spots.length,Math.max(1,Math.floor(spots.length/2)))
    spots.splice(insertAt,0,{ id:`spot-${id()}`,type:'food',time:timeText(Math.max(mealMinute,clock)),title:mealTitle,detail:foodSuggestion(request),category:'餐飲',location:'附近・店家自行選擇',reason:foodSuggestion(request),estimatedDuration:60,verificationStatus:null,source:null,latitude:anchor.latitude,longitude:anchor.longitude,restaurantOptions:options,foods:[],foodArea:null,favorite:false,requiredPlace:'',transportMode:'移動方式待確認',transportMinutes:null,transportDetail:'請自行確認移動方式' })
    spots.sort((a,b)=>a.time.localeCompare(b.time))
  }
  const routeDistanceKm = route.slice(1).reduce((sum,poi,index)=>sum+distanceKm(route[index],poi),0)
  return { spots, routeDistanceKm:Number(routeDistanceKm.toFixed(2)), finishTime:timeText(clock) }
}
