import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from './api.js'
import { loadEnv } from 'vite'
const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const env={...loadEnv('production',root,''),...process.env}
const api=createApi(env)
const dist=resolve(root,'dist')
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'}
createServer((req,res)=>api(req,res,async()=>{
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
  if(pathname.split('/').some(segment=>segment.startsWith('.'))){res.writeHead(404);return res.end()}
  const path=resolve(dist,'.'+pathname)
  if(path!==dist&&!path.startsWith(dist+sep)){res.writeHead(403);return res.end()}
  let data,type
  try{data=await readFile(path);type=mime[extname(path)]||'application/octet-stream'}
  catch{if(extname(path)){res.writeHead(404);return res.end()}data=await readFile(resolve(dist,'index.html'));type=mime['.html']}
  res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'})
  res.end(req.method==='HEAD'?undefined:data)
 }catch{res.writeHead(500);res.end('Build required: npm run build')}
})).listen(Number(env.PORT)||5173,'127.0.0.1')
