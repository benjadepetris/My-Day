const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
});
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const b64url = bytes => b64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const concat = (...parts) => {
  const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);
  let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out;
};
const utf8 = value => new TextEncoder().encode(value);
const u32 = n => new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
async function hmac(keyBytes,data){
  const key=await crypto.subtle.importKey("raw",keyBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,data));
}
async function hkdfExpand(prk,info,length){
  let previous=new Uint8Array(),output=new Uint8Array(),counter=1;
  while(output.length<length){
    previous=await hmac(prk,concat(previous,info,new Uint8Array([counter++])));
    output=concat(output,previous);
  }
  return output.slice(0,length);
}
async function hkdfExtract(salt,ikm){return hmac(salt,ikm)}
async function vapidToken(endpoint,env){
  const audience=new URL(endpoint).origin,now=Math.floor(Date.now()/1000);
  const header=b64url(utf8(JSON.stringify({typ:"JWT",alg:"ES256"})));
  const payload=b64url(utf8(JSON.stringify({aud:audience,exp:now+12*60*60,sub:env.VAPID_SUBJECT})));
  const unsigned=header+"."+payload;
  const key=await crypto.subtle.importKey("pkcs8",unb64(env.VAPID_PRIVATE_KEY),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,utf8(unsigned));
  return unsigned+"."+b64url(signature);
}
async function encryptPayload(subscription,payload){
  const clientPublic=unb64(subscription.p256dh),authSecret=unb64(subscription.auth);
  const clientKey=await crypto.subtle.importKey("raw",clientPublic,{name:"ECDH",namedCurve:"P-256"},false,[]);
  const serverPair=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
  const serverPublic=new Uint8Array(await crypto.subtle.exportKey("raw",serverPair.publicKey));
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH",public:clientKey},serverPair.privateKey,256));
  const authPrk=await hkdfExtract(authSecret,shared);
  const keyInfo=concat(utf8("WebPush: info\0"),clientPublic,serverPublic);
  const ikm=await hkdfExpand(authPrk,keyInfo,32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const prk=await hkdfExtract(salt,ikm);
  const cek=await hkdfExpand(prk,utf8("Content-Encoding: aes128gcm\0"),16);
  const nonce=await hkdfExpand(prk,utf8("Content-Encoding: nonce\0"),12);
  const aes=await crypto.subtle.importKey("raw",cek,{name:"AES-GCM"},false,["encrypt"]);
  const plain=concat(utf8(JSON.stringify(payload)),new Uint8Array([2]));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,tagLength:128},aes,plain));
  return concat(salt,u32(4096),new Uint8Array([serverPublic.length]),serverPublic,cipher);
}
async function sendWebPush(subscription,payload,env){
  const body=await encryptPayload(subscription,payload);
  const jwt=await vapidToken(subscription.endpoint,env);
  return fetch(subscription.endpoint,{method:"POST",headers:{
    "Authorization":"vapid t="+jwt+", k="+env.VAPID_PUBLIC_KEY,
    "TTL":"86400",
    "Urgency":"normal",
    "Content-Type":"application/octet-stream",
    "Content-Encoding":"aes128gcm"
  },body});
}
async function handleRequest(request,env){
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});
  const url=new URL(request.url);
  if(request.method==="GET"&&url.pathname==="/health")return json({ok:true,service:"MyDay Push"});
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  let data;try{data=await request.json()}catch(_){return json({error:"Invalid JSON"},400)}
  const installationId=String(data.installationId||"");
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(installationId))return json({error:"Invalid installation id"},400);
  if(url.pathname==="/subscribe"){
    const s=data.subscription||{};
    if(!s.endpoint||!s.keys?.p256dh||!s.keys?.auth)return json({error:"Invalid push subscription"},400);
    await env.DB.prepare("INSERT INTO subscriptions(endpoint,installation_id,p256dh,auth,created_at) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET installation_id=excluded.installation_id,p256dh=excluded.p256dh,auth=excluded.auth")
      .bind(s.endpoint,installationId,s.keys.p256dh,s.keys.auth,Date.now()).run();
    return json({ok:true});
  }
  if(url.pathname==="/sync"){
    if(!Array.isArray(data.jobs)||data.jobs.length>500)return json({error:"Invalid jobs list"},400);
    await env.DB.prepare("DELETE FROM scheduled_notifications WHERE installation_id=? AND sent=0").bind(installationId).run();
    const now=Date.now();
    for(const job of data.jobs){
      const id=String(job.id||"").slice(0,180),title=String(job.title||"MyDay").slice(0,120),body=String(job.body||"").slice(0,240),scheduledAt=Number(job.scheduledAt);
      if(!id||!Number.isFinite(scheduledAt)||scheduledAt<now-60000||scheduledAt>now+61*86400000)continue;
      await env.DB.prepare("INSERT OR REPLACE INTO scheduled_notifications(id,installation_id,title,body,scheduled_at,sent,created_at) VALUES(?,?,?,?,?,0,?)")
        .bind(id,installationId,title,body,scheduledAt,now).run();
    }
    return json({ok:true,scheduled:data.jobs.length});
  }
  if(url.pathname==="/unsubscribe"){
    await env.DB.prepare("DELETE FROM subscriptions WHERE installation_id=?").bind(installationId).run();
    await env.DB.prepare("DELETE FROM scheduled_notifications WHERE installation_id=?").bind(installationId).run();
    return json({ok:true});
  }
  return json({error:"Not found"},404);
}
async function deliverDue(env){
  const now=Date.now();
  const due=await env.DB.prepare("SELECT id,installation_id,title,body FROM scheduled_notifications WHERE sent=0 AND scheduled_at<=? ORDER BY scheduled_at LIMIT 100").bind(now).all();
  for(const job of due.results||[]){
    await env.DB.prepare("UPDATE scheduled_notifications SET sent=1 WHERE installation_id=? AND id=?").bind(job.installation_id,job.id).run();
    const subs=await env.DB.prepare("SELECT endpoint,p256dh,auth FROM subscriptions WHERE installation_id=?").bind(job.installation_id).all();
    let delivered=false;
    for(const sub of subs.results||[]){
      try{
        const response=await sendWebPush(sub,{title:job.title,body:job.body,id:job.id,url:"./"},env);
        if(response.status===404||response.status===410){
          await env.DB.prepare("DELETE FROM subscriptions WHERE endpoint=?").bind(sub.endpoint).run();
        }else if(response.ok)delivered=true;
        else console.error("Push endpoint returned",response.status);
      }catch(error){console.error("Push delivery failed",error)}
    }
    if(!delivered&&subs.results?.length){
      await env.DB.prepare("UPDATE scheduled_notifications SET sent=0 WHERE installation_id=? AND id=?").bind(job.installation_id,job.id).run();
    }
  }
}
export default {
  fetch: handleRequest,
  async scheduled(controller,env,ctx){ctx.waitUntil(deliverDue(env))}
};
