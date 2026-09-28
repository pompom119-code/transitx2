import { ApiError, Cache } from '../core.js'
import { createTdx } from './tdx.js'
import { cities, normalizeQuery, rank } from '../../src/services/bus/types.js'
import { distanceKm } from '../ai/geography.js'
const quote = text => "'" + text.replace(/'/g,"''") + "'"
const id = (city,uid) => city+'~'+uid
const route = (item,city) => ({id:id(city,item.RouteUID),uid:item.RouteUID,city,name:item.RouteName.Zh_tw,from:item.DepartureStopNameZh||'',to:item.DestinationStopNameZh||'',operator:(item.Operators||[]).map(x=>x.OperatorName.Zh_tw).join('、'),fare:item.TicketPriceDescriptionZh||'依營運業者公告',updatedAt:item.UpdateTime})
const stop = (item,city) => ({id:id(city,item.StopUID),uid:item.StopUID,city,name:item.StopName.Zh_tw,area:item.StopAddress||cities[city],latitude:item.StopPosition?.PositionLat,longitude:item.StopPosition?.PositionLon})
const scope = city => {
 if (city==='TaipeiMetro' || !city) return ['Taipei','NewTaipei']
 if (!cities[city]) throw new ApiError('INPUT','縣市不支援。',400)
 return [city]
}
const split = value => {
 const [city,uid,...rest]=String(value).split('~')
 if (!cities[city] || !uid || rest.length || !/^[a-zA-Z0-9_-]+$/.test(uid)) throw new ApiError('LEGACY_ID','這是舊示範收藏，請重新搜尋並收藏真實路線／站牌。',400)
 return [city,uid]
}
const stamp = items => items.map(x=>x.UpdateTime).filter(x=>Number.isFinite(Date.parse(x))).sort()[0] || null
const arrival = (item,city) => ({
 id:[item.RouteUID,item.SubRouteUID,item.Direction,item.StopUID].join('-'),routeId:id(city,item.RouteUID),route:item.RouteName.Zh_tw,
 stopId:id(city,item.StopUID),direction:item.Direction,subRouteUid:item.SubRouteUID,
 seconds:typeof item.EstimateTime==='number'?item.EstimateTime:null,status:item.StopStatus,
 plate:item.PlateNumb && item.PlateNumb!=='-1'?item.PlateNumb:null,updatedAt:item.UpdateTime||item.SrcUpdateTime||null,
})
export function createBus(env, dependencies = {}) {
 const query=dependencies.query||createTdx(env,dependencies.fetcher)
 const catalogs=new Cache()
 async function catalog(kind,city) {
  return catalogs.get(kind+city,86400000,async()=>{
   const rows=[]
   for(let skip=0;skip<100000;skip+=10000){
    const page=await query(kind+'/City/'+city,{'$top':'10000','$skip':String(skip)})
    rows.push(...page)
    if(page.length<10000)return rows
   }
   throw new ApiError('CATALOG_TOO_LARGE','此縣市站牌資料過多，請稍後重試。')
  })
 }
 async function search(text,city='TaipeiMetro') {
  const q=normalizeQuery(text)
  if(!q)return {routes:[],stops:[],source:'TDX',truncated:false}
  if(q.length>80)throw new ApiError('INPUT','搜尋字數過長。',400)
  const results=await Promise.all(scope(city).map(async city=>{
   const [allRoutes,allStops]=await Promise.all([catalog('Route',city),catalog('Stop',city)])
   const rs=allRoutes.filter(x=>rank(x.RouteName.Zh_tw,q)<99),ss=allStops.filter(x=>rank(x.StopName.Zh_tw,q)<99)
   return {routes:rs.map(x=>route(x,city)),stops:ss.map(x=>stop(x,city)),truncated:false}
  }))
  const sorted=kind=>results.flatMap(x=>x[kind]).sort((a,b)=>rank(a.name,q)-rank(b.name,q)||a.name.localeCompare(b.name,'zh-TW'))
  const routes=sorted('routes'),stops=sorted('stops')
  return {routes:routes.slice(0,200),stops:stops.slice(0,200),truncated:routes.length>200||stops.length>200,source:'TDX'}
 }
 async function getRoute(routeId) {
  if (/^\d+$/.test(routeId)) {
   const result=await search(routeId)
   const exact=result.routes.filter(x=>x.name===routeId)
   if(exact.length===1)return getRoute(exact[0].id)
   throw new ApiError('AMBIGUOUS_ROUTE','同號路線可能由不同縣市提供，請由搜尋結果選擇。',409)
  }
  const [city,uid]=split(routeId)
  const rs=(await catalog('Route',city)).filter(x=>x.RouteUID===uid)
  if(!rs.length)throw new ApiError('NOT_FOUND','找不到路線。',404)
  return route(rs[0],city)
 }
 async function getRouteStops(routeId,direction=0,subRouteUid='') {
  const [city,uid]=split(routeId)
  if(![0,1].includes(Number(direction)))throw new ApiError('INPUT','方向錯誤。',400)
  const data=await query('StopOfRoute/City/'+city,{'$filter':'RouteUID eq '+quote(uid)})
  const toVariant=x=>({id:x.SubRouteUID,name:x.SubRouteName?.Zh_tw||'',routeName:x.RouteName?.Zh_tw||'',routeId:id(city,x.RouteUID),direction:x.Direction,stops:(x.Stops||[]).slice().sort((a,b)=>a.StopSequence-b.StopSequence).map(s=>({...stop(s,city),sequence:s.StopSequence}))})
  let variants=data.filter(x=>x.Direction===Number(direction)&&!x.SubRouteName?.Zh_tw?.includes('停駛')).map(toVariant)
  if(Number(direction)===1&&!variants.length){
   const current=data.filter(x=>x.Direction===0&&x.Stops?.length).map(toVariant)
   const routeName=(await getRoute(routeId)).name
   const number=routeName.match(/^\d{1,4}/)?.[0]
   if(current.length&&number){
    const family=await query('StopOfRoute/City/'+city+'/'+number,{'$top':'200'})
    const ends=new Set(current.map(x=>normalizeQuery(x.stops.at(-1).name)+'|'+normalizeQuery(x.stops[0].name)))
    variants=family.filter(x=>x.RouteUID!==uid&&x.Direction===0&&x.Stops?.length&&!x.SubRouteName?.Zh_tw?.includes('停駛')).map(toVariant).filter(x=>ends.has(normalizeQuery(x.stops[0].name)+'|'+normalizeQuery(x.stops.at(-1).name)))
   }
  }
  const selected=variants.find(x=>x.id===subRouteUid)||variants[0]
  return {variants,selectedId:selected?.id||'',selectedRouteId:selected?.routeId||routeId,selectedDirection:selected?.direction??Number(direction),selectedRouteName:selected?.routeName||'',stops:selected?.stops||[]}
 }
 async function getRouteArrivals(routeId,force=false) {
  const [city,uid]=split(routeId)
  const data=await query('EstimatedTimeOfArrival/City/'+city,{'$filter':'RouteUID eq '+quote(uid)},15000,force)
  return {arrivals:data.map(x=>arrival(x,city)),updatedAt:stamp(data),fetchedAt:new Date().toISOString()}
 }
 async function getStop(stopId) {
  const [city,uid]=split(stopId)
  const data=(await catalog('Stop',city)).filter(x=>x.StopUID===uid)
  if(!data.length)throw new ApiError('NOT_FOUND','找不到站牌。',404)
  return stop(data[0],city)
 }
 async function getStopArrivals(stopId,force=false) {
  const [city,uid]=split(stopId)
  const data=await query('EstimatedTimeOfArrival/City/'+city,{'$filter':'StopUID eq '+quote(uid)},15000,force)
  return {arrivals:data.map(x=>arrival(x,city)),updatedAt:stamp(data),fetchedAt:new Date().toISOString()}
 }
 async function getStopRoutes(stopId) {
  const [city,uid]=split(stopId)
  const data=await query('StopOfRoute/City/'+city,{'$filter':'Stops/any(s:s/StopUID eq '+quote(uid)+')'})
  return [...new Map(data.map(x=>[x.RouteUID+'-'+x.Direction,{id:id(city,x.RouteUID),name:x.RouteName.Zh_tw,direction:x.Direction,destination:x.Stops?.at(-1)?.StopName?.Zh_tw||''}])).values()]
 }
 async function nearby(latitude,longitude,city='TaipeiMetro') {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<21||latitude>27||longitude<118||longitude>123)throw new ApiError('LOCATION','目前僅支援台灣公車，請改用縣市搜尋。',422)
  const data=await Promise.all(scope(city).map(async city=>(await query('Stop/City/'+city,{'$spatialFilter':'nearby('+latitude+','+longitude+',1000)','$top':'80'},60000)).map(x=>stop(x,city))))
  return data.flat().map(s=>({...s,distance:Math.round(distanceKm(s,{latitude,longitude})*1000)})).filter(s=>s.distance<=1000).sort((a,b)=>a.distance-b.distance).slice(0,20)
 }
 return {search,getRoute,getRouteStops,getRouteArrivals,getStop,getStopArrivals,getStopRoutes,nearby}
}
