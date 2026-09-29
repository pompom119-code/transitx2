import { requestPlan } from './provider.js'
import { tripFormError } from '../tripDates.js'
import { planTrip } from './pipeline.js'
import { LocalWebGPUProvider, localCapability } from './localModel.js'
import { toTrip } from './tripAdapter.js'
export const plannerSteps=['正在準備 AI','正在理解你的旅行方式','正在安排每天內容','正在確認景點與餐飲資料','正在檢查完整行程']
// Browser-small models failed the full itinerary acceptance tests. Keep them
// available only when explicitly selected; the validated server provider is
// the normal runtime once its free-tier credentials are configured.
const shouldRunLocal = () => import.meta.env?.VITE_AI_RUNTIME === 'local' && localCapability().supported
const localProvider = new LocalWebGPUProvider()
const localResolvers = { async resolveDraft(draft, request, signal) {
  const response = await fetch('/api/ai/resolve-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, request }), signal })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw Object.assign(new Error(value.message || '景點查核暫時無法完成，沒有儲存未驗證行程。'), { code: value.code || 'PLACE_PROVIDER' })
  }
  return value
} }
async function localEdit(trip, dayIndex, spotId, signal) {
  const day=trip.days?.[dayIndex],profile=trip.request?.profile
  if(!day||!profile)throw new Error('無法讀取原始行程的旅行設定。')
  const replacing=spotId?day.spots.find(spot=>spot.id===spotId):null
  if(spotId&&!replacing)throw new Error('找不到要替換的景點。')
  if(replacing?.requiredPlace)throw new Error('指定地點不可由 AI 替換；請手動編輯。')
  const existing=day.spots.filter(spot=>spot.type==='poi'&&spot.id!==spotId).map(spot=>spot.title)
  const form={destination:trip.destination,startDate:day.date||'',endDate:day.date||'',days:1,dateUnknown:!day.date,
    travelerCount:trip.travelerCount,
    places:existing,optionalNotes:spotId?`用新的景點替換「${replacing.title}」，勿重複現有景點：${existing.join('、')}`:`保留現有景點並重新安排順序：${existing.join('、')}`}
  const plan=await planTrip(form,profile,localProvider,()=>{},signal,localResolvers)
  const nextDay=toTrip(plan,form,profile).days[0]
  if(!spotId)return {...nextDay,id:day.id,label:day.label,date:day.date,spots:nextDay.spots.map(spot=>{
    const original=day.spots.find(item=>item.title===spot.title)
    return original?{...spot,id:original.id,favorite:original.favorite}:spot
  })}
  const names=new Set(day.spots.map(spot=>spot.title))
  const candidate=nextDay.spots.find(spot=>spot.type==='poi'&&!names.has(spot.title))
  if(!candidate)throw new Error('AI 沒找到可驗證的新景點，原行程未變更。')
  return {...candidate,id:replacing.id,time:replacing.time,favorite:replacing.favorite,transportMode:'交通待確認',transportMinutes:null}
}
export const aiPlanner={
 async generateTrip(form,profile,onProgress,signal=undefined){
  const error=tripFormError(form)
  if(error)throw new Error(error)
  if(!profile)throw new Error('請先選擇旅行設定。')
  if(shouldRunLocal()) {
   const plan=await planTrip(form,profile,localProvider,onProgress,signal,localResolvers)
   return toTrip(plan,form,profile)
  }
  return requestPlan({operation:'generate',form,profile},onProgress,signal)
 },
 replacePlace(trip,dayIndex,spotId,signal=undefined){return shouldRunLocal()?localEdit(trip,dayIndex,spotId,signal):requestPlan({operation:'replace',trip,dayIndex,spotId},undefined,signal)},
 replanDay(trip,dayIndex,signal=undefined){return shouldRunLocal()?localEdit(trip,dayIndex,null,signal):requestPlan({operation:'replan',trip,dayIndex},undefined,signal)},
}
