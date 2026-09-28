const DAY_MS = 86400000

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

export function addDays(value, count) {
  const date = parseDate(value)
  if (!date) return ''
  return new Date(date.getTime() + count * DAY_MS).toISOString().slice(0, 10)
}

export function inclusiveDays(startDate, endDate) {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (!start || !end || end < start) return 0
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1
}

export function tripFormError(form) {
  if (!form || typeof form.destination !== 'string' || !Number.isInteger(form.days)) return '請確認目的地與旅行天數。'
  if (form.travelerCount != null && (!Number.isInteger(form.travelerCount) || form.travelerCount < 1 || form.travelerCount > 20)) return '請設定 1–20 位同行者。'
  if (!form.destination?.trim() || form.destination.trim().length < 2) return '請輸入至少兩個字的目的地。'
  if (form.dateUnknown) return form.days >= 1 && form.days <= 14 ? '' : '請設定 1–14 天的旅行天數。'
  if (!parseDate(form.startDate) || !parseDate(form.endDate)) return '請選擇出發與回程日期。'
  if (form.endDate < form.startDate) return '回程日期不能早於出發日期。'
  const days = inclusiveDays(form.startDate, form.endDate)
  if (days > 14) return '一次最多規劃 14 天，請縮短日期範圍。'
  if (days !== form.days) return '日期與旅行天數不一致，請重新確認。'
  return ''
}
