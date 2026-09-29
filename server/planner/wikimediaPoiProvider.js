import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { ApiError } from '../core.js'
import { createPlaceResolver } from '../ai/places.js'
import { resolveCachedRegion } from './regionCache.js'
import { distanceKm, normalizedName, insideGeometry } from '../../src/services/planner/geo.js'

const CACHE_DIR = resolve(process.cwd(),'.cache','planner-wikimedia')
const TTL = 7 * 86400000
const memory = new Map(), pending = new Map()
const header = {'User-Agent':'TransitX/2.0 (https://github.com/pompom119-code/transitx2) Node.js'}
const excludedType = /^(?:city|adm|country|state|edu|railwaystation|airport|event|camera|satellite)$/i
const excludedTitle = /(?:站|駅|機場|空港|學校|学校|小學|小学|中學|中学校|大学|大學|國小|國中|高中|高校|学園|行政區|區公所|市政府|地震|颱風|事故|大火|道路|公路|国道|高速公路|鐵路線|鉄道線|人物|足球俱樂部|棒球隊|醫院|医院|病院|墓|墓園|墓葬|墳|亂葬崗|宿舍區|垃圾掩埋場|警察局|警察署|大樓|辦公樓|總部|機廠|Building|Headquarters|Foundation|Corporation|Office Tower|Cemetery|Graveyard|Hospital|Police Department)$/iu
const excludedCategory = /(?:鐵路車站|鉄道駅|小學|小学|中學|中学|高級中學|高等学校|大学|大學|學校|学校|病院|Hospitals|墓葬|公墓|火災|事故|案件|行政區劃|村里|公司|企業|超高層ビル|オフィスビル|Office buildings|Skyscrapers)/iu
let nextRequestAt=0
let requestQueue=Promise.resolve()
async function wikiRequest(url,fetcher,signal) {
  const run=async()=>{
    for(let attempt=0;attempt<3;attempt++){
      const delay=Math.max(0,nextRequestAt-Date.now())
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay))
      nextRequestAt=Date.now()+400
      let response
      try{response=await fetcher(url,{headers:header,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})}
      catch(error){if(attempt===2)throw new ApiError(error?.name==='TimeoutError'?'POI_TIMEOUT':'POI_PROVIDER','Wikipedia 地點資料暫時無法取得。',503);continue}
      if(response.status===429||response.status===503){
        if(attempt===2)throw new ApiError('POI_PROVIDER',`Wikipedia 地點資料暫時無法取得（HTTP ${response.status}）。`,503)
        const retry=Number(response.headers.get('retry-after'))
        const pause=Number.isFinite(retry)&&retry>0?Math.min(15000,retry*1000):5000*(attempt+1)
        nextRequestAt=Date.now()+pause
        continue
      }
      if(!response.ok)throw new ApiError('POI_PROVIDER',`Wikipedia 地點資料暫時無法取得（HTTP ${response.status}）。`,503)
      const data=await response.json().catch(()=>null)
      if(!data)throw new ApiError('POI_PROVIDER','Wikipedia 地點資料格式錯誤。',503)
      return data
    }
  }
  const task=requestQueue.then(run,run)
  requestQueue=task.then(()=>{},()=>{})
  return task
}
function categoryOf(item, categories = []) {
  const name = item.title || ''
  const type = item.type || ''
  const meta = categories.join(' ')
  if (/museum/i.test(type) || /博物館|美術館|資料館|記念館|紀念館|ミュージアム|博物馆|Museum|Gallery/i.test(name) || /(?:^|｜)[^｜]*(?:博物館|美術館|博物馆)群?(?:｜|$)/.test(meta)) return 'museum'
  if (/park/i.test(type) || /公園|公园|庭園|植物園|\bPark\b|\bGarden\b(?!\s+(?:Theatre|Theater))/i.test(name) || /(?:区|市|県|府|縣)の公園|日本の植物園|自然公園/.test(meta)) return 'park'
  if (/海灘|沙灘|瀑布|山峰|海岸|自然保護|Beach|Waterfall|Peak/i.test(name)) return 'natural'
  if (/展望|觀景|眺望|碼頭|Viewpoint|Observation|Wharf/i.test(name)) return 'viewpoint'
  if (/市場|市集|商店街|老街|商圈|Market|Old Street/i.test(name)) return 'marketplace'
  if (/故居|古蹟|古跡|史蹟|歷史|城$|城堡|城跡|砲台|礮臺|寺$|寺\s*\(|寺（|寺院|神社|廟|教堂|舊居|古厝|遺址|Fort|Castle|Temple|Shrine|Church/i.test(name) || /古蹟|文化資產|重要文化財|史跡|Historic/.test(meta)) return 'historic'
  if (/藝術|艺术|美術|\bArt\b|Gallery/i.test(name)) return 'gallery'
  if (/劇場|劇院|シアター|劇場|\bTheat(?:re|er)\b|\bConcert Hall\b/i.test(name)) return 'theatre'
  if (/步道|散策|遊歩道|Trail|Walk/i.test(name)) return 'pedestrian'
  return 'attraction'
}
function usable(item,center,radiusKm,bbox,geometry) {
  if (!item?.pageid || !item.title || !Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return false
  if (excludedType.test(item.type || '') || excludedTitle.test(item.title)) return false
  if (distanceKm({latitude:item.lat,longitude:item.lon},center)>radiusKm + 1) return false
  const inArea=insideGeometry({latitude:item.lat,longitude:item.lon},geometry)
  if (inArea===false) return false
  if (bbox && (item.lat < bbox[0]-.002 || item.lat > bbox[1]+.002 || item.lon < bbox[2]-.002 || item.lon > bbox[3]+.002)) return false
  return true
}
function toPoi(item, language, categories = []) {
  const url = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g,'_'))}`
  const named=categories.map(value=>value.replace(/^Category:/,''))
  const importance=(/國定古蹟|国宝|國寶|世界遺產|世界遺産|名勝|觀光景點|旅游景点|旅遊景點|史跡|文化財/.test(named.join(' '))?26:0)+(/市定古蹟|歷史建築|文化資產|古迹|景勝/.test(named.join(' '))?12:0)+(/landmark|museum|park/i.test(item.type||'')?8:0)
  return {id:`wikipedia:${language}:${item.pageid}`,name:item.title,category:categoryOf(item,named),latitude:Number(item.lat),longitude:Number(item.lon),source:'Wikipedia / GeoData',tags:{name:item.title,wikipedia:url,wikiType:item.type||'',categories:named.join('｜')},popularity:importance,website:url}
}
function radiusFor(record) { return /區$|鎮$|鄉$|町$|村$/.test(record.name||'') || ['town','suburb','village'].includes(record.type) ? 8 : 16 }
async function categoriesFor(language,items,fetcher,signal) {
  const result=new Map()
  for(let offset=0;offset<items.length;offset+=30){
    const batch=items.slice(offset,offset+30)
    let continuation={}
    for(let pass=0;pass<3;pass++){
      const url=new URL(`https://${language}.wikipedia.org/w/api.php`)
      url.search=new URLSearchParams({action:'query',prop:'categories',pageids:batch.map(item=>item.pageid).join('|'),cllimit:'500',clshow:'!hidden',format:'json',...continuation}).toString()
      let data
      try{data=await wikiRequest(url,fetcher,signal)}catch{break}
      if(!data?.query?.pages)break
      for(const page of Object.values(data.query.pages))result.set(page.pageid,[...(result.get(page.pageid)||[]),...(page.categories||[]).map(category=>category.title)])
      if(!data.continue?.clcontinue)break
      continuation=data.continue
    }
  }
  return result
}
async function searchWiki(language,center,radiusKm,bbox,geometry,fetcher,signal) {
  // Dense urban Wikipedia coordinates are truncated by the GeoSearch result cap.
  // A small grid queries *near each neighbourhood* rather than taking only the
  // nearest articles to city hall; it is geographic sampling, not a city list.
  const km=radiusKm<=8?Math.min(radiusKm,4):4.5
  const latitudeStep = (radiusKm<=8?2.5:4.5)/111
  const longitudeStep = (radiusKm<=8?2.5:4.5)/(111*Math.max(.25,Math.cos(center.latitude*Math.PI/180)))
  const offsets=radiusKm<=8?[[0,0],[1,0],[-1,0],[0,1],[0,-1]]:[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
  const coords=offsets.map(([north,east])=>[center.latitude+north*latitudeStep,center.longitude+east*longitudeStep])
  const groups=[]
  for (const [lat,lon] of coords) {
    const url=new URL(`https://${language}.wikipedia.org/w/api.php`)
    url.search=new URLSearchParams({action:'query',list:'geosearch',gscoord:`${lat.toFixed(5)}|${lon.toFixed(5)}`,gsradius:String(Math.round(km*1000)),gslimit:radiusKm<=8?'150':'500',gsprop:'type|country',format:'json'}).toString()
    const data=await wikiRequest(url,fetcher,signal)
    if(!Array.isArray(data?.query?.geosearch))throw new ApiError('POI_PROVIDER','Wikipedia 地點資料格式錯誤。',503)
    groups.push(data.query.geosearch)
  }
  const results=[]
  for(let index=0;index<(radiusKm<=8?150:500);index++)for(const group of groups)if(group[index])results.push(group[index])
  const filtered=[...new Map(results.map(item=>[item.pageid,item])).values()].filter(item=>usable(item,center,radiusKm,bbox,geometry)).slice(0,1800)
  const categories=await categoriesFor(language,filtered,fetcher,signal)
  return filtered.filter(item=>{
    const meta=(categories.get(item.pageid)||[]).join(' ')
    if(/墓地|埋葬|墓葬|公墓|Cemeteries|Burials/i.test(meta))return false
    if(/タワー|Tower|ビル|Building/i.test(item.title) && !/觀光|観光|名所|ランドマーク|史跡|文化財|古蹟|tourist attraction|landmark/i.test(meta))return false
    return !excludedCategory.test(meta) || /國定古蹟|市定古蹟|文化資產|史跡/.test(meta)
  })
    .map(item=>toPoi(item,language,categories.get(item.pageid)||[]))
}
async function cached(key, loader) {
  const existing=memory.get(key)
  if(existing&&Date.now()-existing.savedAt<TTL)return {...existing,cache:'memory'}
  if(pending.has(key))return pending.get(key)
  const task=(async()=>{
    const path=resolve(CACHE_DIR,createHash('sha256').update(key).digest('hex')+'.json')
    let disk
    try{disk=JSON.parse(await readFile(path,'utf8'))}catch{/* no prior cache */}
    if(disk&&Date.now()-disk.savedAt<TTL){memory.set(key,disk);return {...disk,cache:'disk'}}
    try{const value={savedAt:Date.now(),pois:await loader()};memory.set(key,value);await mkdir(CACHE_DIR,{recursive:true}).then(()=>writeFile(path,JSON.stringify(value),'utf8')).catch(()=>{});return {...value,cache:'network'}}
    catch(error){if(disk?.pois?.length){memory.set(key,disk);return {...disk,cache:'stale-disk'}}throw error}
  })().finally(()=>pending.delete(key))
  pending.set(key,task)
  return task
}
export function createWikimediaPoiProvider(fetcher=fetch,resolver=createPlaceResolver(fetcher)) {
  return {
    async searchPOIs(destination,categories=[],signal) {
      const region=typeof destination==='string'?await resolveCachedRegion(destination,resolver,signal):destination
      const center={latitude:Number(region.lat),longitude:Number(region.lon)}
      if(!Number.isFinite(center.latitude)||!Number.isFinite(center.longitude))throw new ApiError('DESTINATION_AMBIGUOUS','找不到這個目的地的座標。',422)
      const radiusKm=radiusFor(region)
      const language=region.address?.country_code==='jp'?'ja':'zh'
      const bbox=Array.isArray(region.boundingbox)&&region.boundingbox.length===4?region.boundingbox.map(Number):null
      const key=`${normalizedName(region.display_name)}:${radiusKm}:${language}:v8`
      const result=await cached(key,async()=>{
        const primary=await searchWiki(language,center,radiusKm,bbox,region.geojson,fetcher,signal)
        let secondary=[]
        if(primary.length<100 || radiusKm<=8)try{secondary=await searchWiki('en',center,radiusKm,bbox,region.geojson,fetcher,signal)}catch{/* Primary verified records remain usable. */}
        const englishAlias=String(region.namedetails?.['name:en']||'').replace(/\b(?:District|City|County|Township|Ward|Prefecture)\b.*/i,'').trim().toLowerCase()
        return [...primary,...secondary.filter(poi=>englishAlias && poi.name.toLowerCase().includes(englishAlias) && !primary.some(item=>item.name===poi.name||distanceKm(item,poi)<.08&&item.category===poi.category))]
      })
      const suitable=result.pois.filter(poi=>!/卸売|卸賣|批發|Wholesale|Distribution Center|野球場|球場|スタジアム|競技場|[一-龥]港$|Police Department/i.test(poi.name) && !excludedTitle.test(poi.name) && (!excludedCategory.test(poi.tags.categories||'') || /國定古蹟|市定古蹟|文化資產|史跡/.test(poi.tags.categories||'')))
        .map(poi=>({...poi,category:categoryOf({title:poi.name,type:poi.tags.wikiType},(poi.tags.categories||'').split('｜'))}))
      const pois=categories.length?suitable.filter(poi=>categories.includes(poi.category)):suitable
      return {region,center,radiusKm,pois,cache:result.cache,fetchedAt:new Date(result.savedAt).toISOString(),provider:'Wikipedia / GeoData'}
    },
    async searchFoodAreas(destination,signal){const result=await this.searchPOIs(destination,[],signal);return result.pois.filter(poi=>poi.category==='marketplace')},
    async resolvePlace(name,destination,region,signal){
      const result=await resolver.resolvePlace({name},destination,region,signal)
      if(result.verificationStatus!=='verified'||!result.coordinates)return null
      return {id:result.osmId?`osm:resolved:${result.osmId}`:`osm:resolved:${normalizedName(name)}`,name,category:'attraction',latitude:result.coordinates.latitude,longitude:result.coordinates.longitude,source:result.source,tags:{name},address:result.address,mustVisit:true}
    },
    async getPOIDetails(id,destination,signal){const result=await this.searchPOIs(destination,[],signal);return result.pois.find(poi=>poi.id===id)||null},
  }
}
