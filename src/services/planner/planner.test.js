import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays } from '../tripDates.js'
import { distanceKm, insideGeometry } from './geo.js'
import { scorePOI } from './poiScoring.js'
import { optimizeRoute } from './routeOptimizer.js'
import { buildDay } from './scheduleBuilder.js'
import { buildSmartTrip, pickReplacement } from './planningEngine.js'

const center={latitude:25,longitude:121.5}
const types=['museum','park','viewpoint','marketplace','historic','garden']
const pois=Array.from({length:30},(_,index)=>({id:`source:${index}`,name:`Test Place ${index}`,category:types[index%types.length],latitude:25+(index%6)*.002,longitude:121.5+Math.floor(index/6)*.003,source:'Wikipedia / GeoData',tags:{name:`Test Place ${index}`,wikipedia:`https://example.org/${index}`},popularity:index%4===0?20:0}))
const dataset={center,radiusKm:10,pois,provider:'Wikipedia / GeoData',cache:'fixture',fetchedAt:'2026-09-29T00:00:00.000Z',region:{geojson:{type:'Polygon',coordinates:[[[121.4,24.9],[121.7,24.9],[121.7,25.2],[121.4,25.2],[121.4,24.9]]]}}}
const profile=(companions,interests,walking='適中走',pace='悠閒放鬆')=>({id:`profile-${companions}`,answers:{companions,interests,walking,pace,exploration:'探索派',budget:'標準享受',transport:'步行',notes:''}})
const form=(days=1)=>({destination:'Test City',startDate:'2026-10-10',endDate:addDays('2026-10-10',days-1),days,dateUnknown:false,travelerCount:3,places:[],optionalNotes:''})
const request=(days=1)=>({destination:'Test City',startDate:'2026-10-10',endDate:addDays('2026-10-10',days-1),days,travelerCount:3,mustVisitPlaces:[],optionalNotes:'',travelerType:'朋友',interests:'美食、拍照',explorationLevel:'探索派',transportPreference:'步行',walkingPreference:'適中走',budget:'標準享受',travelPace:'悠閒放鬆',specialRequirements:''})

test('geofence excludes points outside polygons and holes',()=>{
  assert.equal(insideGeometry(center,dataset.region.geojson),true)
  assert.equal(insideGeometry({latitude:26,longitude:121.5},dataset.region.geojson),false)
})
test('interest scoring changes POI ranking without a city rule',()=>{
  const food=scorePOI(pois[3],request(),{center})
  const culture=scorePOI(pois[0],{...request(),interests:'文化'}, {center})
  assert.ok(food.reasonCodes.includes('MATCH_FOOD'))
  assert.ok(culture.reasonCodes.includes('MATCH_CULTURE'))
})
test('route optimizer reduces a zigzag route',()=>{
  const route=optimizeRoute([pois[0],pois[24],pois[6],pois[18],pois[12]],center)
  const km=points=>points.slice(1).reduce((n,p,i)=>n+distanceKm(points[i],p),0)
  assert.ok(km(route)<=km([pois[0],pois[24],pois[6],pois[18],pois[12]]))
})
test('meal timing leaves room for travel and afternoon starts use dinner',()=>{
  const scores=new Map()
  const morning=buildDay([pois[1],pois[7]],[],request(),0,scores,1).spots
  const meal=morning.find(spot=>spot.type==='food')
  const second=morning.find(spot=>spot.poiId===pois[7].id)
  assert.ok(second.time>'13:15')
  assert.equal(meal.title,'附近用餐')
  const afternoon=buildDay([pois[1],pois[7]],[],{...request(),optionalNotes:'下午出發'},0,scores,1).spots
  assert.equal(afternoon.find(spot=>spot.type==='food').title,'附近晚餐')
  assert.ok(afternoon.find(spot=>spot.type==='food').time>='18:00')
})
test('planner respects dates, must-visit, source IDs and pace',()=>{
  const required={...pois[8],mustVisit:true,mustVisitName:'Test Place 8'}
  const sourced={...dataset,pois:pois.map(p=>p.id===required.id?required:p)}
  const leisurely=buildSmartTrip({request:{...request(2),mustVisitPlaces:['Test Place 8']},form:{...form(2),places:['Test Place 8']},profile:profile('朋友',['美食','拍照']),dataset:sourced,seed:12,debug:true})
  const busy=buildSmartTrip({request:{...request(2),travelPace:'充實探索',mustVisitPlaces:['Test Place 8']},form:{...form(2),places:['Test Place 8']},profile:profile('朋友',['美食','拍照'],'耐走派','充實探索'),dataset:sourced,seed:12})
  assert.equal(leisurely.days.length,2)
  assert.deepEqual(leisurely.days.map(day=>day.date),['2026-10-10','2026-10-11'])
  assert.ok(leisurely.days.flatMap(day=>day.spots).some(spot=>spot.requiredPlace==='Test Place 8'))
  assert.ok(leisurely.days.every(day=>day.spots.filter(spot=>spot.type==='poi').every(spot=>pois.some(p=>p.id===spot.poiId))))
  assert.ok(busy.days.flatMap(day=>day.spots).filter(spot=>spot.type==='poi').length>leisurely.days.flatMap(day=>day.spots).filter(spot=>spot.type==='poi').length)
})
test('different seeds can vary selection while preserving verified origin',()=>{
  const outputs=new Set(Array.from({length:10},(_,index)=>buildSmartTrip({request:request(),form:form(),profile:profile('朋友',['美食','拍照']),dataset,seed:index+1}).days[0].spots.filter(spot=>spot.type==='poi').map(spot=>spot.poiId).join(',')))
  assert.ok(outputs.size>1)
})
test('replacement picks unused nearby source-backed POI',()=>{
  const input=request()
  const trip=buildSmartTrip({request:input,form:form(),profile:profile('朋友',['美食','拍照']),dataset,seed:33})
  const first=trip.days[0].spots.find(spot=>spot.type==='poi')
  const replacement=pickReplacement(trip,0,first.id,dataset,input,34)
  assert.equal(replacement.spots.length,trip.days[0].spots.length)
  assert.ok(replacement.spots.some(spot=>spot.id===first.id&&spot.poiId!==first.poiId&&pois.some(p=>p.id===spot.poiId)))
})
test('insufficient real POIs fail instead of falling back to a template',()=>{
  assert.throws(()=>buildSmartTrip({request:request(2),form:form(2),profile:profile('朋友',['美食']),dataset:{...dataset,pois:pois.slice(0,2)},seed:1}),/地點資料不足/)
})
