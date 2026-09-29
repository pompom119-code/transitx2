const base = 'http://127.0.0.1:5173'
const body = {
  operation: 'generate',
  form: { destination: '淡水', days: 1, startDate: '2026-10-02', endDate: '2026-10-02', dateUnknown: false,
    places: [], optionalNotes: '', travelerCount: 2 },
  profile: { id: 'endpoint-diagnostic', answers: { companions: '朋友', interests: ['美食', '拍照'],
    exploration: '探索派', transport: ['公車', '步行'], walking: '普通', budget: '中等', pace: '輕鬆',
    notes: { selected: [], text: '' } } },
}
const start = performance.now()
try {
  const response = await fetch(`${base}/api/ai/plan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(205000),
  })
  console.info(`ENDPOINT_HTTP=${response.status}`)
  if (!response.body) throw new Error('No response body')
  let buffer = ''
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let terminal = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line) continue
      const event = JSON.parse(line)
      if (event.type === 'progress') console.info(`PROGRESS=${event.step?.step} ${event.step?.label || ''}`)
      if (event.type === 'error') { console.info(`STREAM_ERROR=${event.code} MESSAGE=${event.message}`); terminal = true; process.exitCode = 1 }
      if (event.type === 'result') {
        console.info(`TRIP_DESTINATION=${event.value?.destination} DAYS=${event.value?.days?.length} SOURCE=${event.value?.source || ''}`)
        terminal = true
      }
    }
  }
  if (!terminal) { console.info('STREAM_INCOMPLETE'); process.exitCode = 1 }
} catch (error) {
  console.info(`ENDPOINT_ERROR=${error.name || 'ERROR'} MESSAGE=${error.message || ''}`)
  process.exitCode = 1
} finally {
  console.info(`ELAPSED_MS=${Math.round(performance.now() - start)}`)
}
