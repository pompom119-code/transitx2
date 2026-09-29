import { addDays } from '../src/services/tripDates.js'
const days=Math.max(1,Number(process.argv[2])||1)
const form={destination:'淡水',startDate:'2026-10-10',endDate:addDays('2026-10-10',days-1),days,dateUnknown:false,travelerCount:3,places:['紅毛城'],optionalNotes:''}
const profile={id:'endpoint-test',answers:{companions:'朋友',interests:['美食','拍照'],exploration:'探索派',transport:['公車','步行'],walking:'適中走',budget:'標準享受',pace:'悠閒放鬆',notes:''}}
const start=performance.now()
const response=await fetch('http://127.0.0.1:5173/api/planner/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'generate',form,profile}),signal:AbortSignal.timeout(90000)})
const raw=await response.text()
const events=raw.split('\n').filter(Boolean).map(line=>JSON.parse(line))
const result=events.find(item=>item.type==='result')?.value
const error=events.find(item=>item.type==='error')
console.log(JSON.stringify({status:response.status,elapsedMs:Math.round(performance.now()-start),steps:events.filter(item=>item.type==='progress').map(item=>item.step),error:error?{code:error.code,message:error.message}:null,result:result?{destination:result.destination,days:result.days.length,source:result.source,poiCount:result.days.flatMap(day=>day.spots).filter(spot=>spot.type==='poi').length,mustVisit:result.days.flatMap(day=>day.spots).some(spot=>spot.requiredPlace==='紅毛城'),poiNames:result.days.flatMap(day=>day.spots).filter(spot=>spot.type==='poi').map(spot=>spot.title)}:null}))
if(!response.ok||error||!result)process.exitCode=1
