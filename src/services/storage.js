const STORAGE_KEY = 'transitx.v2.state'

export const storageService = {
  load() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY)
      return value ? JSON.parse(value) : null
    } catch {
      return null
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      return true
    } catch {
      return false
    }
  },
  clear() {
    window.localStorage.removeItem(STORAGE_KEY)
  },
}
