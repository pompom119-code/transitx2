import { ApiError } from './core.js'
import { createPlanner } from './ai/planner.js'
import { createBus } from './bus/service.js'
import { createPlaceResolver, verifyAndResolve } from './ai/places.js'
import { randomBytes } from 'node:crypto'
import { createAiRequestGuard } from './ai/requestGuard.js'

async function jsonBody(req) {
 if(!req.headers['content-type']?.startsWith('application/json'))throw new ApiError('INPUT','需要 JSON request。',415)
 if(req.body !== undefined) {
  let value
  try{value=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{throw new ApiError('INPUT','無效 JSON。',400)}
  if(Buffer.byteLength(JSON.stringify(value))>256000)throw new ApiError('INPUT','資料過大。',413)
  return value
 }
 let raw=''
 for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>256000)throw new ApiError('INPUT','資料過大。',413)}
 try{return JSON.parse(raw)}catch{throw new ApiError('INPUT','無效 JSON。',400)}
}

function aiSession(req,res) {
 const supplied=String(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('tx_ai_sid='))?.slice(10)
 if(supplied && /^[a-f0-9]{32}$/.test(supplied))return supplied
 const session=randomBytes(16).toString('hex')
 const secure=String(req.headers['x-forwarded-proto']||'').split(',')[0]==='https'
 res.setHeader('Set-Cookie',`tx_ai_sid=${session}; HttpOnly; SameSite=Lax; Path=/api/ai; Max-Age=86400${secure?'; Secure':''}`)
 return session
}
export function createApi(env, dependencies = {}) {
 const planner=dependencies.planner||createPlanner(env)
 const bus=dependencies.bus||createBus(env)
 const placeResolver=dependencies.placeResolver||createPlaceResolver()
 const guardedPlan=dependencies.guardedPlan||createAiRequestGuard()
 let minute=0,count=0
 return async (req,res,next=()=>{}) => {
  const url=new URL(req.url,'http://localhost')
  if(!url.pathname.startsWith('/api/'))return next()
  const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
  const controller=new AbortController()
  res.on('close',()=>{if(!res.writableEnded)controller.abort()})
  try {
   const host=String(req.headers.host||'')
   if(env.VERCEL!=='1' && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))throw new ApiError('HOST','僅接受本機請求。',403)
   if(req.headers.origin && new URL(req.headers.origin).host!==host)throw new ApiError('ORIGIN','不接受跨站請求。',403)
   if(req.headers['sec-fetch-site']==='cross-site')throw new ApiError('ORIGIN','不接受跨站請求。',403)
   const current=Math.floor(Date.now()/60000)
   if(minute!==current){minute=current;count=0}
   if(++count>120)throw new ApiError('RATE_LIMIT','請求過於頻繁，請稍後再試。',429)
   if(url.pathname==='/api/status' && req.method==='GET')return send({ai:env.GEMINI_API_KEY&&env.GEMINI_FREE_TIER_CONFIRMED==='true'?'configured':'not-configured',bus:env.TDX_CLIENT_ID&&env.TDX_CLIENT_SECRET&&env.TDX_FREE_PLAN_CONFIRMED==='true'?'configured':'not-configured'})
   if(url.pathname==='/api/ai/resolve-draft' && req.method==='POST') {
    const body=await jsonBody(req)
    return send(await verifyAndResolve(body.draft,body.request,placeResolver,controller.signal))
   }
   if(url.pathname==='/api/ai/plan' && req.method==='POST') {
    const body=await jsonBody(req)
    const session=aiSession(req,res)
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'})
    const emit=data=>{if(!res.destroyed)res.write(JSON.stringify(data)+'\n')}
    try {const value=await guardedPlan(session,body,()=>planner(body,step=>emit({type:'progress',step}),controller.signal),controller.signal);emit({type:'result',value})}
    catch(error){emit({type:'error',message:error instanceof ApiError?error.message:'AI 暫時無法規劃，請稍後再試。',code:error.code||'AI_ERROR',retryAfterMs:error.retryAfterMs??null})}
    return res.end()
   }
   if(req.method!=='GET')throw new ApiError('METHOD','不支援此方法。',405)
   const p=url.searchParams, key=p.get('id'),force=p.get('refresh')==='1'
   switch(url.pathname){
    case '/api/bus/search':return send(await bus.search(p.get('q')||'',p.get('city')||'TaipeiMetro'))
    case '/api/bus/route':return send(await bus.getRoute(key))
    case '/api/bus/route-stops':return send(await bus.getRouteStops(key,Number(p.get('direction')||0),p.get('variant')||''))
    case '/api/bus/route-arrivals':return send(await bus.getRouteArrivals(key,force))
    case '/api/bus/stop':return send(await bus.getStop(key))
    case '/api/bus/stop-arrivals':return send(await bus.getStopArrivals(key,force))
    case '/api/bus/stop-routes':return send(await bus.getStopRoutes(key))
    case '/api/bus/nearby':return send(await bus.nearby(Number(p.get('lat')),Number(p.get('lon')),p.get('city')||'TaipeiMetro'))
    default:throw new ApiError('NOT_FOUND','找不到 API。',404)
   }
  } catch(error) { if(!res.headersSent)send({message:error instanceof ApiError?error.message:'資料暫時無法取得，請重試。',code:error.code||'SERVER'},error.status||500);else res.end() }
 }
}
