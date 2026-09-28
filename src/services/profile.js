export function answerText(value, fallback = '未設定') {
  if (typeof value === 'string') return value || fallback
  if (Array.isArray(value)) return value.join('、') || fallback
  if (value && typeof value === 'object') {
    return [...(Array.isArray(value.selected) ? value.selected : []), value.text].filter(Boolean).join('、') || fallback
  }
  return fallback
}

export function travelerCount(profile) {
  const companion = answerText(profile?.answers?.companions, '朋友')
  return companion === '自己' ? 1 : companion === '情侶' ? 2 : companion === '家人' ? 4 : 3
}

export function travelStyle(profile) {
  return answerText(profile?.answers?.exploration, '旅行探索')
}

export function isPresetProfile(profile) {
  return profile?.preset === true || ['friends', 'couple', 'solo', 'family'].includes(profile?.id)
}

export function profileSummary(answers = {}) {
  return [answerText(answers.companions, ''), answerText(answers.interests, ''), answerText(answers.walking, ''), answerText(answers.budget, '')].filter(Boolean).join('・') || '依你的回答建立專屬旅行偏好'
}
