import { busRoutes, busStops } from '../data/mockData.js'

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

export function resolveStop(stopId) {
  const known = busStops.find((item) => item.id === stopId || item.name === stopId)
  if (known) return known
  const name = decodeURIComponent(stopId)
  const routes = busRoutes.filter((route) => route.outbound.includes(name) || route.inbound.includes(name))
  if (!routes.length) return null
  return {
    id: name,
    name,
    area: '示範站牌・未連接即時位置',
    routes: routes.map((route) => route.id),
    nearby: [],
    arrivals: routes.map((route, index) => ({ route: route.id, destination: route.to, minutes: 5 + index * 7 })),
  }
}

export function rankTransitSearch(query, routes = busRoutes, stops = busStops) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return { routes: [], stops: [] }
  const scoreRoute = (route) => {
    const number = route.id.toLocaleLowerCase()
    const label = `${route.from} ${route.to}`.toLocaleLowerCase()
    if (number === normalized) return 100
    if (number.startsWith(normalized)) return 80
    if (route.from.toLocaleLowerCase() === normalized || route.to.toLocaleLowerCase() === normalized) return 70
    if (label.includes(normalized) || route.outbound.some((stop) => stop.toLocaleLowerCase().includes(normalized))) return 30
    return 0
  }
  const scoreStop = (stop) => {
    const name = stop.name.toLocaleLowerCase()
    if (name === normalized) return 100
    if (name.startsWith(normalized)) return 80
    if (name.includes(normalized) || stop.area.toLocaleLowerCase().includes(normalized)) return 40
    if (stop.routes.some((route) => route.toLocaleLowerCase() === normalized)) return 20
    return 0
  }
  return {
    routes: routes.map((route) => ({ route, score: scoreRoute(route) })).filter((item) => item.score).sort((a, b) => b.score - a.score).map((item) => item.route),
    stops: stops.map((stop) => ({ stop, score: scoreStop(stop) })).filter((item) => item.score).sort((a, b) => b.score - a.score).map((item) => item.stop),
  }
}

export const transitService = {
  async search(query = '') {
    await wait(420)
    const normalized = query.trim().toLowerCase()
    if (normalized === 'error') throw new Error('目前無法取得公車資料，請稍後再試。')
    return rankTransitSearch(normalized)
  },
  async refreshStop(stopId) {
    await wait(520)
    const stop = resolveStop(stopId)
    if (!stop) throw new Error('找不到這個示範站牌。')
    return { ...stop, arrivals: stop.arrivals.map((item, index) => ({ ...item, minutes: Math.max(1, item.minutes - (index ? 0 : 1)) })), updatedAt: new Date().toISOString() }
  },
}
