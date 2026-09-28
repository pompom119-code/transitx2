import { ApiError, Cache, requestJson } from '../core.js'
export function createTdx(env, fetcher = fetch) {
  const cache = new Cache()
  let token = null, tokenTask = null, nextRequest = 0, queue = Promise.resolve()
  const accessToken = async () => {
    if (!env.TDX_CLIENT_ID || !env.TDX_CLIENT_SECRET) throw new ApiError('TDX_NOT_CONFIGURED','公車資料尚未設定 TDX_CLIENT_ID／TDX_CLIENT_SECRET。',503)
    if (env.TDX_FREE_PLAN_CONFIRMED !== 'true') throw new ApiError('FREE_PLAN_UNCONFIRMED','請先確認 TDX 免費方案可用，並設定 TDX_FREE_PLAN_CONFIRMED=true。',503)
    if (token && token.expires>Date.now()) return token.value
    if (!tokenTask) tokenTask=requestJson('https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'client_credentials',client_id:env.TDX_CLIENT_ID,client_secret:env.TDX_CLIENT_SECRET}),
    },fetcher).then(data=>{
      if (!data.access_token || !Number.isFinite(data.expires_in)) throw new ApiError('AUTH','TDX 驗證失敗。')
      token={value:data.access_token,expires:Date.now()+(data.expires_in-60)*1000};return token.value
    }).finally(()=>{tokenTask=null})
    return tokenTask
  }
  return async (path, params = {}, ttl = 86400000, force = false) => {
    const url = 'https://tdx.transportdata.tw/api/basic/v2/Bus/'+path+'?'+new URLSearchParams({'$format':'JSON',...params})
    return cache.get(url,ttl,async()=>{
      const bearer=await accessToken()
      const turn=queue.then(async()=>{
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,nextRequest-Date.now())))
        // TDX basic free membership: at most five requests per minute per key.
        nextRequest=Date.now()+12200
        try {
          const data=await requestJson(url,{headers:{Authorization:'Bearer '+bearer}},fetcher)
          if (!Array.isArray(data)) throw new ApiError('INVALID_DATA','TDX 資料格式不正確。')
          return data
        } catch(error) { if(error.code==='AUTH') token=null; throw error }
      })
      queue=turn.then(()=>{},()=>{})
      return turn
    },force)
  }
}
