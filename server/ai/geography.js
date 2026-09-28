import { ApiError, Cache, requestJson } from '../core.js'
const aliases = { '台北':'Taipei','臺北':'Taipei','東京':'Tokyo','大阪':'Osaka','高雄':'Kaohsiung','首爾':'Seoul' }
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/臺/g,'台').replace(/\s/g,'')
export function distanceKm(a, b) {
  const rad = x => x * Math.PI / 180
  const v = Math.sin(rad(b.latitude-a.latitude)/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2
  return 6371 * 2 * Math.atan2(Math.sqrt(v),Math.sqrt(1-v))
}
export function createGeography(fetcher = fetch) {
  const cache = new Cache()
  return async (destination, signal) => cache.get(destination, 86400000, async () => {
    const name = aliases[destination] || destination
    const data = await requestJson('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({name,count:'10',language:'zh',format:'json'}), {signal}, fetcher)
    const matches = (data.results || []).filter(item => item.feature_code?.startsWith('PPL'))
    const exact = matches.filter(item => [item.name, item.admin1, item.admin2].some(x => x && normalize(x) === normalize(destination)))
    const known = {Taipei:['TW',25.03,121.56],Tokyo:['JP',35.68,139.69],Osaka:['JP',34.69,135.50],Kaohsiung:['TW',22.62,120.30],Seoul:['KR',37.56,126.98]}[name]
    const found = known ? matches.find(x => x.country_code === known[0] && distanceKm(x,{latitude:known[1],longitude:known[2]}) < 50) : exact.length === 1 ? exact[0] : matches.length === 1 ? matches[0] : null
    if (!found) throw new ApiError('DESTINATION_AMBIGUOUS','找不到唯一城市，請輸入明確的城市名稱（例如東京），不要只輸入國家或景點。',422)
    return {name:found.name, aliases:[destination,name,found.name,found.admin1].filter(Boolean), countryCode:found.country_code,latitude:found.latitude,longitude:found.longitude,radiusKm:40}
  })
}
export function validateGeography(place, region) {
  if (!place.name.trim() || !place.address.trim() || !place.reason.trim()) throw new Error('景點名稱、地址與推薦原因不可留白')
  if (place.countryCode.toUpperCase() !== region.countryCode || distanceKm(place,region) > region.radiusKm) throw new Error('景點超出目的地範圍：' + place.name)
  if (!region.aliases.some(alias => normalize(place.city).includes(normalize(alias)) || normalize(place.address).includes(normalize(alias)))) throw new Error('景點城市／地址不符合目的地：' + place.name)
  const forbidden = region.countryCode !== 'TW' ? /台北101|臺北101|西門町|永康街|高雄|Taipei 101/i : region.countryCode !== 'JP' ? /東京塔|大阪城|Tokyo Tower/i : null
  if (forbidden?.test(place.name + place.address)) throw new Error('景點地理資訊矛盾：' + place.name)
}

