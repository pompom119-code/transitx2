import { createWikimediaPoiProvider } from '../server/planner/wikimediaPoiProvider.js'
import { buildSmartTrip, pickReplacement } from '../src/services/planner/planningEngine.js'
import { normalizeRequest } from '../src/services/ai/contracts.js'
import { addDays } from '../src/services/tripDates.js'
import { createSmartPlannerService } from '../server/planner/service.js'

const provider=createWikimediaPoiProvider()
const variants={
  A:{id:'A',answers:{companions:'朋友',interests:['美食','拍照'],exploration:'探索派',transport:['公車','步行'],walking:'適中走',budget:'標準享受',pace:'悠閒放鬆',notes:''}},
  B:{id:'B',answers:{companions:'自己',interests:['文化','拍照'],exploration:'經典派',transport:['步行'],walking:'耐走派',budget:'標準享受',pace:'彈性隨性',notes:''}},
  C:{id:'C',answers:{companions:'家人',interests:['自然','放鬆'],exploration:'在地派',transport:['公車'],walking:'輕鬆走',budget:'標準享受',pace:'悠閒放鬆',notes:'帶長輩，不要太早'}},
  D:{id:'D',answers:{companions:'朋友',interests:['美食','文化'],exploration:'探索派',transport:['步行'],walking:'耐走派',budget:'小資輕鬆',pace:'充實探索',notes:''}},
}
const cases=[['淡水',1],['淡水',2],['淡水',4],['台北',2],['台中',2],['台南',2],['高雄',2],['東京',2],['大阪',2]]
const outputs=[]
const summaryOnly=process.argv.includes('--summary')
for(const [destination,days] of cases){
  const started=performance.now()
  try{
    const dataset=await provider.searchPOIs(destination,[],AbortSignal.timeout(120000),{forceRefresh:destination==='淡水'&&days===1})
    if(destination==='淡水'&&days===1&&dataset.cache!=='network')throw Object.assign(new Error('Live POI request did not reach Wikipedia; cached data cannot pass this check.'),{code:'LIVE_POI_PROVIDER_NOT_REACHED'})
    const fetchMs=Math.round(performance.now()-started)
    const profiles=destination==='淡水'&&days===4?Object.entries(variants):[['A',variants.A]]
    const results=[]
    for(const [name,profile] of profiles){
      const form={destination,startDate:'2026-10-10',endDate:addDays('2026-10-10',days-1),days,dateUnknown:false,travelerCount:name==='B'?1:name==='C'?4:3,places:[],optionalNotes:''}
      const request=normalizeRequest(form,profile)
      const planningStarted=performance.now()
      const diagnostics=[]
      const trip=buildSmartTrip({request,form,profile,dataset,seed:12345,debug:true,onDiagnostic:event=>diagnostics.push(event)})
      results.push({profile:name,plannerMs:Number((performance.now()-planningStarted).toFixed(2)),poiCount:trip.days.reduce((n,day)=>n+day.spots.filter(spot=>spot.type==='poi').length,0),routeKm:trip.debug.days.map(day=>day.routeDistanceKm),selected:trip.days.map(day=>day.spots.filter(spot=>spot.type==='poi').map(spot=>spot.title)),schedule:trip.days.map(day=>day.spots.map(spot=>`${spot.time} ${spot.title}`)),scores:trip.debug.scores.filter(item=>item.selected).slice(0,6).map(item=>({name:item.name,score:Number(item.score.toFixed(1)),reason:item.breakdown.reasonCodes})),diagnostics})
      if(destination==='淡水'&&name==='A'){
        const first=trip.days[0].spots.find(spot=>spot.type==='poi'&&!spot.requiredPlace)
        try{const replacement=pickReplacement(trip,0,first.id,dataset,request,333);results.at(-1).replacement=replacement.spots.filter(spot=>spot.type==='poi').map(spot=>spot.title)}catch(error){results.at(-1).replacementError=error.message}
      }
    }
    outputs.push({destination,days,status:'PASS',provider:dataset.provider,region:dataset.region.display_name,center:dataset.center,boundingBox:dataset.region.boundingbox,candidates:dataset.pois.length,providerDiagnostics:dataset.diagnostics,cache:dataset.cache,fetchMs,profiles:results})
  }catch(error){outputs.push({destination,days,status:'FAIL',code:error.code||error.name,message:error.message,elapsedMs:Math.round(performance.now()-started)})}
  const item=outputs.at(-1)
  console.log(JSON.stringify(summaryOnly?{destination:item.destination,days:item.days,status:item.status,code:item.code||null,raw:item.providerDiagnostics?.rawCount??null,normalized:item.providerDiagnostics?.normalizedCount??null,geographic:item.providerDiagnostics?.geographicCount??null,usable:item.candidates??null,httpStatuses:[...new Set(item.providerDiagnostics?.http?.map(request=>request.status)||[])],fetchMs:item.fetchMs,profiles:item.profiles?.map(profile=>({profile:profile.profile,plannerMs:profile.plannerMs,poiCount:profile.poiCount,perDay:profile.selected,routeKm:profile.routeKm}))}:item))
}
try{
  const service=createSmartPlannerService(provider,{debug:true})
  let trip
  for(const days of [1,2,4]){
    const form={destination:'淡水',startDate:'2026-10-10',endDate:addDays('2026-10-10',days-1),days,dateUnknown:false,travelerCount:3,places:['紅毛城'],optionalNotes:''}
    trip=await service({operation:'generate',form,profile:variants.A})
    console.log(JSON.stringify({mustVisit:'紅毛城',days,status:trip.days.some(day=>day.spots.some(spot=>spot.requiredPlace==='紅毛城'))?'PASS':'FAIL',selected:trip.days.map(day=>day.spots.filter(spot=>spot.type==='poi').map(spot=>spot.title))}))
  }
  const replanned=await service({operation:'replan',trip,dayIndex:0})
  console.log(JSON.stringify({replan:'PASS',original:trip.days[0].spots.filter(spot=>spot.type==='poi').map(spot=>spot.title),alternative:replanned.spots.filter(spot=>spot.type==='poi').map(spot=>spot.title)}))
}catch(error){console.log(JSON.stringify({mustVisit:'紅毛城',status:'FAIL',code:error.code||error.name,message:error.message}));process.exitCode=1}
if(outputs.some(item=>item.status==='FAIL'))process.exitCode=1
