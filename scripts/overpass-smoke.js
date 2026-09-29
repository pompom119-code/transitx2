const query='[out:json][timeout:15];node["tourism"="viewpoint"](around:2500,25.1717,121.4401);out 10;'
for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
  const start=performance.now()
  try {const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'TransitX/2.0 (POI planner diagnostics; contact pompom119-code via GitHub)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(20000)});const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data=null}console.log(JSON.stringify({endpoint,status:response.status,count:data?.elements?.length,preview:data?undefined:raw.slice(0,180),timeMs:Math.round(performance.now()-start)}))}
  catch(error){console.log(JSON.stringify({endpoint,error:error.name,timeMs:Math.round(performance.now()-start)}))}
}
