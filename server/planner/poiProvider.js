import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { ApiError } from '../core.js'
import { createPlaceResolver } from '../ai/places.js'
import { resolveCachedRegion } from './regionCache.js'
import { distanceKm, normalizedName } from '../../src/services/planner/geo.js'

const ENDPOINT = 'https://overpass-api.de/api/interpreter'
const CACHE_DIR = resolve(process.cwd(), '.cache', 'planner-poi')
const TTL = 7 * 86400000
const memory = new Map()
const pending = new Map()
const categoryOf = tags => {
  if (tags.tourism === 'museum') return 'museum'
  if (tags.tourism === 'viewpoint') return 'viewpoint'
  if (tags.tourism === 'gallery') return 'gallery'
  if (tags.tourism === 'artwork') return 'artwork'
  if (tags.tourism === 'theme_park') return 'theme_park'
  if (tags.tourism === 'zoo') return 'zoo'
  if (tags.historic) return 'historic'
  if (tags.leisure === 'park') return 'park'
  if (tags.leisure === 'garden') return 'garden'
  if (tags.natural) return 'natural'
  if (tags.amenity === 'marketplace') return 'marketplace'
  if (tags.amenity === 'arts_centre') return 'arts_centre'
  if (tags.amenity === 'theatre') return 'theatre'
  if (tags.shop === 'mall') return 'mall'
  if (tags.highway === 'pedestrian') return 'pedestrian'
  if (tags.amenity === 'cafe') return 'cafe'
  if (['restaurant','fast_food','food_court'].includes(tags.amenity)) return 'restaurant'
  return 'attraction'
}
const foodCategories = new Set(['restaurant','cafe'])
const nameOf = tags => tags['name:zh-TW'] || tags['name:zh'] || tags.name || tags['name:en'] || tags['name:ja'] || ''
const isUsable = element => {
  const tags = element.tags || {}
  const latitude = Number(element.lat ?? element.center?.lat), longitude = Number(element.lon ?? element.center?.lon)
  return Boolean(nameOf(tags)) && Number.isFinite(latitude) && Number.isFinite(longitude) && tags.access !== 'private' && tags.disused !== 'yes' && tags.abandoned !== 'yes'
}
function toPoi(element) {
  const tags = element.tags || {}
  return {
    id: `osm:${element.type}:${element.id}`, name: nameOf(tags), category: categoryOf(tags),
    latitude: Number(element.lat ?? element.center?.lat), longitude: Number(element.lon ?? element.center?.lon),
    source: 'OpenStreetMap / Overpass', tags,
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || undefined,
    openingHours: tags.opening_hours || undefined, website: tags.website || tags['contact:website'] || undefined,
  }
}
function query(lat, lon, radius) {
  const around = `(around:${Math.round(radius)},${Number(lat).toFixed(5)},${Number(lon).toFixed(5)})`
  return `[out:json][timeout:35];(
    nwr["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|theme_park|zoo)$"][name]${around};
    nwr["historic"][name]${around};
    nwr["leisure"~"^(park|garden|nature_reserve)$"][name]${around};
    nwr["natural"~"^(beach|peak|waterfall|spring)$"][name]${around};
    nwr["amenity"~"^(marketplace|arts_centre|theatre|restaurant|cafe|fast_food|food_court)$"][name]${around};
    nwr["shop"="mall"][name]${around};
    way["highway"="pedestrian"][name]${around};
  );out center 1200;`
}
function prune(elements, center, radiusKm) {
  const byName = new Map()
  for (const element of elements) {
    if (!isUsable(element)) continue
    const poi = toPoi(element)
    if (distanceKm(poi, center) > radiusKm + 1) continue
    const key = `${normalizedName(poi.name)}:${poi.category}:${Math.round(poi.latitude * 400)}:${Math.round(poi.longitude * 400)}`
    const prior = byName.get(key)
    if (!prior || Object.keys(poi.tags).length > Object.keys(prior.tags).length) byName.set(key, poi)
  }
  return [...byName.values()]
}
function radiusFor(record) {
  const name = record.name || ''
  if (/區$|鎮$|鄉$|町$|村$/.test(name) || ['town','suburb','village'].includes(record.type)) return 8000
  return 16000
}
async function cached(key, loader) {
  const fresh = memory.get(key)
  if (fresh && Date.now() - fresh.savedAt < TTL) return { ...fresh, cache: 'memory' }
  if (pending.has(key)) return pending.get(key)
  const task = (async () => {
    const path = resolve(CACHE_DIR, createHash('sha256').update(key).digest('hex') + '.json')
    let disk
    try { disk = JSON.parse(await readFile(path, 'utf8')) } catch { /* Empty cache. */ }
    if (disk && Date.now() - disk.savedAt < TTL) { memory.set(key, disk); return { ...disk, cache: 'disk' } }
    try {
      const value = { savedAt: Date.now(), pois: await loader() }
      memory.set(key, value)
      await mkdir(CACHE_DIR, { recursive: true }).then(() => writeFile(path, JSON.stringify(value), 'utf8')).catch(() => {})
      return { ...value, cache: 'network' }
    } catch (error) {
      if (disk?.pois?.length) { memory.set(key, disk); return { ...disk, cache: 'stale-disk' } }
      throw error
    }
  })().finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}
export function createOverpassPoiProvider(fetcher = fetch, resolver = createPlaceResolver(fetcher)) {
  return {
    async searchPOIs(destination, categories = [], signal) {
      const region = typeof destination === 'string' ? await resolveCachedRegion(destination, resolver, signal) : destination
      const center = { latitude: Number(region.lat), longitude: Number(region.lon) }
      if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) throw new ApiError('DESTINATION_AMBIGUOUS', '找不到這個目的地的座標。', 422)
      const radius = radiusFor(region)
      const key = `${Number(region.osm_id) || normalizedName(region.display_name)}:${radius}:v2`
      const result = await cached(key, async () => {
        let response
        try { response = await fetcher(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TransitX/2.0 (local itinerary planner; OSM attribution in app)' }, body: new URLSearchParams({ data: query(center.latitude, center.longitude, radius) }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000) }) }
        catch (error) { throw new ApiError(error?.name === 'TimeoutError' ? 'POI_TIMEOUT' : 'POI_PROVIDER', '地點資料暫時無法取得，請稍後重試。', 503) }
        if (!response.ok) throw new ApiError('POI_PROVIDER', `地點資料服務暫時無法使用（HTTP ${response.status}）。`, 503)
        let data
        try { data = await response.json() } catch { throw new ApiError('POI_PROVIDER', '地點資料格式錯誤。', 503) }
        if (!Array.isArray(data.elements)) throw new ApiError('POI_PROVIDER', '地點資料格式錯誤。', 503)
        return prune(data.elements, center, radius / 1000)
      })
      const pois = categories.length ? result.pois.filter(poi => categories.includes(poi.category)) : result.pois
      return { region, center, radiusKm: radius / 1000, pois, cache: result.cache, fetchedAt: new Date(result.savedAt).toISOString() }
    },
    async searchFoodAreas(destination, signal) {
      const result = await this.searchPOIs(destination, [], signal)
      return result.pois.filter(poi => foodCategories.has(poi.category) || poi.category === 'marketplace')
    },
    async resolvePlace(name, destination, region, signal) {
      const result = await resolver.resolvePlace({ name }, destination, region, signal)
      if (result.verificationStatus !== 'verified' || !result.coordinates) return null
      return { id: result.osmId ? `osm:resolved:${result.osmId}` : `osm:resolved:${normalizedName(name)}`, name, category: 'attraction', latitude: result.coordinates.latitude, longitude: result.coordinates.longitude, source: result.source, tags: {}, address: result.address, mustVisit: true }
    },
    async getPOIDetails(id, destination, signal) {
      const result = await this.searchPOIs(destination, [], signal)
      return result.pois.find(poi => poi.id === id) || null
    },
  }
}
