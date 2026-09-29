import { distanceKm } from './geo.js'

const has = (text, pattern) => pattern.test(String(text || ''))
export function interestMatches(poi, interests) {
  const value = String(interests || '')
  const category = poi.category
  const tags = poi.tags || {}
  const matches = []
  if (has(value, /拍照|攝影/) && !/見本市|展示場|展示会場|サーキット|Circuit|Convention Center|Exhibition Center/i.test(poi.name) && (['viewpoint','garden','natural','artwork','gallery','park'].includes(category) || category==='historic' && ((Number(poi.popularity)||0)>=12 || /古蹟|史跡|文化財|文化資產|観光|heritage/i.test(tags.categories||'')))) matches.push('MATCH_PHOTOGRAPHY')
  if (has(value, /美食|咖啡/) && ['marketplace','food_area','cafe'].includes(category)) matches.push('MATCH_FOOD')
  if (has(value, /自然|放鬆|運動/) && ['park','garden','natural','viewpoint'].includes(category)) matches.push('MATCH_NATURE')
  if (has(value, /文化|活動/) && ['museum','historic','gallery','arts_centre','theatre'].includes(category)) matches.push('MATCH_CULTURE')
  if (has(value, /逛街/) && ['marketplace','mall','pedestrian'].includes(category)) matches.push('MATCH_ACTIVITY')
  if (tags.wikidata && has(value, /探索/)) matches.push('CLASSIC_POI')
  return matches
}

export function scorePOI(poi, request, context = {}) {
  const matches = interestMatches(poi, request.interests)
  const tags = poi.tags || {}
  const classic = Boolean((Number(poi.popularity)||0) >= 18 || tags.wikidata || tags.heritage || tags.tourism === 'attraction')
  const local = (['marketplace','pedestrian','artwork','garden'].includes(poi.category) || poi.category === 'historic' && /古蹟|史跡|文化財|文化資產|観光|heritage/i.test(tags.categories||'')) && !classic
  const outdoor = ['park','garden','natural','viewpoint'].includes(poi.category)
  const exploration = String(request.explorationLevel || '')
  const walking = String(request.walkingPreference || '') + String(request.specialRequirements || '')
  const budget = String(request.budget || '') + String(request.specialRequirements || '')
  const pace = String(request.travelPace || '') + String(request.specialRequirements || '')
  const distance = distanceKm(context.anchor || context.center, poi)
  const previous = context.previous || []
  const sameCategory = previous.filter(item => item.category === poi.category).length
  const score = {
    baseScore: poi.category === 'attraction' && (Number(poi.popularity)||0) < 20 ? -15
      : poi.category === 'park' && (Number(poi.popularity)||0) < 12 && !/庭園|植物園|Garden|自然公園|史跡|文化財/i.test(`${poi.name} ${tags.categories||''}`) ? -10 : 5,
    interestScore: Math.min(42, matches.length * 20 + (matches.includes('MATCH_FOOD') && poi.category==='marketplace' ? 14 : 0) + (matches.includes('MATCH_PHOTOGRAPHY') && poi.category==='viewpoint' ? 12 : 0)),
    popularityScore: Math.min(28,(Number(poi.popularity)||0) + (/landmark|museum|park/.test(tags.wikiType||'') ? 8 : classic ? 3 : tags.name ? 2 : 0)),
    explorationScore: /經典/.test(exploration) ? (classic ? 17 : -3) : /在地/.test(exploration) ? (local ? 17 : 0) : /探索/.test(exploration) ? (local ? 12 : classic ? -3 : 5) : /冒險/.test(exploration) ? (outdoor ? 12 : local ? 7 : 0) : 0,
    walkingScore: /少|輕鬆|隨緣|長輩|無障礙/.test(walking) ? -Math.min(32, distance * 7) : /耐走/.test(walking) ? Math.min(5, distance) : -Math.min(7, distance * 1.2),
    budgetScore: /小資|經濟|低預算|省錢/.test(budget) && (tags.fee === 'yes' || ['theme_park','zoo'].includes(poi.category)) ? -18 : 0,
    travelPaceScore: /悠閒|輕鬆|晚起|不要排太滿/.test(pace) && ['museum','theme_park','zoo'].includes(poi.category) ? -4 : /充實/.test(pace) && poi.category === 'artwork' ? 3 : 0,
    distanceScore: Number.isFinite(distance) ? -Math.min(27, distance * 2.3) : 0,
    diversityScore: -Math.min(36, sameCategory * 20),
    mustVisitScore: poi.mustVisit ? 1000 : 0,
  }
  const reasonCodes = poi.mustVisit ? ['MUST_VISIT'] : matches.length ? matches : [/經典/.test(exploration) && classic ? 'CLASSIC_POI' : /在地|探索/.test(exploration) && local ? 'LOCAL_EXPLORATION' : 'NEARBY_CLUSTER']
  return { ...score, totalScore: Object.values(score).reduce((sum, value) => sum + value, 0), reasonCodes }
}
