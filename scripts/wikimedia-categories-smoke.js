import {createWikimediaPoiProvider} from '../server/planner/wikimediaPoiProvider.js'
const result=await createWikimediaPoiProvider().searchPOIs('淡水')
const pageids=result.pois.filter(p=>p.id.startsWith('wikipedia:zh:')).slice(0,50).map(p=>p.id.split(':').at(-1))
const url=new URL('https://zh.wikipedia.org/w/api.php')
url.search=new URLSearchParams({action:'query',prop:'categories',pageids:pageids.join('|'),cllimit:'max',format:'json'})
const response=await fetch(url,{headers:{'User-Agent':'TransitX/2.0 (Smart Planner; contact pompom119-code via GitHub)'},signal:AbortSignal.timeout(20000)})
const data=await response.json()
console.log(JSON.stringify({status:response.status,continue:data.continue,examples:Object.values(data.query?.pages||{}).filter(p=>/紅毛城|漁人碼頭|古墓|學校|福德宮|紅樓|砲臺/.test(p.title)).map(p=>({title:p.title,categories:p.categories?.map(c=>c.title)}))}))
