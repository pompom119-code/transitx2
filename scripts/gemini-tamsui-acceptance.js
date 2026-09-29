import { loadEnv } from 'vite'
import { createPlanner } from '../server/ai/planner.js'

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
if (!env.GEMINI_API_KEY || env.GEMINI_FREE_TIER_CONFIRMED !== 'true') {
  console.error('AI key 或 Free Tier 確認未設定；未執行真實測試。')
  process.exitCode = 2
} else {
  const form = { destination: '淡水', days: 1, startDate: '2026-10-01', endDate: '2026-10-01', dateUnknown: false,
    places: [], optionalNotes: '', travelerCount: 2 }
  const profile = { id: 'live-friends', answers: { companions: '朋友', interests: ['美食', '拍照'],
    exploration: '探索派', transport: ['公車', '步行'], walking: '普通', budget: '中等', pace: '輕鬆',
    notes: { selected: [], text: '' } } }
  const started = performance.now()
  try {
    const trip = await createPlanner(env)({ operation: 'generate', form, profile },
      event => console.info(`PROGRESS=${event.step} ${event.label || ''}`), AbortSignal.timeout(180000))
    const first = trip.days?.[0]
    console.info(`PASS MS=${Math.round(performance.now() - started)} DESTINATION=${trip.destination} DAYS=${trip.days?.length} DATE=${first?.date} TRAVELERS=${trip.travelerCount} SOURCE=${trip.source || 'AI'}`)
    console.info(`PLACES=${first?.spots?.filter(item => item.type === 'poi').map(item => item.title).join('、') || ''}`)
  } catch (error) {
    console.error(`FAIL MS=${Math.round(performance.now() - started)} CODE=${error.code || error.name || 'ERROR'} MESSAGE=${String(error.message || '').replaceAll(env.GEMINI_API_KEY, '[redacted]').slice(0, 240)}`)
    process.exitCode = 1
  }
}
