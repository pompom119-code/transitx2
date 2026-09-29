import { ApiError } from '../core.js'
import { createOverpassPoiProvider } from './poiProvider.js'
import { createWikimediaPoiProvider } from './wikimediaPoiProvider.js'
import { normalizeRequest } from '../../src/services/ai/contracts.js'
import { distanceKm, normalizedName, insideGeometry } from '../../src/services/planner/geo.js'
import { buildSmartTrip, pickReplacement } from '../../src/services/planner/planningEngine.js'
import { targetCount } from '../../src/services/planner/scheduleBuilder.js'

function translateError(error) {
  if (error instanceof ApiError || error?.code) return error
  return new ApiError('PLANNER_VALIDATION', error?.message || '行程資料未通過檢查，請重試。', 422)
}
async function addMustVisits(dataset, request, provider, signal) {
  const pois = [...dataset.pois]
  for (const name of request.mustVisitPlaces) {
    const key = normalizedName(name)
    let poi = pois.find(item => normalizedName(item.name) === key)
    if (!poi) poi = pois.find(item => normalizedName(item.name).includes(key) && key.length >= 3)
    if (!poi) poi = await provider.resolvePlace(name,request.destination,dataset.region,signal)
    if (!poi || distanceKm(poi,dataset.center) > dataset.radiusKm + 1 || insideGeometry(poi,dataset.region.geojson) === false) throw new ApiError('MUST_VISIT_UNRESOLVED',`「${name}」不在目的地附近，或無法查核其位置。`,422)
    const marked = {...poi,mustVisit:true,mustVisitName:name}
    const index = pois.findIndex(item=>item.id===poi.id)
    if (index>=0) pois[index]=marked
    else pois.push(marked)
  }
  return {...dataset,pois}
}
export function createSmartPlannerService(provider = process.env.PLANNER_POI_PROVIDER === 'overpass' ? createOverpassPoiProvider() : createWikimediaPoiProvider(), { debug = false } = {}) {
  return async (body, onProgress = (_event) => {}, signal) => {
    const started=performance.now(), diagnostics=[]
    let lastRecord=started
    const record=(stage,details={})=>{const now=performance.now();if(debug)diagnostics.push({stage,durationMs:Math.round(now-lastRecord),elapsedMs:Math.round(now-started),rejected:0,reasons:[],...details});lastRecord=now}
    try {
      const operation = body?.operation || 'generate'
      const trip = body?.trip
      const form = operation === 'generate' ? body.form : trip?.request?.form
      const profile = operation === 'generate' ? body.profile : trip?.request?.profile
      if (!form || !profile) throw new ApiError('PLANNER_INPUT','請先設定目的地與旅行偏好。',422)
      const original = normalizeRequest(form,profile)
      record('input',{destination:original.destination,days:original.days,profileId:profile.id,travelerType:original.travelerType,interests:original.interests})
      if (original.mustVisitPlaces.length > original.days * Math.max(4,targetCount(original))) throw new ApiError('MUST_VISIT_OVERFLOW','部分指定地點無法在目前天數內合理安排。',422)
      onProgress({step:0,label:'正在取得真實地點資料'})
      const dataset = await provider.searchPOIs(original.destination,[],signal)
      const source=dataset.diagnostics||{}
      record('destination-resolution',{input:original.destination,output:dataset.region?1:0,durationMs:source.resolutionMs??null,region:dataset.region?.display_name,center:dataset.center,boundingBox:dataset.region?.boundingbox,radiusKm:dataset.radiusKm})
      record('poi-provider-request',{input:dataset.region?.display_name,output:source.rawCount??dataset.pois.length,provider:dataset.provider,cache:dataset.cache,httpStatuses:source.http?.map(item=>item.status)||[],httpResponseMs:source.http?.map(item=>item.durationMs)||[],countFromCache:source.rawCount==null})
      if(source.rawCount!=null){
        record('poi-normalization',{input:source.rawCount,output:source.normalizedCount,rejected:source.rejected.duplicate,reasons:['duplicate-geosearch-results'],durationMs:source.durationsMs.normalization})
        record('geographic-filter',{input:source.normalizedCount,output:source.geographicCount,rejected:source.rejected.outsideRegion,reasons:['outside-region-or-bounding-box'],durationMs:source.durationsMs.geography})
        record('provider-category-filter',{input:source.geographicCount,output:source.categoryCount,rejected:source.rejected.category,reasons:['non-visit-place-or-excluded-category'],durationMs:source.durationsMs.category})
      }
      record('candidate-count',{input:source.providerCount??dataset.pois.length,output:dataset.pois.length,rejected:source.rejected?.finalSuitability??0,reasons:['non-visit-place-or-excluded-category'],durationMs:source.durationsMs?.finalSuitability??null})
      if (!dataset.pois.length) throw new ApiError('INSUFFICIENT_POIS','目前能取得的地點資料不足以安排完整行程。',422)
      if (operation === 'replace') {
        const dayIndex = Number(body.dayIndex)
        if (!Number.isInteger(dayIndex) || !trip.days?.[dayIndex]) throw new ApiError('PLANNER_INPUT','找不到要編輯的日期。',422)
        onProgress({step:1,label:'正在尋找相近的可替換景點'})
        return pickReplacement(trip,dayIndex,body.spotId,dataset,original,Date.now())
      }
      if (operation === 'replan') {
        const dayIndex = Number(body.dayIndex)
        if (!Number.isInteger(dayIndex) || !trip.days?.[dayIndex]) throw new ApiError('PLANNER_INPUT','找不到要重排的日期。',422)
        const originalDay = trip.days[dayIndex]
        const keep = originalDay.spots.filter(spot=>spot.requiredPlace).map(spot=>spot.requiredPlace)
        const daily = {...original,days:1,startDate:originalDay.date||'',endDate:originalDay.date||'',mustVisitPlaces:keep}
        const dailyForm = {...form,days:1,startDate:daily.startDate,endDate:daily.endDate,dateUnknown:!daily.startDate,places:keep}
        const sourced = await addMustVisits(dataset,daily,provider,signal)
        onProgress({step:1,label:'正在重新選點與安排路線'})
        const usedElsewhere = trip.days.filter((_,index)=>index!==dayIndex).flatMap(day=>day.spots.map(spot=>spot.poiId).filter(Boolean))
        let result
        try { result = buildSmartTrip({request:daily,form:dailyForm,profile,dataset:sourced,seed:Date.now(),debug,avoidIds:[...usedElsewhere,...originalDay.spots.filter(spot=>!spot.requiredPlace).map(spot=>spot.poiId).filter(Boolean)]}) }
        catch (error) { if (error.code !== 'INSUFFICIENT_POIS') throw error; result = buildSmartTrip({request:daily,form:dailyForm,profile,dataset:sourced,seed:Date.now()+1,debug,avoidIds:usedElsewhere}) }
        const next = result.days[0]
        const originals = new Map(originalDay.spots.filter(spot=>spot.poiId).map(spot=>[spot.poiId,spot]))
        return {...next,id:originalDay.id,label:originalDay.label,date:originalDay.date,spots:next.spots.map(spot=>{const before=originals.get(spot.poiId);return before?{...spot,id:before.id,favorite:before.favorite}:spot})}
      }
      if (operation !== 'generate') throw new ApiError('PLANNER_INPUT','未知的規劃操作。',400)
      const sourced = await addMustVisits(dataset,original,provider,signal)
      record('must-visit-resolution',{input:original.mustVisitPlaces.length,output:sourced.pois.filter(poi=>poi.mustVisit).length,rejected:Math.max(0,original.mustVisitPlaces.length-sourced.pois.filter(poi=>poi.mustVisit).length)})
      const labels={scoring:{step:1,label:'正在依旅行偏好評分'},clustering:{step:2,label:'正在分群並安排路線'},scheduling:{step:3,label:'正在安排停留與用餐時間'},validation:{step:4,label:'正在檢查每個景點來源'}}
      const result = buildSmartTrip({request:original,form,profile,dataset:sourced,seed:Number(body.seed)||Date.now(),debug,onPhase:phase=>onProgress(labels[phase]),onDiagnostic:event=>record(event.stage,event)})
      record('result',{dayCount:result.days.length,selectedPoiCount:result.days.reduce((sum,day)=>sum+day.spots.filter(spot=>spot.type==='poi').length,0)})
      if(debug)console.info('[smart-planner]',JSON.stringify({status:'PASS',diagnostics}))
      return result
    } catch(error) {
      if(debug)console.error('[smart-planner]',JSON.stringify({status:'FAIL',code:error.code||'PLANNER_VALIDATION',message:error.message,stack:error.stack,diagnostics}))
      throw translateError(error)
    }
  }
}
