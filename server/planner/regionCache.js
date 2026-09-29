import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { normalizedName } from '../../src/services/planner/geo.js'

const DIR=resolve(process.cwd(),'.cache','planner-regions')
const TTL=30*86400000
const memory=new Map(),pending=new Map()
export async function resolveCachedRegion(destination,resolver,signal) {
  const key=normalizedName(destination)
  const current=memory.get(key)
  if(current&&Date.now()-current.savedAt<TTL)return current.region
  if(pending.has(key))return pending.get(key)
  const task=(async()=>{
    const path=resolve(DIR,createHash('sha256').update(key).digest('hex')+'.json')
    let disk
    try{disk=JSON.parse(await readFile(path,'utf8'))}catch{/* no previous resolution */}
    if(disk?.region&&Date.now()-disk.savedAt<TTL){memory.set(key,disk);return disk.region}
    try{
      const region=await resolver.resolveDestination(destination,signal)
      const entry={savedAt:Date.now(),region}
      memory.set(key,entry)
      await mkdir(DIR,{recursive:true}).then(()=>writeFile(path,JSON.stringify(entry),'utf8')).catch(()=>{})
      return region
    }catch(error){if(disk?.region){memory.set(key,disk);return disk.region}throw error}
  })().finally(()=>pending.delete(key))
  pending.set(key,task)
  return task
}
