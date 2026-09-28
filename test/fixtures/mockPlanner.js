import { clone } from '../../src/data/mockData.js'
import { answerText, travelerCount, travelStyle } from '../../src/services/profile.js'
import { addDays, inclusiveDays, tripFormError } from '../../src/services/tripDates.js'

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

const spots = [
  ['09:30', '城市散步與早餐', '用舒服的速度認識街區', '美食'],
  ['11:30', '在地文化景點', '保留足夠時間慢慢參觀', '文化'],
  ['13:30', '午餐與休息', '依旅行偏好挑選餐廳', '美食'],
  ['15:30', '特色小店與咖啡', '穿插自由探索時間', '咖啡'],
  ['18:30', '晚餐與自由時間', '留一點時間給臨時發現', '美食'],
]

export const plannerSteps = ['正在整理你的旅行偏好', '正在排列示範景點', '正在建立交通段範例', '正在調整每天行程節奏', '完成']

export const aiPlanner = {
  async generateTrip(form, profile, onProgress) {
    const error = tripFormError(form)
    if (error) throw new Error(error)
    if (form.destination.includes('失敗')) throw new Error('示範規劃暫時失敗，請重試。')
    for (let index = 0; index < plannerSteps.length; index += 1) {
      onProgress?.(index, plannerSteps[index])
      await wait(index === plannerSteps.length - 1 ? 320 : 650)
    }
    const dayCount = form.dateUnknown ? form.days : inclusiveDays(form.startDate, form.endDate)
    const days = Array.from({ length: dayCount }, (_, dayIndex) => ({
      id: `day-${dayIndex + 1}`,
      label: `Day ${dayIndex + 1}`,
      date: form.dateUnknown ? '' : addDays(form.startDate, dayIndex),
      spots: spots.slice(0, dayIndex % 2 ? 4 : 5).map((spot, spotIndex) => ({
        id: `spot-${dayIndex + 1}-${spotIndex + 1}`,
        time: spot[0],
        title: spotIndex === 0 && form.places?.[dayIndex] ? form.places[dayIndex] : spot[1],
        detail: spot[2],
        category: spotIndex === 0 && form.places?.[dayIndex] ? '指定地點' : spot[3],
        location: `${form.destination}・示範地點`,
        favorite: false,
        transportMode: spotIndex % 2 ? '步行' : '公車',
        transportMinutes: 8 + spotIndex * 5,
      })),
    }))
    return clone({
      id: `trip-${Date.now()}`,
      title: `${form.destination} ${dayCount} 日示範行程`,
      destination: form.destination,
      startDate: form.dateUnknown ? '' : form.startDate,
      endDate: form.dateUnknown ? '' : form.endDate,
      dateUnknown: Boolean(form.dateUnknown),
      profileId: profile?.id || null,
      travelerCount: travelerCount(profile),
      style: travelStyle(profile),
      budget: answerText(profile?.answers?.budget) || '未設定',
      isDemo: true,
      createdAt: new Date().toISOString(),
      days,
    })
  },
}
