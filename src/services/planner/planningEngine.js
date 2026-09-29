import { addDays } from '../tripDates.js'
import { travelStyle, answerText } from '../profile.js'
import { distanceKm, makeRandom, normalizedName } from './geo.js'
import { scorePOI } from './poiScoring.js'
import { clusterByDay, optimizeRoute } from './routeOptimizer.js'
import { buildDay, targetCount } from './scheduleBuilder.js'
import { validateSmartTrip } from './tripValidator.js'

const excluded = new Set(['restaurant','cafe'])
const tripId = () => `trip-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`
function maxDaySpread(request) {
  const walking=`${request.walkingPreference} ${request.specialRequirements}`
  return /少|輕鬆|隨緣|長輩/.test(walking) ? 1.5 : /耐走/.test(walking) ? 7 : 4
}
function rankedPick(options, request, context, random) {
  const ranked = options.map(poi => ({poi,breakdown:scorePOI(poi,request,context)})).sort((a,b)=>b.breakdown.totalScore-a.breakdown.totalScore)
  if (!ranked.length) return null
  const quality = ranked.filter(item => item.breakdown.totalScore >= ranked[0].breakdown.totalScore - 18).slice(0,7)
  const weights = quality.map(item => Math.exp((item.breakdown.totalScore - ranked[0].breakdown.totalScore)/8))
  let draw = random() * weights.reduce((a,b)=>a+b,0)
  for (let index=0;index<quality.length;index++) if ((draw -= weights[index]) <= 0) return quality[index]
  return quality.at(-1)
}

/** Pure planner: every selected landmark must be present in the supplied, source-backed POI set. */
export function buildSmartTrip({ request, form, profile, dataset, seed = Date.now(), debug = false, avoidIds = [], mustByDay = null, onPhase = (_phase) => {} }) {
  const begin = performance.now()
  const random = makeRandom(seed)
  const qualityEligible=poi=>{
    if(poi.mustVisit)return true
    const popularity=Number(poi.popularity)||0
    if(poi.category==='attraction')return popularity>=20
    if(dataset.radiusKm>8&&poi.category==='park'&&popularity<12&&!/庭園|植物園|Garden|自然公園|史跡|文化財/i.test(`${poi.name} ${poi.tags?.categories||''}`))return false
    return true
  }
  const allPois = dataset.pois.filter(poi => !excluded.has(poi.category) && qualityEligible(poi) && Number.isFinite(poi.latitude) && Number.isFinite(poi.longitude))
  const foodPois = dataset.pois.filter(poi => excluded.has(poi.category))
  const needed = Math.max(2, request.days * 2)
  if (allPois.length < needed) throw Object.assign(new Error('目前能取得的地點資料不足以安排完整行程。'),{code:'INSUFFICIENT_POIS'})
  const mustNames = request.mustVisitPlaces.map(normalizedName)
  const must = allPois.filter(poi => poi.mustVisit || mustNames.some(name => normalizedName(poi.name) === name))
  if (must.length < mustNames.length) throw Object.assign(new Error('部分指定地點無法查核，請確認名稱後重試。'),{code:'MUST_VISIT_UNRESOLVED'})
  const count = targetCount(request)
  if (must.length > request.days * Math.max(count,4)) throw Object.assign(new Error('部分指定地點無法在目前天數內合理安排。'),{code:'MUST_VISIT_OVERFLOW'})
  const avoid = new Set(avoidIds)
  const sourceIds = new Set(allPois.map(poi=>poi.id))
  onPhase('scoring')
  const globallyScored = allPois.map(poi => ({poi,score:scorePOI(poi,request,{center:dataset.center}).totalScore}))
    .sort((a,b)=>b.score-a.score)
  const pool = [...new Map([...must,...globallyScored.filter(item=>!avoid.has(item.poi.id)).slice(0,Math.max(90,request.days*35)).map(item=>item.poi)].map(poi=>[poi.id,poi])).values()]
  const globalScore=new Map(globallyScored.map(item=>[item.poi.id,item.score]))
  const spread=maxDaySpread(request)
  // A lone high-scoring place is a poor day anchor, especially for low-walking
  // profiles. Prefer strong neighbourhoods with another suitable POI nearby.
  const anchorUtility=new Map(pool.map(poi=>{
    const nearby=pool.filter(other=>other.id!==poi.id&&distanceKm(other,poi)<=spread).map(other=>globalScore.get(other.id)||0)
    return [poi.id,(globalScore.get(poi.id)||0)+(nearby.length ? 0.6*Math.max(...nearby) : -30)]
  }))
  pool.sort((a,b)=>anchorUtility.get(b.id)-anchorUtility.get(a.id))
  onPhase('clustering')
  const clusters = clusterByDay(pool,request.days,dataset.center)
  const used = new Set(avoid)
  const scores = new Map()
  const dayDebug = []
  onPhase('scheduling')
  const days = clusters.map((cluster,dayIndex) => {
    const clusterCenter = {latitude:cluster[0].latitude,longitude:cluster[0].longitude}
    const selected = cluster.filter(poi => poi.mustVisit || mustNames.some(name=>normalizedName(poi.name)===name) || mustByDay?.[dayIndex]?.includes(poi.id))
    selected.forEach(poi=>used.add(poi.id))
    const limit = Math.max(count,selected.length)
    while (selected.length < limit) {
      const inRange = poi => !selected.length || Math.min(...selected.map(other=>distanceKm(other,poi))) <= spread
      const options = (selected.length ? pool : cluster).filter(poi=>!used.has(poi.id)&&inRange(poi))
      const picked = rankedPick(options,request,{center:clusterCenter,anchor:selected.at(-1)||clusterCenter,previous:selected},random)
      if (!picked || picked.breakdown.totalScore < 5 && !picked.poi.mustVisit) break
      selected.push(picked.poi); used.add(picked.poi.id)
    }
    if (selected.length < 2) throw Object.assign(new Error('目前能取得的地點資料不足以安排完整行程。'),{code:'INSUFFICIENT_POIS'})
    const evening = selected.filter(poi=>/夜市|Night Market/i.test(poi.name))
    const daytime = selected.filter(poi=>!evening.includes(poi))
    const daytimeRoute = optimizeRoute(daytime,clusterCenter)
    const route = [...daytimeRoute,...optimizeRoute(evening,daytimeRoute.at(-1)||clusterCenter)]
    route.forEach((poi,index)=>scores.set(poi.id,scorePOI(poi,request,{center:clusterCenter,anchor:route[index-1]||clusterCenter,previous:route.slice(0,index)})))
    const schedule = buildDay(route,foodPois,request,dayIndex,scores,seed)
    dayDebug.push({ cluster:cluster.map(p=>p.id), selected:selected.map(p=>p.id), route:route.map(p=>p.id), routeDistanceKm:schedule.routeDistanceKm, schedule:schedule.spots.map(p=>({time:p.time,title:p.title,source:p.source||null})) })
    return {id:`day-${dayIndex+1}-${seed}`,label:`Day ${dayIndex+1}`,date:request.startDate?addDays(request.startDate,dayIndex):'',title:`${request.destination}・${/悠閒|輕鬆/.test(request.travelPace)?'慢慢探索':'順路探索'}`,spots:schedule.spots}
  })
  const trip = {id:tripId(),title:`${request.destination} ${request.days} 日行程`,destination:request.destination,startDate:request.startDate,endDate:request.endDate,dateUnknown:!request.startDate,profileId:profile.id,travelerCount:request.travelerCount,style:travelStyle(profile),budget:answerText(profile.answers.budget),isDemo:false,source:`TransitX Smart Planner / ${dataset.provider || 'OpenStreetMap / Overpass'}`,createdAt:new Date().toISOString(),request:{form,profile},planningSeed:seed,poiCache:dataset.cache,poiFetchedAt:dataset.fetchedAt,attribution:dataset.provider==='Wikipedia / GeoData'?'地點：Wikipedia / GeoData；地理定位：© OpenStreetMap contributors':'© OpenStreetMap contributors (ODbL)',intent:{planner:'TransitX Smart Planner',profile:request},days}
  onPhase('validation')
  validateSmartTrip(trip,request,sourceIds,dataset.center,dataset.radiusKm,dataset.region?.geojson)
  if (debug) trip.debug = {provider:`${dataset.provider || 'OpenStreetMap / Overpass'} + Nominatim`,candidateCount:dataset.pois.length,eligibleCount:allPois.length,foodCount:foodPois.length,cache:dataset.cache,scores:globallyScored.slice(0,100).map(({poi,score})=>({id:poi.id,name:poi.name,score,breakdown:scorePOI(poi,request,{center:dataset.center}),selected:used.has(poi.id),rejectedReason:used.has(poi.id)?null:avoid.has(poi.id)?'already-used':'lower-score-or-cluster-capacity'})),days:dayDebug,planningMs:Number((performance.now()-begin).toFixed(2))}
  return trip
}

export function pickReplacement(trip,dayIndex,spotId,dataset,request,seed=Date.now()) {
  const day = trip.days?.[dayIndex], replacing = day?.spots.find(spot=>spot.id===spotId)
  if (!replacing || replacing.type !== 'poi') throw Object.assign(new Error('只能替換已查核的景點。'),{code:'INVALID_REPLACEMENT'})
  if (replacing.requiredPlace) throw Object.assign(new Error('指定地點不可替換，請先修改指定地點。'),{code:'MUST_VISIT'})
  const used = new Set(trip.days.flatMap(item=>item.spots.map(spot=>spot.poiId).filter(Boolean)))
  const anchor = replacing
  const eligible = dataset.pois.filter(poi=>poi.category===replacing.category&&!used.has(poi.id)&&distanceKm(poi,anchor)<=3)
  const options = eligible.length ? eligible : dataset.pois.filter(poi=>poi.category!== 'restaurant'&&poi.category!=='cafe'&&!used.has(poi.id)&&distanceKm(poi,anchor)<=2)
  const picked = rankedPick(options,request,{center:dataset.center,anchor,previous:day.spots.filter(item=>item.type==='poi'&&item.id!==spotId)},makeRandom(seed))
  if (!picked) throw Object.assign(new Error('附近暫時找不到適合替換的真實景點。'),{code:'NO_REPLACEMENT'})
  const originals = day.spots.filter(item=>item.type==='poi'&&item.id!==spotId)
  const selected = [...originals.map(item=>dataset.pois.find(poi=>poi.id===item.poiId)).filter(Boolean),picked.poi]
  if (selected.length!==originals.length+1) throw Object.assign(new Error('原行程部分景點已不在資料來源中，無法自動重新排序。'),{code:'POI_STALE'})
  const route = optimizeRoute(selected,{latitude:anchor.latitude,longitude:anchor.longitude})
  const scores = new Map(route.map((poi,index)=>[poi.id,scorePOI(poi,request,{center:dataset.center,anchor:route[index-1]||dataset.center,previous:route.slice(0,index)})]))
  const schedule = buildDay(route,dataset.pois.filter(poi=>excluded.has(poi.category)),request,dayIndex,scores,seed)
  const previousById = new Map(day.spots.filter(item=>item.poiId).map(item=>[item.poiId,item]))
  const spots = schedule.spots.map(item=>{const before=previousById.get(item.poiId);return before?{...item,id:before.id,favorite:before.favorite,requiredPlace:before.requiredPlace}:item.poiId===picked.poi.id?{...item,id:replacing.id,favorite:replacing.favorite}:item})
  return {...day,spots}
}
