import test from 'node:test'
import assert from 'node:assert/strict'
import { createWikimediaPoiProvider } from './wikimediaPoiProvider.js'

test('destination resolution and POI provider retain only source-backed in-region landmarks',async()=>{
  const region={name:'Fixtureton District',type:'town',display_name:'Fixtureton District, Taiwan',lat:'25',lon:'121.5',boundingbox:['24.9','25.1','121.4','121.6'],address:{country_code:'tw'},geojson:{type:'Polygon',coordinates:[[[121.4,24.9],[121.6,24.9],[121.6,25.1],[121.4,25.1],[121.4,24.9]]]}}
  const visited=[]
  const resolver={async resolveDestination(destination){assert.equal(destination,'Fixtureton');return region},async resolvePlace(){return null},async searchPlaces(){return []}}
  const fetcher=async url=>{
    visited.push(String(url))
    const parsed=new URL(url)
    if(parsed.searchParams.get('list')==='geosearch')return new Response(JSON.stringify({query:{geosearch:[
      {pageid:21,title:'Fixture Museum',lat:25.001,lon:121.501,type:'museum'},
      {pageid:22,title:'Remote Museum',lat:26,lon:121.5,type:'museum'},
    ]}}),{status:200})
    return new Response(JSON.stringify({query:{pages:{21:{pageid:21,categories:[{title:'Category:Museums in Taiwan'}]}}}}),{status:200})
  }
  const provider=createWikimediaPoiProvider(fetcher,resolver)
  const result=await provider.searchPOIs('Fixtureton',[],AbortSignal.timeout(5000),{forceRefresh:true})
  assert.equal(result.region.display_name,region.display_name)
  assert.deepEqual(result.center,{latitude:25,longitude:121.5})
  assert.equal(result.pois.length,1)
  assert.equal(result.pois[0].name,'Fixture Museum')
  assert.equal(result.pois[0].category,'museum')
  assert.match(result.pois[0].source,/Wikipedia/)
  assert.ok(result.diagnostics.rawCount>result.diagnostics.normalizedCount)
  assert.equal(result.diagnostics.geographicCount,2) // zh and en query totals before alias deduplication
  assert.ok(result.diagnostics.http.every(entry=>entry.status===200))
  assert.ok(visited.length>=6)
})
