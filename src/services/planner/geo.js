const rad = value => value * Math.PI / 180
export function distanceKm(a, b) {
  if (!a || !b || !Number.isFinite(Number(a.latitude)) || !Number.isFinite(Number(a.longitude)) || !Number.isFinite(Number(b.latitude)) || !Number.isFinite(Number(b.longitude))) return Infinity
  const dLat = rad(Number(b.latitude) - Number(a.latitude))
  const dLon = rad(Number(b.longitude) - Number(a.longitude))
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(a.latitude))) * Math.cos(rad(Number(b.latitude))) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(x)))
}
export function makeRandom(seed) {
  let value = Math.imul(((Number(seed) >>> 0) || 1) ^ 0x9e3779b9, 0x85ebca6b) >>> 0
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return ((value >>> 0) + 0.5) / 4294967296 }
}
export function stableSeed(value) {
  let result = 2166136261
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619)
  return result >>> 0
}
export function normalizedName(value) { return String(value || '').normalize('NFKC').replace(/臺/g, '台').replace(/[\s·・、，,()（）]/g, '').toLocaleLowerCase() }

function inRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export function insideGeometry(point, geometry) {
  if (!geometry || !['Polygon','MultiPolygon'].includes(geometry.type)) return null
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some(rings => rings.length && inRing(point.longitude, point.latitude, rings[0]) && !rings.slice(1).some(ring => inRing(point.longitude, point.latitude, ring)))
}
