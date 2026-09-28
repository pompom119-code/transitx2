import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Cache, requestJson } from '../server/core.js'
import { createGeography } from '../server/ai/geography.js'
import { createTdx } from '../server/bus/tdx.js'
import { createBus } from '../server/bus/service.js'
import { createApi } from '../server/api.js'
import { etaText, rank } from '../src/services/bus/types.js'
import { currentLocation } from '../src/services/bus/busApi.js'
test('city geocoder refuses ambiguous destinations and caches identical queries',async()=>{
 let n=0
 const locate=createGeography(async()=>{n++;return Response.json({results:[{name:'東京',feature_code:'PPLC',country_code:'JP',latitude:35.68,longitude:139.69}]})})
 await locate('東京');await locate('東京');assert.equal(n,1)
 const ambiguous=createGeography(async()=>Response.json({results:[{name:'Paris',feature_code:'PPL'},{name:'Paris',feature_code:'PPL'}]}))
 await assert.rejects(ambiguous('Paris'),e=>e.code==='DESTINATION_AMBIGUOUS')
})
test('fetch adapter exposes 429/503/invalid JSON/network/timeout errors',async()=>{
 for(const [status,code]of [[429,'RATE_LIMIT'],[503,'UPSTREAM'],[401,'AUTH']])await assert.rejects(requestJson('https://example.test',{},async()=>new Response('',{status})),e=>e.code===code)
 await assert.rejects(requestJson('https://example.test',{},async()=>new Response('bad')),e=>e.code==='INVALID_JSON')
 await assert.rejects(requestJson('https://example.test',{},async()=>{throw new TypeError('offline')}),e=>e.code==='NETWORK')
 await assert.rejects(requestJson('https://example.test',{},async()=>{throw new DOMException('timeout','TimeoutError')}),e=>e.code==='TIMEOUT')
})
test('cache deduplicates and refresh bypasses stored value; errors are not cached',async()=>{
 const cache=new Cache();let calls=0
 const load=async()=>++calls
 assert.deepEqual(await Promise.all([cache.get('a',10000,load),cache.get('a',10000,load)]),[1,1])
 assert.equal(await cache.get('a',10000,load),1);assert.equal(await cache.get('a',10000,load,true),2)
 await assert.rejects(cache.get('b',10000,()=>{throw Error('offline')}))
 assert.equal(await cache.get('b',10000,load),3)
})
const tdxRoute=(name,uid='TPE'+name)=>({RouteUID:uid,RouteName:{Zh_tw:name},DepartureStopNameZh:'起點',DestinationStopNameZh:'終點',Operators:[],UpdateTime:new Date().toISOString()})
const tdxStop=(name,uid)=>({StopUID:uid,StopName:{Zh_tw:name},StopPosition:{PositionLat:25.05,PositionLon:121.52}})
test('bus search 307/666/795/Shiding/Taipei ranks exact results and reuses official catalogs',async()=>{
 for(const q of ['307','666','795','石碇高中','台北車站']){
  const bus=createBus({}, {query:async(path,params)=>{
   assert.equal(params.$top,'10000')
   return path.startsWith('Route')?[tdxRoute(q+'區'),tdxRoute(q)]:[tdxStop(q+'旁','s2'),tdxStop(q,'s1')]
  }})
  const result=await bus.search(q,'Taipei');assert.equal(result.routes[0].name,q);assert.equal(result.stops[0].name,q)
 }
 assert.equal(rank('臺北車站','台北車站'),0);assert.equal(rank('795','666'),99)
})
test('bus empty result and invalid city/id have no fixture fallback',async()=>{
 const bus=createBus({}, {query:async()=>[]})
 assert.deepEqual((await bus.search('不存在')).routes,[])
 await assert.rejects(bus.getRoute('Taipei~none'),e=>e.code==='NOT_FOUND')
 await assert.rejects(bus.search('307','not-city'),e=>e.code==='INPUT')
 await assert.rejects(bus.getStop('shiding-high'),e=>e.code==='LEGACY_ID')
})
test('bus route UID, direction, sorted stops, variants and ETA refresh preserve source semantics',async()=>{
 const calls=[]
 const bus=createBus({}, {query:async(path,params,ttl,force)=>{
  calls.push({path,params,ttl,force})
  if(path.startsWith('StopOfRoute'))return [
   {Direction:0,SubRouteUID:'a',SubRouteName:{Zh_tw:'主線'},Stops:[{...tdxStop('終點','s2'),StopSequence:2},{...tdxStop('起點','s1'),StopSequence:1}]},
   {Direction:1,SubRouteUID:'b',SubRouteName:{Zh_tw:'支線'},Stops:[{...tdxStop('支線起點','s3'),StopSequence:1}]},
  ]
  if(path.startsWith('Estimated'))return [{RouteUID:'TPE307',RouteName:{Zh_tw:'307'},StopUID:'s1',Direction:1,StopStatus:0,EstimateTime:180,UpdateTime:new Date().toISOString()}]
  return [tdxRoute('307')]
 }})
 assert.equal((await bus.getRoute('Taipei~TPE307')).name,'307')
 const outbound=await bus.getRouteStops('Taipei~TPE307',0);assert.equal(outbound.stops[0].name,'起點')
 const inbound=await bus.getRouteStops('Taipei~TPE307',1,'b');assert.equal(inbound.stops[0].name,'支線起點')
 assert.ok(calls.at(-1).params.$filter.includes('RouteUID eq'))
 const live=await bus.getStopArrivals('Taipei~s1',true)
 assert.equal(live.arrivals[0].seconds,180);assert.equal(live.arrivals[0].routeId,'Taipei~TPE307');assert.equal(calls.at(-1).force,true);assert.equal(calls.at(-1).ttl,15000)
})
test('TDX split 795 RouteUIDs select the real reverse line and its ETA identity',async()=>{
 const outbound={RouteUID:'NWT16757',RouteName:{Zh_tw:'795往十分寮'},SubRouteUID:'NWT-out',SubRouteName:{Zh_tw:'795往十分寮'},Direction:0,Stops:[{...tdxStop('捷運動物園站','a'),StopSequence:1},{...tdxStop('十分遊客中心','b'),StopSequence:2}]}
 const reverse={RouteUID:'NWT16719',RouteName:{Zh_tw:'795往木柵'},SubRouteUID:'NWT-back',SubRouteName:{Zh_tw:'795往木柵'},Direction:0,Stops:[{...tdxStop('十分遊客中心','b'),StopSequence:1},{...tdxStop('捷運動物園站','a'),StopSequence:2}]}
 const unrelated={RouteUID:'NWT16758',RouteName:{Zh_tw:'795往平溪'},SubRouteUID:'NWT-other',SubRouteName:{Zh_tw:'795往平溪'},Direction:0,Stops:[{...tdxStop('捷運動物園站','a'),StopSequence:1},{...tdxStop('平溪','c'),StopSequence:2}]}
 const bus=createBus({}, {query:async(path)=>path==='Route/City/NewTaipei'?[tdxRoute('795往十分寮','NWT16757')]:path.endsWith('/795')?[outbound,reverse,unrelated]:[outbound]})
 const result=await bus.getRouteStops('NewTaipei~NWT16757',1)
 assert.equal(result.selectedRouteId,'NewTaipei~NWT16719')
 assert.equal(result.selectedDirection,0)
 assert.equal(result.selectedRouteName,'795往木柵')
 assert.deepEqual(result.stops.map(s=>s.name),['十分遊客中心','捷運動物園站'])
 assert.equal(result.variants.length,1)
})
test('ETA status handles arriving/not departed/last bus/stale/missing without invented values',()=>{
 assert.equal(etaText({status:0,seconds:180}),'3 分');assert.equal(etaText({status:0,seconds:20}),'即將進站')
 assert.equal(etaText({status:1,seconds:null}),'尚未發車');assert.equal(etaText({status:3,seconds:null}),'末班已過')
 assert.equal(etaText({status:0,seconds:null}),'暫無預估');assert.equal(etaText({status:0,seconds:1,updatedAt:'2020-01-01'}),'資料已過期')
})
test('TDX requires credentials/free plan and caches bearer token server-side',async()=>{
 await assert.rejects(createTdx({})('Route/City/Taipei'),e=>e.code==='TDX_NOT_CONFIGURED')
 const calls=[]
 const tdx=createTdx({TDX_CLIENT_ID:'test-only',TDX_CLIENT_SECRET:'test-only',TDX_FREE_PLAN_CONFIRMED:'true'},async(url,options)=>{
  calls.push({url,options})
  return url.includes('/token')?Response.json({access_token:'test-token',expires_in:3600}):Response.json([])
 })
 await tdx('Route/City/Taipei');await tdx('Route/City/Taipei')
 assert.equal(calls.length,2);assert.equal(calls[1].options.headers.Authorization,'Bearer test-token')
})
test('location denied remains an actionable search-safe error, no fake coordinates',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator')
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition:(_yes,no)=>no({code:1})}}})
 try{await assert.rejects(currentLocation(),/未允許定位.*搜尋/)}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator}
})
test('HTTP same-origin proxy streams real progress and does not expose environment secrets',async()=>{
 const env={GEMINI_API_KEY:'test-only-secret'}
 const api=createApi(env,{planner:async(_body,progress)=>{progress(0);progress(2);return {id:'contract-test-trip'}},bus:createBus({})})
 const server=createServer((req,res)=>api(req,res,()=>{res.writeHead(404);res.end()}))
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const base='http://127.0.0.1:'+server.address().port
 try{
  const status=await(await fetch(base+'/api/status')).text();assert.ok(!status.includes('test-only-secret'))
  const denied=await fetch(base+'/api/ai/plan',{method:'POST',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403)
  const stream=await(await fetch(base+'/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).text()
  const events=stream.trim().split('\n').map(line=>JSON.parse(line));assert.deepEqual(events.map(x=>x.type),['progress','progress','result'])
  const unavailable=await fetch(base+'/api/bus/search?q=307');assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).code,'TDX_NOT_CONFIGURED')
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
