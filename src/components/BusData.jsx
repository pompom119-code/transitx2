import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { busApi, currentLocation } from '../services/bus/busApi'
import { cities } from '../services/bus/types'
import { Icon, PrimaryButton, SkeletonList } from './Ui'
export function DataError({error,retry}) {
 return <div className="inline-error" role="alert"><strong>即時公車資料暫時無法取得</strong><p>{error}</p><PrimaryButton onClick={retry}>重新整理</PrimaryButton></div>
}
export function CitySelect({value,onChange}) {
 return <label className="data-city-select">查詢縣市<select aria-label="查詢縣市" value={value} onChange={e=>onChange(e.target.value)}><option value="TaipeiMetro">臺北市＋新北市</option>{Object.entries(cities).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
}
export function NearbyStops({city='TaipeiMetro'}) {
 const navigate=useNavigate(),[items,setItems]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const locate=async()=>{
  setLoading(true);setError('');setItems(null)
  try{const position=await currentLocation();setItems(await busApi.nearby(position.latitude,position.longitude,city))}
  catch(reason){setError(reason.message)}
  finally{setLoading(false)}
 }
 return <div className="nearby-stop-card">{loading?<SkeletonList rows={2}/>:items?items.length?items.map(stop=><button type="button" className="bus-stop-row" key={stop.id} onClick={()=>navigate('/traffic/stops/'+encodeURIComponent(stop.id))}><Icon name="pin"/><span><strong>{stop.name}</strong><small>{stop.area}・約 {stop.distance} 公尺</small></span><i>›</i></button>):<p className="home-empty-favorites">選定縣市的 1 公里內沒有站牌；可切換縣市或直接搜尋。</p>:<p className="home-empty-favorites">取得你允許的位置後，顯示選定縣市附近的真實站牌。</p>}{error&&<p className="inline-error" role="alert">{error}</p>}<PrimaryButton disabled={loading} onClick={locate}><Icon name="pin" size={18}/>{loading?'定位與查詢中…':items?'重新定位':'開啟定位查看附近站牌'}</PrimaryButton></div>
}
export function UpdatedAt({value}) {
 const valid=Number.isFinite(Date.parse(value))
 return <span>資料來源：交通部 TDX・最後更新：{valid?new Date(value).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):'未提供'}{valid&&Date.now()-Date.parse(value)>180000?'（資料已過期）':''}</span>
}

