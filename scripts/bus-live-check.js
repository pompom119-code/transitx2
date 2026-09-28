import { loadEnv } from 'vite'
import { createBus } from '../server/bus/service.js'

const env={...loadEnv('development',process.cwd(),''),...process.env}
if (!env.TDX_CLIENT_ID||!env.TDX_CLIENT_SECRET||env.TDX_FREE_PLAN_CONFIRMED!=='true') {
 console.error('TDX Client ID／Secret 或免費方案確認尚未設定；未發送資料請求。')
 process.exitCode=2
} else {
 const bus=createBus(env)
 const normalized=text=>text.replace(/臺/g,'台')
 let failures=0
 for (const q of ['307','666','795','石碇高中','台北車站']) {
  try {
   const found=await bus.search(q)
   const route=/^\d+$/.test(q)?found.routes.find(item=>item.name===q)||found.routes.find(item=>item.name.startsWith(q)):undefined
   const stop=/^\d+$/.test(q)?undefined:found.stops.find(item=>normalized(item.name).includes(q))
   if (/^\d+$/.test(q) && !route) throw new Error('沒有找到對應號碼的路線或名稱變體')
   if (!/^\d+$/.test(q) && !stop) throw new Error('沒有找到相關站牌')
   if (route) {
    const detail=await bus.getRoute(route.id)
    const outbound=await bus.getRouteStops(route.id,0)
    const inbound=await bus.getRouteStops(route.id,1)
    const eta=await bus.getRouteArrivals(route.id,true)
    if(!detail.name.startsWith(q)||!outbound.stops.length||!inbound.stops.length||!Array.isArray(eta.arrivals)) throw new Error('路線／方向／站序／ETA 資料不完整')
    console.info('  路線變體',detail.name,'去程',outbound.stops.length,'返程',inbound.stops.length,'ETA',eta.arrivals.length)
   }
   if (stop) {
    const detail=await bus.getStop(stop.id)
    const routes=await bus.getStopRoutes(stop.id)
    const eta=await bus.getStopArrivals(stop.id,true)
    if(!Array.isArray(eta.arrivals)||!Array.isArray(routes))throw new Error('站牌路線／ETA 資料格式不正確')
    if(Number.isFinite(detail.latitude)&&Number.isFinite(detail.longitude)){
     const nearby=await bus.nearby(detail.latitude,detail.longitude,detail.city)
     if(!Array.isArray(nearby))throw new Error('附近站牌資料格式不正確')
    }
    console.info('  站牌',detail.name,'行經路線',routes.length,'ETA',eta.arrivals.length)
   }
   console.info('PASS TDX',q,'路線',found.routes.length,'站牌',found.stops.length)
  }catch(error){failures++;console.error('FAIL TDX',q,error.code||'ERROR',error.message)}
 }
 process.exitCode=failures?1:0
}
