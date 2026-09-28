import { loadEnv } from 'vite'
import { createPlanner } from '../server/ai/planner.js'
import { createBus } from '../server/bus/service.js'
import { addDays } from '../src/services/tripDates.js'
const env={...loadEnv('development',process.cwd(),''),...process.env}
if(!env.GEMINI_API_KEY||!env.TDX_CLIENT_ID||!env.TDX_CLIENT_SECRET||env.GEMINI_FREE_TIER_CONFIRMED!=='true'||env.TDX_FREE_PLAN_CONFIRMED!=='true'){
 console.error('尚未設定完整憑證及免費方案確認；未執行任何真實 AI／TDX 測試。')
 process.exitCode=2
}else{
 const plan=createPlanner(env),bus=createBus(env)
 const profile={id:'live-qa',answers:{companions:'自己',interests:['美食','拍照'],exploration:'經典派',transport:['公車','步行'],walking:'適中走',budget:'標準享受',pace:'悠閒慢遊',notes:''}}
 const startDate=addDays(new Date().toISOString().slice(0,10),7)
 let failed=0
 for(const [destination,days,place]of [['台北',1,'台北101'],['東京',4,'東京塔'],['大阪',3,'大阪城'],['高雄',2,'駁二藝術特區']]){
  try{
   const trip=await plan({operation:'generate',profile,form:{destination,days,startDate,endDate:addDays(startDate,days-1),places:[place],dateUnknown:false}},()=>{})
   console.info('PASS AI',destination,trip.days.length,'days; geography/schema/dates/profile/required place validated')
  }catch(error){failed++;console.error('FAIL AI',destination,error.code||'ERROR',error.message)}
 }
 for(const q of ['307','666','795','石碇高中','台北車站']){
  try{
   const result=await bus.search(q)
   if(!result.routes.length&&!result.stops.length)throw Error('搜尋無結果')
   const r=result.routes.find(r=>r.name===q)
   if(/^\d+$/.test(q)&&!r)throw Error('沒有精確路線號碼，不能把模糊搜尋當作通過')
   if(r){await bus.getRoute(r.id);await bus.getRouteStops(r.id,0);await bus.getRouteStops(r.id,1);await bus.getRouteArrivals(r.id,true)}
   const s=result.stops.find(s=>s.name.replace(/臺/g,'台')===q)||result.stops[0]
   if(!/^\d+$/.test(q)&&!result.stops.some(s=>s.name.replace(/臺/g,'台')===q))throw Error('沒有精確站名，需人工核對官方名稱')
   if(s){await bus.getStop(s.id);await bus.getStopRoutes(s.id);await bus.getStopArrivals(s.id);await bus.getStopArrivals(s.id,true)}
   console.info('PASS BUS',q,'routes',result.routes.length,'stops',result.stops.length,'ETA endpoint returned (may have no estimates)')
  }catch(error){failed++;console.error('FAIL BUS',q,error.code||'ERROR',error.message)}
 }
 process.exitCode=failed?1:0
}
