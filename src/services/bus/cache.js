export class Cache {
 values = new Map()
 pending = new Map()
 async get(key,ttl,loader,force=false){
  const old=this.values.get(key)
  if(!force&&old?.until>Date.now())return old.value
  if(this.pending.has(key))return this.pending.get(key)
  const work=Promise.resolve().then(loader).then(value=>{
   if(this.values.size>200)this.values.delete(this.values.keys().next().value)
   this.values.set(key,{value,until:Date.now()+ttl});return value
  }).finally(()=>this.pending.delete(key))
  this.pending.set(key,work);return work
 }
}

