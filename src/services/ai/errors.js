export function friendlyPlanningError(error) {
  const code = error?.code || error?.cause?.code
  const inDev=import.meta.env?.DEV === true
  const withCode=message=>inDev&&code?`${message}（${code}）`:message
  if (code === 'INSUFFICIENT_POIS') return withCode('目前能查核的景點少於旅行天數，請縮短天數或改用較大的目的地。')
  if (code === 'MUST_VISIT_UNRESOLVED' || code === 'MUST_VISIT_OVERFLOW') return withCode(error.message)
  if (code === 'POI_PROVIDER' || code === 'POI_TIMEOUT') return withCode('真實地點資料暫時無法取得，請稍後重試；不會使用固定行程代替。')
  if (code === 'PLANNER_VALIDATION' || code === 'PLANNER_ERROR') return withCode('已取得地點資料，但行程檢查未通過；請調整指定地點或重試。')
  if (code === 'DESTINATION_AMBIGUOUS') return withCode('找不到明確的目的地，請輸入城市或地區名稱後再試。')
  if (code === 'PLACE_PROVIDER') return withCode('目的地定位資料暫時無法取得，請稍後重試。')
  if (code === 'FOOD_AREA_UNVERIFIED' || code === 'PLACE_UNVERIFIED' || code === 'GEOGRAPHY') {
    return withCode('目前無法確認部分景點或用餐區域，請重新規劃或調整指定地點。')
  }
  if (code === 'AI_NOT_CONFIGURED' || code === 'FREE_TIER_UNCONFIRMED') {
    return withCode('AI 規劃服務尚未設定完成，請稍後再試。')
  }
  if (code === 'COOLDOWN' || code === 'DUPLICATE' || code === 'BUSY') return withCode('已有規劃正在進行，或剛完成一次嘗試。請稍候片刻再重新規劃。')
  if (code === 'DAILY_LIMIT' || code === 'RATE_LIMIT') return withCode(error?.retryAfterMs > 0
    ? `規劃請求太頻繁，請約 ${Math.ceil(error.retryAfterMs / 1000)} 秒後再試。`
    : '規劃請求太頻繁，請稍後再試。')
  if (code === 'AI_UNAVAILABLE') return withCode('AI 目前比較忙，請稍後再試。')
  if (code === 'TIMEOUT' || code === 'NETWORK') return withCode('AI 連線逾時或網路暫時無法使用，請檢查連線後再試。')
  if (error?.name === 'AbortError') return '規劃已取消。'
  return withCode('智慧規劃暫時無法完成這次行程，請稍後再試或縮短旅程天數。')
}
