import { planTrip } from '../src/services/ai/pipeline.js'
import { localModel } from '../src/services/ai/localModel.js'
import { assertContract } from '../src/services/ai/contracts.js'

const cases = [
  ['A 淡水朋友美食拍照','淡水','朋友',2,['美食','拍照'],'探索派','普通','中等','輕鬆','', '紅毛城'],
  ['B 淡水自己文化攝影','淡水','自己',1,['文化','攝影'],'探索派','普通','中等','普通','', '紅毛城'],
  ['C 淡水家人少走路','淡水','家人',4,['經典','自然'],'經典派','少走路','中等','慢節奏','帶長輩，少走路', '紅毛城'],
  ['D 台北朋友美食','台北','朋友',2,['美食'],'經典派','普通','中等','普通','', '台北101'],
  ['E 東京自己攝影','東京','自己',1,['攝影'],'探索派','普通','中等','普通','', '東京鐵塔'],
  ['F 高雄家人慢節奏','高雄','家人',4,['文化','美食'],'經典派','少走路','中等','慢節奏','帶長輩', '駁二藝術特區'],
]
const status = document.querySelector('#status')
const rows = document.querySelector('#results')
const summary = document.querySelector('#summary')
const results = []
const params = new URLSearchParams(location.search)
const maxRuns = Math.max(1, Math.min(24, Number(params.get('max') || 18)))
const caseFilter = params.get('case') || ''
const resolver = { async resolveDraft(draft, request) {
  const response = await fetch('/api/ai/resolve-draft', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({draft,request}) })
  const value = await response.json()
  if(!response.ok)throw Object.assign(new Error(value.message||'地點查核失敗'),{code:value.code||'PLACE_PROVIDER'})
  return value
} }

let runCount = 0
for (const [name,destination,companions,count,interests,exploration,walking,budget,pace,notes,must] of cases) {
  if (caseFilter && !name.startsWith(caseFilter)) continue
  for (let iteration=1; iteration<=3; iteration++) {
    if (runCount++ >= maxRuns) break
    const form = { destination, days:1, dateUnknown:false, startDate:'2026-10-01', endDate:'2026-10-01', travelerCount:count, places:[must], optionalNotes:'' }
    const profile = { id:`benchmark-${name}`, answers:{ companions, interests, exploration, walking, budget, pace, transport:['公車','步行'], notes:{selected:[],text:notes} } }
    let foodNameAttempts=0, schemaFailures=0, modelCalls=0, plan=null, error=null
    const rawOutputs=[]
    const measuredModel = { prepare:(update,signal)=>localModel.prepare(update,signal), async generate(system,prompt,schema,signal) {
      modelCalls++
      status.textContent=`${name} / ${iteration}: 模型推論第 ${modelCalls} 次（${JSON.parse(prompt).phase}）`
      const value=await localModel.generate(system,prompt,schema,signal)
      rawOutputs.push(value)
      try { assertContract(value,schema) } catch { schemaFailures++ }
      if(Array.isArray(value.items))foodNameAttempts+=value.items.filter(item=>item.type==='food'&&(item.name||item.title)).length
      return value
    } }
    const started=performance.now()
    try {plan=await planTrip(form,profile,measuredModel,event=>{status.textContent=`${name} / ${iteration}: ${event.label}${event.downloadPercent!=null?' '+event.downloadPercent+'%':''}`},undefined,resolver)}
    catch(reason){error=reason.message}
    const seconds=Math.round((performance.now()-started)/100)/10
    const items=plan?.draft.days[0].items.map(item=>({type:item.type,name:item.name,title:item.title,area:item.area,foods:item.foods,minutes:item.estimatedDurationMinutes,verificationStatus:item.verificationStatus}))||[]
    const pois=items.filter(item=>item.type==='poi').map(item=>item.name)
    const record={name,iteration,success:Boolean(plan),seconds,modelCalls,schemaFailures,pois,items,intent:plan?.intent||null,foodNameAttempts,error,rawOutputs}
    results.push(record)
    const tr=document.createElement('tr')
    for(const content of [name,iteration,plan?'通過':'失敗：'+error,seconds,pois.join('、'),foodNameAttempts]){const td=document.createElement('td');td.textContent=String(content);tr.append(td)}
    rows.append(tr)
    summary.textContent=JSON.stringify(results,null,2)
  }
  if (runCount >= maxRuns) break
}
status.textContent=`完成：${results.filter(value=>value.success).length}/${results.length} 通過；沒有自動補假行程。`
