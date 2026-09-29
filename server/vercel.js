import { createApi } from './api.js'

// One handler for every Vercel Function route. Credentials stay in the
// serverless runtime; they are never exposed through Vite's VITE_ variables.
const api = createApi(process.env)
export default function handler(req, res) {
  return api(req, res, () => {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 'NOT_FOUND', message: '找不到 API。' }))
  })
}
