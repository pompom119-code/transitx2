export function friendlyPlanningError(error) {
  const code = error?.code || error?.cause?.code
  if (code === 'INSUFFICIENT_POIS') return '目前能取得的地點資料不足以安排完整行程，請改用較大的城市或縮短天數。'
  if (code === 'MUST_VISIT_UNRESOLVED' || code === 'MUST_VISIT_OVERFLOW') return error.message
  if (code === 'POI_PROVIDER' || code === 'POI_TIMEOUT') return '真實地點資料暫時無法取得，請稍後重試；不會使用固定行程代替。'
  if (code === 'PLANNER_VALIDATION' || code === 'PLANNER_ERROR') return error.message || '行程資料未通過檢查，請重試。'
  if (code === 'DESTINATION_AMBIGUOUS') return '找不到明確的目的地，請輸入城市或地區名稱後再試。'
  if (code === 'PLACE_PROVIDER') return '目的地定位資料暫時無法取得，請稍後重試。'
  if (code === 'FOOD_AREA_UNVERIFIED' || code === 'PLACE_UNVERIFIED' || code === 'GEOGRAPHY') {
    return '目前無法確認部分景點或用餐區域，請重新規劃或調整指定地點。'
  }
  if (code === 'AI_NOT_CONFIGURED' || code === 'FREE_TIER_UNCONFIRMED') {
    return 'AI 規劃服務尚未設定完成，請稍後再試。'
  }
  if (code === 'COOLDOWN' || code === 'DUPLICATE' || code === 'BUSY') return '已有規劃正在進行，或剛完成一次嘗試。請稍候片刻再重新規劃。'
  if (code === 'DAILY_LIMIT' || code === 'RATE_LIMIT') return error?.retryAfterMs > 0
    ? `規劃請求太頻繁，請約 ${Math.ceil(error.retryAfterMs / 1000)} 秒後再試。`
    : '規劃請求太頻繁，請稍後再試。'
  if (code === 'AI_UNAVAILABLE') return 'AI 目前比較忙，請稍後再試。'
  if (code === 'TIMEOUT' || code === 'NETWORK') return 'AI 連線逾時或網路暫時無法使用，請檢查連線後再試。'
  if (error?.name === 'AbortError') return '規劃已取消。'
  return '智慧規劃暫時無法完成這次行程，請稍後再試或縮短旅程天數。'
}
