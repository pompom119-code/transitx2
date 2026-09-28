import { ApiError } from '../core.js'
import { assertContract, draftSchema, validateDraft } from '../../src/services/ai/contracts.js'
import { resolveDraft } from '../../src/services/ai/resolvers.js'
import OpenCC from 'opencc-js'

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' })
const normalize = value => toSimplified(String(value || '').normalize('NFKC').replace(/臺/g, '台').replace(/[（(][^）)]*[）)]/g, '')).replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
const sameName = (a, b) => Boolean(a && b && normalize(a) === normalize(b))
const recordNames = record => [record.name, ...Object.entries(record.namedetails || {}).filter(([key]) => key === 'name' || key.startsWith('name:')).map(([, value]) => value)].filter(Boolean).flatMap(value => value.split('/'))
const recordMatches = (record, name) => recordNames(record).some(value => sameName(value, name))
const regionMatches = (record, destination) => recordNames(record).some(value => sameName(value, destination) ||
  sameName(value.replace(/[市區县縣省都府州]$/u, ''), destination))
const isTransportRecord = record => ['station', 'stop', 'bus_stop', 'platform', 'subway_entrance', 'tram_stop', 'proposed'].includes(record.type)
const isRegion = record => ['administrative', 'city', 'town', 'suburb', 'village', 'county', 'municipality'].includes(record.type)
const cache = new Map()
let nextRequestAt = 0
let queue = Promise.resolve()
async function nominatim(query, fetcher, signal) {
  const key = String(query).normalize('NFKC').trim().toLowerCase()
  if (cache.has(key)) return cache.get(key)
  const run = async () => {
    const delay = Math.max(0, nextRequestAt - Date.now())
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    nextRequestAt = Date.now() + 1100
    const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', namedetails: '1', limit: '8', 'accept-language': 'zh-TW' })
    const response = await fetcher(url, { signal, headers: { 'User-Agent': 'TransitX/2.0 (local prototype; place verification)', 'Accept-Language': 'zh-TW' } })
    if (!response.ok) throw new ApiError('PLACE_PROVIDER', '景點資料來源暫時無法查詢。', 503)
    const data = await response.json()
    if (!Array.isArray(data)) throw new ApiError('PLACE_PROVIDER', '景點資料格式錯誤。', 503)
    cache.set(key, data)
    return data
  }
  const result = queue.then(run, run)
  queue = result.then(() => {}, () => {})
  return result
}
const country = record => record.address?.country_code?.toUpperCase() || ''
const lat = record => Number(record.lat)
const lon = record => Number(record.lon)
const distanceKm = (a, b) => {
  const radians = x => x * Math.PI / 180
  const dLat = radians(lat(b) - lat(a)), dLon = radians(lon(b) - lon(a))
  return 6371 * 2 * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat(a))) * Math.cos(radians(lat(b))) * Math.sin(dLon / 2) ** 2))
}
const radiusKm = region => /區$|鎮$|鄉$|村$/.test(region.name || '') || ['town', 'suburb', 'village'].includes(region.type) ? 15 : 45
export function createPlaceResolver(fetcher = fetch) {
  return {
    async resolveDestination(destination, signal) {
      const results = await nominatim(destination, fetcher, signal)
      const regionCandidates = results.filter(value => isRegion(value) && regionMatches(value, destination))
      const exactRegion = regionCandidates.find(value => value.type === 'administrative') || regionCandidates.find(value => value.type === 'city') || regionCandidates[0]
      if (exactRegion) return exactRegion
      // Generic administrative suffixes avoid mistaking a station or a same-name
      // village in another country for a Chinese-language city/district.
      if (/^[\p{Script=Han}]{2,8}$/u.test(destination) && !/[市區县縣乡鄉鎮町村]$/.test(destination)) {
        for (const suffix of ['市', '區', '縣']) {
          const expanded = `${destination}${suffix}`
          const scoped = await nominatim(expanded, fetcher, signal)
          const region = scoped.find(value => isRegion(value) && recordMatches(value, expanded))
          if (region) return region
        }
      }
      const exact = results.filter(value => recordMatches(value, destination) && !isTransportRecord(value))
      if (exact.length === 1) return exact[0]
      throw new ApiError('DESTINATION_AMBIGUOUS', '找不到明確的目的地，請輸入城市或地區名稱。', 422)
    },
    async resolvePlace(item, destination, destinationRecord, signal) {
      let initial
      try { initial = await nominatim(item.name, fetcher, signal) }
      catch { throw new ApiError('PLACE_PROVIDER', '景點資料來源暫時無法查詢。', 503) }
      const radius = radiusKm(destinationRecord)
      let named = initial.filter(value => !isTransportRecord(value) && recordMatches(value, item.name))
      let local = named.find(value => country(value) === country(destinationRecord) && distanceKm(value, destinationRecord) <= radius)
      if (!local) {
        try {
          const scoped = await nominatim(`${item.name}, ${destination}`, fetcher, signal)
          named = [...named, ...scoped.filter(value => !isTransportRecord(value) && recordMatches(value, item.name))]
          local = named.find(value => country(value) === country(destinationRecord) && distanceKm(value, destinationRecord) <= radius)
        } catch { throw new ApiError('PLACE_PROVIDER', '景點資料來源暫時無法查詢。', 503) }
      }
      if (!local) {
        const aliases = [...new Set(initial.filter(value => recordMatches(value, item.name)).flatMap(value =>
          [value.namedetails?.['name:en'], value.namedetails?.['name:ja']].filter(Boolean)))].filter(value => !sameName(value, item.name)).slice(0, 2)
        for (const alias of aliases) {
          const alternative = await nominatim(alias, fetcher, signal)
          named.push(...alternative.filter(value => !isTransportRecord(value) && recordMatches(value, item.name)))
          local = named.find(value => country(value) === country(destinationRecord) && distanceKm(value, destinationRecord) <= radius)
          if (local) break
        }
      }
      if (local) return { ...item, verificationStatus: 'verified', address: local.display_name,
        coordinates: { latitude: lat(local), longitude: lon(local) }, source: 'OpenStreetMap / Nominatim', osmId: String(local.osm_id || '') }
      if (named.length && named.every(value => country(value) !== country(destinationRecord) || distanceKm(value, destinationRecord) > radius)) {
        throw new ApiError('GEOGRAPHY', `「${item.name}」不在「${destination}」附近，未儲存行程。`, 422)
      }
      return { ...item, verificationStatus: 'pending', address: null, coordinates: null, source: null }
    },
    async searchPlaces(query, destination, signal) { return nominatim(`${query} ${destination}`, fetcher, signal) },
  }
}

export async function verifyAndResolve(draft, request, resolver = createPlaceResolver(), signal) {
  assertContract(draft, draftSchema)
  validateDraft(draft, request)
  const region = await resolver.resolveDestination(request.destination, signal)
  const resolved = await resolveDraft(draft, { places: {
    resolvePlace: (item, destination) => resolver.resolvePlace(item, destination, region, signal),
  } })
  for (const day of resolved.days) for (const item of day.items) {
    if (item.type === 'poi' && item.verificationStatus !== 'verified' && !request.mustVisitPlaces.some(place => sameName(place, item.name))) {
      throw new ApiError('PLACE_UNVERIFIED', `「${item.name}」無法從地點資料確認，未儲存行程。`, 422)
    }
  }
  const verifiedNames = resolved.days.flatMap(day => day.items.filter(item => item.type === 'poi' && item.verificationStatus === 'verified').map(item => item.name))
  const checkedAreas = new Set()
  for (const day of resolved.days) for (const item of day.items) {
    if (item.type !== 'food' || checkedAreas.has(normalize(item.area))) continue
    checkedAreas.add(normalize(item.area))
    if (normalize(item.area) === normalize(request.destination) || verifiedNames.some(name => normalize(name) === normalize(item.area))) continue
    const area = await resolver.resolvePlace({ name: item.area }, request.destination, region, signal)
    if (area.verificationStatus !== 'verified') throw new ApiError('FOOD_AREA_UNVERIFIED', `「${item.area}」用餐區域無法確認，未儲存行程。`, 422)
  }
  return resolved
}
