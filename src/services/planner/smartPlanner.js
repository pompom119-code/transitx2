import { tripFormError } from '../tripDates.js'

export const plannerSteps = ['正在整理適合你的地點','正在依偏好選點','正在安排每天的路線','正在調整行程節奏','正在完成你的行程']

async function requestPlanner(body,onProgress,signal) {
  const timeout = AbortSignal.timeout(90000)
  let response
  try { response = await fetch('/api/planner/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,timeout]):timeout}) }
  catch(error){throw Object.assign(new Error('地點資料連線逾時或無法使用，請稍後重試。'),{code:error?.name==='TimeoutError'?'POI_TIMEOUT':'POI_PROVIDER',cause:error})}
  if(!response.ok){const payload=await response.json().catch(()=>({}));throw Object.assign(new Error(payload.message||'智慧規劃暫時無法完成。'),{code:payload.code})}
  if(!response.body)throw Object.assign(new Error('無法接收規劃結果。'),{code:'PLANNER_NETWORK'})
  const reader=response.body.getReader(),decoder=new TextDecoder()
  let pending='',result
  const consume=line=>{
    if(!line.trim())return
    const event=JSON.parse(line)
    if(event.type==='progress')onProgress?.(event.step)
    if(event.type==='error')throw Object.assign(new Error(event.message),{code:event.code})
    if(event.type==='result')result=event.value
  }
  try {
    while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop();for(const line of lines)consume(line)}
    pending+=decoder.decode();consume(pending)
    if(!result)throw Object.assign(new Error('規劃回應中斷，未儲存不完整行程。'),{code:'PLANNER_NETWORK'})
    return result
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock()}
}

export const smartPlanner = {
  planTrip(form,profile,onProgress,signal){const error=tripFormError(form);if(error)throw new Error(error);if(!profile)throw new Error('請先選擇旅行設定。');return requestPlanner({operation:'generate',form,profile},onProgress,signal)},
  generateTrip(form,profile,onProgress,signal){return this.planTrip(form,profile,onProgress,signal)},
  replacePlace(trip,dayIndex,spotId,signal){return requestPlanner({operation:'replace',trip,dayIndex,spotId},undefined,signal)},
  replanDay(trip,dayIndex,signal){return requestPlanner({operation:'replan',trip,dayIndex},undefined,signal)},
}
export const planTrip = (...args) => smartPlanner.planTrip(...args)
