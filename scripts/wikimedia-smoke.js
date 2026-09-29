for(const host of ['zh.wikipedia.org','en.wikipedia.org','ja.wikipedia.org']){
 const url=new URL(`https://${host}/w/api.php`)
 url.search=new URLSearchParams({action:'query',list:'geosearch',gscoord:'25.1717|121.4401',gsradius:'8000',gslimit:'100',gsprop:'type|name|country|region',format:'json'})
 const start=performance.now()
 try{const response=await fetch(url,{headers:{'User-Agent':'TransitX/2.0 (POI planner diagnostics; contact pompom119-code via GitHub)'},signal:AbortSignal.timeout(20000)});const result=await response.json();console.log(JSON.stringify({host,status:response.status,count:result.query?.geosearch?.length,error:result.error?.info,examples:result.query?.geosearch?.slice(0,8).map(p=>({title:p.title,type:p.type,country:p.country,region:p.region})),timeMs:Math.round(performance.now()-start)}))}catch(error){console.log(JSON.stringify({host,error:error.name,timeMs:Math.round(performance.now()-start)}))}
}
