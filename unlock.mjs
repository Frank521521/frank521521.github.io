const $=s=>document.querySelector(s),enc=new TextEncoder();
let session=null,worker=null;
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function rpc(message,target=navigator.serviceWorker.controller||worker){
 if(!target)throw Error('浏览器尚未准备好，请稍后再试。');
 return new Promise((resolve,reject)=>{const c=new MessageChannel(),timer=setTimeout(()=>reject(Error('浏览器响应超时，请刷新重试。')),15000);c.port1.onmessage=({data})=>{clearTimeout(timer);c.port1.close();data.ok?resolve(data):reject(Error(data.error||'解锁未完成。'))};target.postMessage(message,[c.port2])});
}
const ready=(async()=>{
 if(!window.isSecureContext||!crypto.subtle||!navigator.serviceWorker)throw Error('请在 Safari、Chrome 或 Edge 中通过 HTTPS 打开。');
 const r=await navigator.serviceWorker.register('./vault-sw.js',{scope:'./',updateViaCache:'none'});
 await navigator.serviceWorker.ready;worker=r.active||navigator.serviceWorker.controller;
 if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
 worker=navigator.serviceWorker.controller;
})();
ready.catch(e=>{$('#status').textContent=e.message;$('#open').disabled=true});
navigator.serviceWorker?.addEventListener('controllerchange',()=>{
 worker=navigator.serviceWorker.controller;
 if(worker&&session)worker.postMessage({type:'restore',...session});
});
navigator.serviceWorker?.addEventListener('message',event=>{
 if(event.data?.type==='need-session'&&session)event.source.postMessage({type:'restore',...session});
});
$('#reveal').addEventListener('click',()=>{const show=$('#password').type==='password';$('#password').type=show?'text':'password';$('#reveal').textContent=show?'隐藏':'显示';$('#reveal').setAttribute('aria-pressed',String(show));$('#reveal').setAttribute('aria-label',show?'隐藏口令':'显示口令')});
$('#unlock-form').addEventListener('submit',async event=>{
 event.preventDefault();$('#open').disabled=true;$('#status').textContent='正在解锁，请稍候……';
 try{
  await ready;
  const response=await fetch('./vault.json',{cache:'no-store'});if(!response.ok)throw Error('加密资料暂未准备好。');
  const config=await response.json();
  const password=enc.encode($('#password').value);$('#password').value='';
  const material=await crypto.subtle.importKey('raw',password,'PBKDF2',false,['deriveKey']);password.fill(0);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const encrypted=new Uint8Array(await(await fetch(config.index,{cache:'no-store'})).arrayBuffer());
  let manifest;
  try{manifest=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.slice(0,12),additionalData:enc.encode('memoir:index:v1')},key,encrypted.slice(12))))}catch{throw Error('口令不正确，请重新输入。')}
  session={key,manifest};await rpc({type:'unlock',...session});
  const frame=document.createElement('iframe');frame.title='山水与岁月 · 回忆录';frame.referrerPolicy='no-referrer';frame.src='./book/index.html';
  $('#book-slot').replaceChildren(frame);$('#gate').hidden=true;$('#reading').hidden=false;$('#status').textContent='';
 }catch(e){session=null;$('#status').textContent=e.message||'暂未能解锁，请重试。'}finally{$('#open').disabled=false}
});
async function lock(){session=null;$('#book-slot').replaceChildren();$('#reading').hidden=true;$('#gate').hidden=false;$('#password').value='';$('#status').textContent='已锁定。';try{await rpc({type:'lock'})}catch{}$('#password').focus()}
$('#lock').addEventListener('click',lock);
window.addEventListener('pagehide',()=>{session=null;worker?.postMessage({type:'lock'})});
window.addEventListener('pageshow',event=>{if(event.persisted)lock()});
