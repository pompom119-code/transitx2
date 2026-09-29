/**
 * @typedef {{id:string,name:string,category:string,latitude:number,longitude:number,source:string,tags:Record<string,string>,address?:string,openingHours?:string,website?:string,popularity?:number,mustVisit?:boolean}} POI
 * @typedef {{destination:string,startDate:string,endDate:string,days:number,travelerCount:number,mustVisitPlaces:string[],optionalNotes:string,travelerType:string,interests:string,explorationLevel:string,transportPreference:string,walkingPreference:string,budget:string,travelPace:string,specialRequirements:string}} TripRequest
 * @typedef {{interestScore:number,popularityScore:number,explorationScore:number,walkingScore:number,budgetScore:number,travelPaceScore:number,distanceScore:number,diversityScore:number,mustVisitScore:number,totalScore:number,reasonCodes:string[]}} ScoreBreakdown
 */

export const REASON_TEXT = {
  MUST_VISIT: ['這是你指定想去的地點。'],
  MATCH_PHOTOGRAPHY: ['符合你的拍照偏好。', '這一帶值得慢慢走、慢慢拍。'],
  MATCH_FOOD: ['符合你的美食興趣。'],
  MATCH_NATURE: ['符合你親近自然的偏好。'],
  MATCH_CULTURE: ['符合你的文化探索偏好。'],
  CLASSIC_POI: ['這是具代表性的地點。'],
  LOCAL_EXPLORATION: ['安排一處在地風景。'],
  NEARBY_CLUSTER: ['與今天其他地點距離較近。'],
  MATCH_ACTIVITY: ['符合你偏好的活動類型。'],
}

export function reasonText(codes, variant = 0) {
  const code = codes?.[0] || 'NEARBY_CLUSTER'
  const choices = REASON_TEXT[code] || REASON_TEXT.NEARBY_CLUSTER
  return choices[Math.abs(variant) % choices.length]
}
