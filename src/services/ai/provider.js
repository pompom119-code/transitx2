async function readPlan(body, onProgress = undefined, signal = undefined) {
 const timeout=AbortSignal.timeout(210000)
 const response=await fetch('/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,timeout]):timeout})
 if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.message||'AI 暫時無法規劃，請稍後再試。')}
 if(!response.body)throw new Error('此瀏覽器無法接收規劃進度。')
 const reader=response.body.getReader(),decoder=new TextDecoder()
 let pending='',result
 const consume=line=>{
  if(!line.trim())return
  const event=JSON.parse(line)
  if(event.type==='progress')onProgress?.(event.step)
  if(event.type==='error')throw new Error(event.message)
  if(event.type==='result')result=event.value
 }
 try{
  while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop();lines.forEach(consume)}
  pending+=decoder.decode();consume(pending)
  if(!result)throw new Error('AI 回應中斷，未儲存不完整行程。')
  return result
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export async function requestPlan(body,onProgress=undefined,signal=undefined){
 try{return await readPlan(body,onProgress,signal)}catch(error){
  if(signal?.aborted)throw error
  if(['TypeError','SyntaxError','TimeoutError'].includes(error.name))throw new Error('AI 暫時無法規劃，連線逾時或回應不完整，請稍後再試。',{cause:error})
  throw error
 }
}
