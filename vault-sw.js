/* Only ciphertext is fetched or cached by the network. Keys live in memory. */
const ROOT=new URL('./',self.location.href),BOOK=new URL('book/',ROOT).pathname;
const enc=new TextEncoder();let session=null,restoreWaiters=[],generation=0;
const cache=new Map(),pending=new Map();let cacheBytes=0;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 const m=event.data;if(!m)return;
 if(m.type==='unlock'||m.type==='restore'){
  if(!m.key||!m.manifest?.files)return;
  if(m.type==='unlock'||!session)session={key:m.key,manifest:m.manifest};for(const resolve of restoreWaiters)resolve();restoreWaiters=[];
  event.ports[0]?.postMessage({ok:true});
 }else if(m.type==='lock'){
  generation++;session=null;cache.clear();pending.clear();cacheBytes=0;
  for(const resolve of restoreWaiters)resolve();restoreWaiters=[];event.ports[0]?.postMessage({ok:true});
 }
});
async function requireSession(){
 if(session)return session;
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 await new Promise(resolve=>{restoreWaiters.push(resolve);for(const c of clients)c.postMessage({type:'need-session'});setTimeout(resolve,1000)});
 return session;
}
async function decryptFile(path,s){
 const f=s.manifest.files[path];if(!f)throw Error('missing');
 if(cache.has(f.object)){const b=cache.get(f.object);cache.delete(f.object);cache.set(f.object,b);return b}
 if(pending.has(f.object))return pending.get(f.object);
 const current=generation;
 const task=(async()=>{
  const r=await fetch(new URL(f.object,ROOT));if(!r.ok)throw Error('network');
  const encrypted=new Uint8Array(await r.arrayBuffer());
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.slice(0,12),additionalData:enc.encode(f.object)},s.key,encrypted.slice(12));
  if(current!==generation||session!==s)throw Error('locked');
  while(cacheBytes+clear.byteLength>40*1024*1024&&cache.size){const k=cache.keys().next().value;cacheBytes-=cache.get(k).byteLength;cache.delete(k)}
  if(clear.byteLength<=32*1024*1024){cache.set(f.object,clear);cacheBytes+=clear.byteLength}
  return clear;
 })().finally(()=>pending.delete(f.object));pending.set(f.object,task);return task;
}
async function serve(request,url){
 const s=await requireSession();
 if(!s)return new Response('请返回入口输入阅读口令。',{status:401,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});
 let path;try{path=decodeURIComponent(url.pathname.slice(BOOK.length))||'index.html'}catch{return new Response('Not found',{status:404})}
 const file=s.manifest.files[path];if(!file)return new Response('Not found',{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 try{
  const body=await decryptFile(path,s);
  const h=new Headers({'Content-Type':file.type,'Content-Length':String(body.byteLength),'Accept-Ranges':'bytes','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
  if(file.type.startsWith('text/html'))h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'");
  let status=200,data=body;const range=request.headers.get('Range');
  if(range){
   const m=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=body.byteLength-1;
   if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+body.byteLength}});
   if(m[1]){start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]))}else start=Math.max(0,body.byteLength-Number(m[2]));
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=body.byteLength)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+body.byteLength}});
   data=body.slice(start,end+1);status=206;h.set('Content-Range',`bytes ${start}-${end}/${body.byteLength}`);h.set('Content-Length',String(data.byteLength));
  }
  return new Response(request.method==='HEAD'?null:data,{status,headers:h});
 }catch{return new Response('资料暂未载入，请回到入口重新解锁或刷新重试。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}})}
}
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin===ROOT.origin&&url.pathname.startsWith(BOOK))event.respondWith(serve(event.request,url))});
