import { useEffect, useState } from 'react'
export function useBus(load, keys) {
 const [value,setValue]=useState(/** @type {any} */(null))
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const [version,setVersion]=useState(0)
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setValue(null)
  Promise.resolve().then(load).then(data=>{if(active)setValue(data)}).catch(reason=>{if(active)setError(reason.message)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[...keys,version])
 return {value,error,loading,retry:()=>setVersion(v=>v+1)}
}

