export class ApiError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status }
}
export async function requestJson(url, options = {}, fetcher = fetch, timeout = 20000) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout)
  try {
    const response = await fetcher(url, { ...options, signal })
    if (!response.ok) {
      const status = response.status
      throw new ApiError(status === 429 ? 'RATE_LIMIT' : status === 401 || status === 403 ? 'AUTH' : 'UPSTREAM',
        status === 429 ? '服務額度或請求頻率已達上限，請稍後再試。' : status === 401 || status === 403 ? '服務憑證或存取權限無效，請檢查伺服器設定。' : '資料服務暫時無法使用，請稍後再試。', status === 429 ? 429 : 502)
    }
    try { return await response.json() } catch { throw new ApiError('INVALID_JSON', '服務回傳格式不正確。') }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (options.signal?.aborted) throw new ApiError('CANCELLED', '操作已取消。', 499)
    throw new ApiError(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK', '連線逾時或網路無法使用，請重試。', 504)
  }
}
export class Cache {
  values = new Map()
  pending = new Map()
  async get(key, ttl, loader, force = false) {
    const entry = this.values.get(key)
    if (!force && entry && entry.expires > Date.now()) return entry.value
    if (this.pending.has(key)) return this.pending.get(key)
    const task = Promise.resolve().then(loader).then(value => {
      if (this.values.size >= 500) this.values.delete(this.values.keys().next().value)
      this.values.set(key, { value, expires: Date.now() + ttl })
      return value
    }).finally(() => this.pending.delete(key))
    this.pending.set(key, task)
    return task
  }
}

