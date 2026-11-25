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


  // Advertising is opt-in, independent of order and email marketing consent.
  const ADS_KEY='pc_ads_consent_v1';
  const PIXEL='241903595474647';
  let adsChoice=get(ADS_KEY);
  let pixelStarted=false;
  function pixelInit(){
    if(adsChoice!=='yes'||pixelStarted)return;
    if(window.fbq)return; // Do not initialize an unknown existing pixel.
    const q=window.fbq=function(){q.callMethod?q.callMethod.apply(q,arguments):q.queue.push(arguments)};
    window._fbq=q;q.push=q;q.loaded=true;q.version='2.0';q.queue=[];
    const script=document.createElement('script');
    script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
    q('init',PIXEL);pixelStarted=true;
    q('trackSingle',PIXEL,'PageView');
  }
  function adsEvent(eventType,data){
    if(adsChoice!=='yes'||!pixelStarted||typeof window.fbq!=='function')return;
    const name={product_view:'ViewContent',add_to_cart:'AddToCart',checkout_start:'InitiateCheckout',checkout_success:'Purchase'}[eventType];
    if(!name)return;
    const params={};
    if(typeof data.productId==='string'&&data.productId){params.content_ids=[data.productId];params.content_type='product'}
    if(Number.isFinite(data.value)&&data.value>=0){params.value=data.value;params.currency='INR'}
    if(name==='Purchase'){
      // Only the verified payment handler supplies the stable payment identifier.
      const id=data.metadata&&data.metadata.paymentEventId;
      if(typeof id!=='string'||!/^pay_[A-Za-z0-9]+$/.test(id)||!Number.isFinite(params.value)||params.value<=0)return;
      const key='pc_meta_purchase_'+id;
      if(get(key))return;
      window.fbq('trackSingle',PIXEL,name,params,{eventID:id});set(key,true);
    }else window.fbq('trackSingle',PIXEL,name,params);
  }
  function showAdsChoice(){
    const panel=document.createElement('section');
    panel.setAttribute('aria-label','Advertising privacy preferences');
    panel.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;max-width:520px;z-index:10000;background:#171717;color:#fff;padding:16px;border:1px solid #fcd019;border-radius:8px;font:16px/1.5 system-ui';
    const msg=document.createElement('p');msg.textContent='Optional advertising cookies help us measure Meta ads and purchases. You can decline without affecting your order.';
    panel.appendChild(msg);
    for(const [label,value] of [['Allow advertising','yes'],['Decline','no']]){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='margin:4px;padding:8px 12px;background:#fcd019;color:#111;border:0;border-radius:4px;cursor:pointer';
      b.onclick=()=>{const was=adsChoice;adsChoice=value;set(ADS_KEY,value);panel.remove();if(value==='yes'){try{pixelInit()}catch{}}else if(was==='yes'&&pixelStarted){try{window.fbq('consent','revoke')}catch{};location.reload()}};
      panel.appendChild(b);
    }
    document.body.appendChild(panel);
  }
  const prefs=document.createElement('button');prefs.type='button';prefs.textContent='Advertising privacy choices';
  prefs.style.cssText='display:block;margin:12px auto;padding:8px;color:#111;background:#fcd019;border:0;border-radius:4px;cursor:pointer';
  prefs.onclick=showAdsChoice;
  (document.querySelector('footer')||document.body).appendChild(prefs);
  if(adsChoice==='yes'){try{pixelInit()}catch{}}else if(adsChoice!=='no')showAdsChoice();

  window.PCAnalytics={
    sessionId:()=>sid,
    track(eventType,data={}){send('/api/track/event',{...common(),eventType,...data});try{adsEvent(eventType,data)}catch{}},
    syncCart(items){send('/api/track/cart',{sessionId:sid,items:Array.isArray(items)?items:[]})},
    attribution:()=>({...attr})
  };
})();
