import test from 'node:test'
import assert from 'node:assert/strict'
import { requestPlan } from '../src/services/ai/provider.js'

test('client AI stream handles split UTF-8 chunks and forwards actual progress', async t => {
 const payload = new TextEncoder().encode('{"type":"progress","step":1}\n{"type":"result","value":{"title":"東京行程"}}\n')
 const chunks = [payload.slice(0,61),payload.slice(61,64),payload.slice(64)]
 t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(controller){chunks.forEach(chunk=>controller.enqueue(chunk));controller.close()}})))
 const progress=[]
 assert.deepEqual(await requestPlan({operation:'generate'},step=>progress.push(step)),{title:'東京行程'})
 assert.deepEqual(progress,[1])
})
test('client AI rejects incomplete, invalid and server-error streams without fallback',async t=>{
 for(const payload of ['{"type":"progress","step":1}\n','invalid\n','{"type":"error","message":"API quota reached"}\n']){
  const fetch=t.mock.method(globalThis,'fetch',async()=>new Response(payload))
  await assert.rejects(requestPlan({operation:'generate'}))
  fetch.mock.restore()
 }
})
test('client AI gives actionable network and missing-configuration errors',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('offline')})
 await assert.rejects(requestPlan({}),/AI 暫時無法規劃/)
 fetch.mock.restore()
 t.mock.method(globalThis,'fetch',async()=>Response.json({message:'尚未設定 GEMINI_API_KEY'},{status:503}))
 await assert.rejects(requestPlan({}),/GEMINI_API_KEY/)
})
