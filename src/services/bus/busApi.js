import { Cache } from './cache.js'
const cache=new Cache()
export async function busRequest(path,params={},force=false,ttl=60000,signal=undefined){
 const url='/api/bus/'+path+'?'+new URLSearchParams(params)
 return cache.get(url,ttl,async()=>{
  try{
   const response=await fetch(url+(force?'&refresh=1':''),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(240000)]):AbortSignal.timeout(240000)})
   const data=await response.json()
   if(!response.ok)throw new Error(data.message||'即時公車資料暫時無法取得。')
   return data
  }catch(error){if(signal?.aborted)throw error;throw new Error(error.name==='TimeoutError'?'公車資料請求逾時，請重新整理。':error instanceof TypeError?'即時公車資料暫時無法取得，請檢查網路。':error.message,{cause:error})}
 },force)
}
export const busApi={
 search:(q,city='TaipeiMetro')=>busRequest('search',{q,city}),
 searchRoutes:async(q,city='TaipeiMetro')=>(await busApi.search(q,city)).routes,
 searchStops:async(q,city='TaipeiMetro')=>(await busApi.search(q,city)).stops,
 getRoute:id=>busRequest('route',{id},false,3600000),
 getRouteStops:(id,direction,variant='')=>busRequest('route-stops',{id,direction:String(direction),variant},false,3600000),
 getRouteArrivals:(id,refresh=false)=>busRequest('route-arrivals',{id},refresh,15000),
 getStop:id=>busRequest('stop',{id},false,3600000),
 getStopArrivals:(id,refresh=false)=>busRequest('stop-arrivals',{id},refresh,15000),
 getStopRoutes:id=>busRequest('stop-routes',{id},false,3600000),
 nearby:(lat,lon,city='TaipeiMetro')=>busRequest('nearby',{lat:String(lat),lon:String(lon),city}),
}
export function currentLocation(){
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation)return reject(new Error('瀏覽器不支援定位，仍可使用公車搜尋。'))
  navigator.geolocation.getCurrentPosition(position=>resolve(position.coords),error=>reject(new Error(error.code===1?'你未允許定位，仍可使用公車搜尋。':'無法取得位置，請重試或使用搜尋。')),{timeout:12000,maximumAge:60000,enableHighAccuracy:false})
 })
}
