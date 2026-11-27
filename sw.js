const APP_TITLE='MyDay';
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('push',event=>{
 let data={title:APP_TITLE,body:'Tenés un aviso pendiente.'};
 try{if(event.data)data={...data,...event.data.json()}}catch(_){try{data.body=event.data.text()}catch(__){}}
 event.waitUntil(self.registration.showNotification(data.title||APP_TITLE,{
  body:data.body||'Tenés un aviso pendiente.',
  icon:'./icon.svg',
  badge:'./icon.svg',
  tag:data.tag||data.id||undefined,
  renotify:false,
  data:{url:data.url||'./'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  for(const client of list){if('focus'in client){client.navigate(target);return client.focus()}}
  return self.clients.openWindow?self.clients.openWindow(target):undefined;
 }));
});
