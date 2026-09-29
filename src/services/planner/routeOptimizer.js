import { distanceKm } from './geo.js'

const length = points => points.slice(1).reduce((sum, point, index) => sum + distanceKm(points[index], point), 0)
export function optimizeRoute(points, start) {
  if (points.length < 2) return [...points]
  const remaining = [...points], route = []
  let cursor = start || remaining[0]
  while (remaining.length) {
    let best = 0
    for (let i = 1; i < remaining.length; i++) if (distanceKm(cursor, remaining[i]) < distanceKm(cursor, remaining[best])) best = i
    cursor = remaining.splice(best, 1)[0]
    route.push(cursor)
  }
  // Open-path 2-opt: never invent a road or transit route; optimize straight-line order only.
  let improved = true, passes = 0
  while (improved && passes++ < 8) {
    improved = false
    for (let i = 0; i < route.length - 2; i++) for (let j = i + 2; j < route.length; j++) {
      const candidate = [...route.slice(0, i + 1), ...route.slice(i + 1, j + 1).reverse(), ...route.slice(j + 1)]
      if (length(candidate) + .001 < length(route)) { route.splice(0, route.length, ...candidate); improved = true }
    }
  }
  return route
}

export function clusterByDay(pois, days, center) {
  if (days <= 1) return [pois]
  const seeds = [pois.find(item => item.mustVisit) || pois[0]]
  while (seeds.length < days) {
    // `pois` arrives in score order. Choose a strong, geographically distinct
    // anchor for each day; farthest-point seeding overweights weak suburbs.
    const available = pois.slice(0,Math.max(80,days*28)).filter(item => !seeds.includes(item))
    if (!available.length) break
    seeds.push(available.find(item=>Math.min(...seeds.map(seed=>distanceKm(seed,item)))>=2.5) || available[0])
  }
  const groups = seeds.map(seed => [seed])
  for (const poi of pois) {
    if (seeds.includes(poi)) continue
    let best = 0
    for (let i = 1; i < seeds.length; i++) if (distanceKm(poi, seeds[i]) < distanceKm(poi, seeds[best])) best = i
    groups[best].push(poi)
  }
  groups.sort((a,b)=>distanceKm(a[0],center)-distanceKm(b[0],center))
  return groups
}
