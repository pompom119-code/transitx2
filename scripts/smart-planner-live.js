import { createWikimediaPoiProvider } from '../server/planner/wikimediaPoiProvider.js'
import { buildSmartTrip, pickReplacement } from '../src/services/planner/planningEngine.js'
import { normalizeRequest } from '../src/services/ai/contracts.js'

const destination = process.argv[2] || '淡水'
const profile = { id:'test-friends',answers:{companions:'朋友',interests:['美食','拍照'],exploration:'探索派',transport:['公車','步行'],walking:'適中走',budget:'標準享受',pace:'悠閒放鬆',notes:''} }
const form = {destination,startDate:'2026-10-10',endDate:'2026-10-10',days:1,dateUnknown:false,travelerCount:3,places:[],optionalNotes:''}
const started=performance.now()
const provider=createWikimediaPoiProvider()
const dataset=await provider.searchPOIs(destination,[],AbortSignal.timeout(85000))
console.log(JSON.stringify({destination,region:dataset.region.display_name,center:dataset.center,bbox:dataset.region.boundingbox,english:dataset.region.namedetails?.['name:en'],provider:'Wikipedia / GeoData',cache:dataset.cache,candidates:dataset.pois.length,attractions:dataset.pois.filter(p=>!['restaurant','cafe'].includes(p.category)).length,food:dataset.pois.filter(p=>['restaurant','cafe'].includes(p.category)).length,fetchMs:Math.round(performance.now()-started)}))
if(process.argv.includes('--list'))console.log(dataset.pois.map(p=>`${p.category}:${p.name}`).join('\n'))
const planningStart=performance.now()
const trip=buildSmartTrip({request:normalizeRequest(form,profile),form,profile,dataset,seed:12345,debug:true})
console.log(JSON.stringify({destination,plannerMs:Number((performance.now()-planningStart).toFixed(2)),days:trip.days.map(day=>({date:day.date,spots:day.spots.map(spot=>({time:spot.time,title:spot.title,poiId:spot.poiId||null,source:spot.source||null,reasonCodes:spot.reasonCodes||[],latitude:spot.latitude,longitude:spot.longitude}))})),routeKm:trip.debug.days[0].routeDistanceKm,scores:trip.debug.scores.slice(0,8)}))
const first=trip.days[0].spots.find(spot=>spot.type==='poi'&&!spot.requiredPlace)
if(first){try{const replaced=pickReplacement(trip,0,first.id,dataset,normalizeRequest(form,profile),56789);console.log(JSON.stringify({replacement:replaced.spots.filter(s=>s.type==='poi').map(s=>s.title)}))}catch(error){console.log(JSON.stringify({replacementError:error.message}))}}
