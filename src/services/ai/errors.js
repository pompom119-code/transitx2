export function friendlyPlanningError(error) {
  const code = error?.code || error?.cause?.code
  if (code === 'DESTINATION_AMBIGUOUS') return '找不到明確的目的地，請輸入城市或地區名稱後再試。'
  if (code === 'PLACE_PROVIDER' || code === 'FOOD_AREA_UNVERIFIED' || code === 'PLACE_UNVERIFIED' || code === 'GEOGRAPHY') {
    return '目前無法確認部分景點或用餐區域，請重新規劃或調整指定地點。'
  }
  if (code === 'AI_NOT_CONFIGURED' || code === 'FREE_TIER_UNCONFIRMED') {
    return 'AI 規劃服務尚未設定完成，請稍後再試。'
  }
  if (code === 'COOLDOWN' || code === 'DUPLICATE' || code === 'BUSY') return '已有規劃正在進行，或剛完成一次嘗試。請稍候片刻再重新規劃。'
  if (code === 'DAILY_LIMIT' || code === 'RATE_LIMIT') return error?.retryAfterMs > 0
    ? `AI 請求太頻繁，請約 ${Math.ceil(error.retryAfterMs / 1000)} 秒後再試。`
    : '今天的 AI 規劃額度暫時用完，請稍後或明天再試。'
  if (code === 'AI_UNAVAILABLE') return 'AI 目前比較忙，請稍後再試。'
  if (code === 'TIMEOUT' || code === 'NETWORK') return 'AI 連線逾時或網路暫時無法使用，請檢查連線後再試。'
  if (error?.name === 'AbortError') return '規劃已取消。'
  return 'AI 暫時無法完成這次規劃，請稍後再試或縮短旅程天數。'
}
