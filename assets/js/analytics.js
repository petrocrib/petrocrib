/* PETROCRIB first-party analytics.
   Dormant until STORE_CONFIG.BACKEND_URL is configured. */
(function(){
  if(typeof STORE_CONFIG==='undefined'||!STORE_CONFIG.BACKEND_URL)return;
  const BASE=STORE_CONFIG.BACKEND_URL.replace(/\/$/,'');
  const SID_KEY='pc_visitor_id';
  const ATTR_KEY='pc_attribution';
  const get=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
  const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  let sid=localStorage.getItem(SID_KEY);
  if(!sid){sid='pcv_'+(crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):(Date.now()+Math.random().toString(16).slice(2)));localStorage.setItem(SID_KEY,sid)}

  function externalReferrer(){
    if(!document.referrer)return '';
    try{const h=new URL(document.referrer).hostname.replace(/^www\./,'');const mine=location.hostname.replace(/^www\./,'');return h===mine||h.endsWith('.'+mine)?'':document.referrer}catch{return document.referrer}
  }
  function currentAttribution(){
    const q=new URLSearchParams(location.search);
    const hasUtm=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].some(k=>q.get(k));
    const ref=externalReferrer();
    const previous=get(ATTR_KEY)||{};
    if(!hasUtm&&!ref&&Object.keys(previous).length)return previous;
    const a={
      referrer:ref||'',
      utmSource:q.get('utm_source')||'',
      utmMedium:q.get('utm_medium')||'',
      utmCampaign:q.get('utm_campaign')||'',
      utmContent:q.get('utm_content')||'',
      utmTerm:q.get('utm_term')||''
    };
    set(ATTR_KEY,a);return a;
  }
  let attr=currentAttribution();
  function device(){const w=innerWidth;return w<600?'mobile':w<1024?'tablet':'desktop'}
  function send(path,payload){
    try{return fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true,mode:'cors'}).catch(()=>{})}catch{}
  }
  function common(){return{sessionId:sid,path:location.pathname+location.search,deviceType:device(),...attr}}
  function visit(heartbeat){send('/api/track/visit',{...common(),heartbeat:!!heartbeat})}
  visit(false);
  setInterval(()=>{if(document.visibilityState==='visible')visit(true)},45000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')visit(true)});

  window.PCAnalytics={
    sessionId:()=>sid,
    track(eventType,data={}){send('/api/track/event',{...common(),eventType,...data})},
    syncCart(items){send('/api/track/cart',{sessionId:sid,items:Array.isArray(items)?items:[]})},
    attribution:()=>({...attr})
  };
})();
