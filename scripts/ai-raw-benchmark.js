import { localModel } from '../src/services/ai/localModel.js'
import { AI_SYSTEM, intentPrompt, draftPrompt } from '../src/services/ai/planningPrompts.js'
import { normalizeRequest, assertContract, intentSchema, dayDraftSchema, validateDraft } from '../src/services/ai/contracts.js'

const cases = [
  ['A 淡水朋友美食拍照','淡水','朋友',2,['美食','拍照'],'探索派','普通','中等','輕鬆','', '紅毛城'],
  ['B 淡水自己文化攝影','淡水','自己',1,['文化','攝影'],'探索派','普通','中等','普通','', '紅毛城'],
  ['C 淡水家人少走路','淡水','家人',4,['經典','自然'],'經典派','少走路','中等','慢節奏','帶長輩，少走路', '紅毛城'],
  ['D 台北朋友美食','台北','朋友',2,['美食'],'經典派','普通','中等','普通','', '台北101'],
  ['E 東京自己攝影','東京','自己',1,['攝影'],'探索派','普通','中等','普通','', '東京鐵塔'],
  ['F 高雄家人慢節奏','高雄','家人',4,['文化','美食'],'經典派','少走路','中等','慢節奏','帶長輩', '駁二藝術特區'],
  ['G 淡水朋友低預算充實','淡水','朋友',2,['美食'],'探索派','普通','小資','充實探索','預算低', '紅毛城'],
  ['H 台中文化攝影','台中','自己',1,['文化','攝影'],'探索派','普通','中等','普通','', '台中國家歌劇院'],
]
const status = document.querySelector('#status'), rows = document.querySelector('#rows'), summary = document.querySelector('#summary')
const records = []
const params = new URLSearchParams(location.search)
const max = Math.max(1, Math.min(24, Number(params.get('max') || 18)))
const caseFilter = params.get('case') || ''
// Development-only model comparison. This does not change the production model.
let comparisonEngine
const comparisonModel = params.get('model') === '4b' ? {
  async prepare(onProgress) {
    if (!comparisonEngine) {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      comparisonEngine = await CreateMLCEngine('Qwen3-4B-q4f16_1-MLC', {
        initProgressCallback(report) { onProgress?.({ label: '正在準備 Qwen3-4B', downloadPercent: Math.round((report.progress || 0) * 100) }) },
      })
    }
  },
  async generate(system, prompt, schema) {
    const maxTokens = schema.properties?.travelApproach ? 700 : schema.properties?.items ? 1500 : 500
    const reply = await comparisonEngine.chat.completions.create({
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.7, top_p: 0.8, presence_penalty: 1.5, max_tokens: maxTokens, enable_thinking: false,
      response_format: { type: 'json_object', schema: JSON.stringify(schema) },
    })
    try { return JSON.parse(reply.choices?.[0]?.message?.content) } catch { throw new Error('Qwen3-4B 沒有回傳有效 JSON') }
  },
} : localModel
let count = 0
for (const [name,destination,companions,travelerCount,interests,exploration,walking,budget,pace,notes,must] of cases) {
  if (caseFilter && !name.startsWith(caseFilter)) continue
  for (let iteration=1; iteration<=3; iteration++) {
    if (count++ >= max) break
    const form={destination,days:1,startDate:'2026-10-01',endDate:'2026-10-01',dateUnknown:false,travelerCount,places:[must],optionalNotes:''}
    const profile={id:`raw-${name}`,answers:{companions,interests,exploration,walking,budget,pace,transport:['公車','步行'],notes:{selected:[],text:notes}}}
    const request=normalizeRequest(form,profile)
    const record={name,iteration,destination,travelerCount,interests,seconds:0,intentJson:false,dayJson:false,dayRules:false,providerVerified:false,
      mustVisit:false,foodNamedAttempts:0,poiNames:[],foodSuggestions:[],error:'',rawIntent:null,rawDay:null}
    const started=performance.now()
    try {
      status.textContent=`${name} / ${iteration}：準備模型`
      await comparisonModel.prepare(update=>{status.textContent=`${name} / ${iteration}：${update.label} ${update.downloadPercent??''}%`})
      status.textContent=`${name} / ${iteration}：意圖策略`
      const intent=await comparisonModel.generate(AI_SYSTEM,intentPrompt(request),intentSchema)
      record.rawIntent=intent
      assertContract(intent,intentSchema)
      record.intentJson=true
      status.textContent=`${name} / ${iteration}：單日草稿`
      const day=await comparisonModel.generate(AI_SYSTEM,draftPrompt(request,intent,0),dayDraftSchema)
      record.rawDay=day
      assertContract(day,dayDraftSchema)
      record.dayJson=true
      record.poiNames=day.items.filter(item=>item.type==='poi').map(item=>item.name)
      record.foodSuggestions=day.items.filter(item=>item.type==='food').map(item=>({area:item.area,foods:item.foods}))
      record.foodNamedAttempts=day.items.filter(item=>item.type==='food'&&(item.name||item.title)).length
      record.mustVisit=record.poiNames.some(place=>place.includes(must))
      const cleaned=day.items.map(item=>item.type==='food'?{...item,name:'',title:''}:item.type==='poi'?{...item,title:'',area:''}:{...item,name:''})
      const draft={destination:request.destination,travelerCount:request.travelerCount,days:[{date:request.startDate,theme:day.theme,items:cleaned}]}
      try {validateDraft(draft,request);record.dayRules=true} catch(error) {record.error=error.message}
      if(record.dayRules){
        status.textContent=`${name} / ${iteration}：查核 POI 與餐飲區域`
        const response=await fetch('/api/ai/resolve-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft,request})})
        const value=await response.json()
        record.providerVerified=response.ok
        if(!response.ok)record.error=`${value.code||'PROVIDER'}：${value.message}`
      }
    } catch(error) {record.error=error.message}
    record.seconds=Math.round((performance.now()-started)/100)/10
    records.push(record)
    const row=document.createElement('tr')
    for(const value of [name,iteration,record.seconds,record.intentJson&&record.dayJson?'✓':'✕',record.dayRules?'✓':'✕',record.providerVerified?'✓':record.error]){
      const cell=document.createElement('td');cell.textContent=String(value);row.append(cell)
    }
    rows.append(row)
    summary.textContent=JSON.stringify(records,null,2)
  }
  if(count>=max)break
}
status.textContent=`完成 ${records.length} 次原始模型生成；JSON ${records.filter(record=>record.intentJson&&record.dayJson).length}、業務規則 ${records.filter(record=>record.dayRules).length}、資料查核 ${records.filter(record=>record.providerVerified).length}。`
