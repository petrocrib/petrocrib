"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {exportCsv} from "./export-csv";
import AdminPushControls from "./admin-push-controls";
import ProductManager, { type AdminProduct } from "./product-manager";

type Metrics = any;
type Order = any;
type Tab = "dashboard" | "products" | "orders";

const FULFILMENT_STATUSES = ["PAYMENT_PENDING", "PAID", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"];

const money=(n:any)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const num=(n:any)=>Number(n||0).toLocaleString("en-IN");
const sourceLabel=(s:string)=>({direct:"Direct",google:"Google",instagram:"Instagram",facebook:"Facebook",youtube:"YouTube",whatsapp:"WhatsApp",referral:"Other referral"}[s]||s||"Unknown");

function Brand({ dark=false, admin=true }:{dark?:boolean;admin?:boolean}){
  return <div className={`brand logoBrand ${dark?"dark":""}`}><img className="adminLogo" src="https://www.petrocrib.in/assets/img/logo.png" alt="Petrocrib"/>{admin&&<span className="adminWord">ADMIN</span>}</div>;
}

export default function AdminClient({initialTab="dashboard"}:{initialTab?:Tab}){
  const [metrics,setMetrics]=useState<Metrics|null>(null);
  const [orders,setOrders]=useState<Order[]>([]);
  const [products,setProducts]=useState<AdminProduct[]>([]);
  const [auth,setAuth]=useState<"loading"|"in"|"out">("loading");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [q,setQ]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const visibleOrders=orders.filter(o=>!statusFilter||String(o.fulfillmentStatus).toUpperCase()===statusFilter);
  const [last,setLast]=useState<Date|null>(null);
  const tab=initialTab;
  const [editingOrder,setEditingOrder]=useState<Order|null>(null);
  const [editingStatus,setEditingStatus]=useState("PAID");
  const [editingCourier,setEditingCourier]=useState("");
  const [editingTracking,setEditingTracking]=useState("");
  const [savingOrder,setSavingOrder]=useState(false);
  const [editError,setEditError]=useState("");
  const [orderSoundEnabled,setOrderSoundEnabled]=useState(false);
  const [orderSoundNotice,setOrderSoundNotice]=useState("");
  const [settingsOpen,setSettingsOpen]=useState(false);
  useEffect(()=>{const sync=()=>setSettingsOpen(window.location.hash==="#settings");sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync);},[]);
  const seenPaidOrders=useRef<Set<string>|null>(null);
  const soundEnabledRef=useRef(false);
  const orderAudioRef=useRef<HTMLAudioElement|null>(null);
  const orderSoundContext=useRef<AudioContext|null>(null);

  function playOrderChime(){
    const audio=orderAudioRef.current;
    if(!audio) return Promise.reject(new Error("Order sound is unavailable."));
    audio.currentTime=0;
    audio.volume=0.78;
    const playback=audio.play();
    try {
      const ctx=orderSoundContext.current ?? (orderSoundContext.current=new AudioContext());
      void ctx.resume().then(()=>{
        if(!soundEnabledRef.current) return;
        const t=ctx.currentTime;
        const bus=ctx.createGain();
        bus.gain.value=0.55;
        const limiter=ctx.createDynamicsCompressor();
        limiter.threshold.value=-12;
        limiter.ratio.value=8;
        bus.connect(limiter).connect(ctx.destination);
        const hit=(freq:number,end:number,start:number,duration:number,level:number,type:OscillatorType)=>{
          const osc=ctx.createOscillator(), gain=ctx.createGain();
          osc.type=type;
          osc.frequency.setValueAtTime(freq,t+start);
          osc.frequency.exponentialRampToValueAtTime(end,t+start+duration);
          gain.gain.setValueAtTime(0.001,t+start);
          gain.gain.exponentialRampToValueAtTime(level,t+start+0.008);
          gain.gain.exponentialRampToValueAtTime(0.001,t+start+duration);
          osc.connect(gain).connect(bus);
          osc.start(t+start);osc.stop(t+start+duration);
          osc.onended=()=>{osc.disconnect();gain.disconnect();};
        };
        hit(165,65,0,0.18,0.65,"triangle");
        hit(340,95,0.035,0.13,0.23,"triangle");
        hit(1320,1300,0.13,0.65,0.23,"sine");
        hit(2110,2080,0.13,0.43,0.12,"sine");
        hit(1760,1750,0.20,0.48,0.15,"sine");
        const cleanup=ctx.createOscillator();
        const silent=ctx.createGain();silent.gain.value=0;
        cleanup.connect(silent).connect(ctx.destination);
        cleanup.start(t);cleanup.stop(t+0.9);
        cleanup.onended=()=>{bus.disconnect();limiter.disconnect();cleanup.disconnect();silent.disconnect();};
      }).catch(()=>{});
    } catch { /* Original recording remains available on unsupported browsers. */ }
    return playback;
  }

  async function toggleOrderSound(){
    setOrderSoundNotice("");
    if(soundEnabledRef.current){
      soundEnabledRef.current=false;
      setOrderSoundEnabled(false);
      orderAudioRef.current?.pause();
      return;
    }
    soundEnabledRef.current=true;
    setOrderSoundEnabled(true);
    try{
      await playOrderChime();
    }catch{
      if(!soundEnabledRef.current) return;
      soundEnabledRef.current=false;
      setOrderSoundEnabled(false);
      setOrderSoundNotice("Could not play the cash register sound.");
    }
  }

  async function loadDashboard(){
    const [m,o]=await Promise.all([fetch("/api/admin/metrics",{cache:"no-store"}),fetch(`/api/admin/orders${q?`?q=${encodeURIComponent(q)}`:""}`,{cache:"no-store"})]);
    if(m.status===401||o.status===401){setAuth("out");return false;}
    if(!m.ok||!o.ok){setError("Could not load dashboard data.");return false;}
    const [mj,oj]=await Promise.all([m.json(),o.json()]);
    // Establish a baseline on first load: historical paid orders never trigger a chime.
    const paidIds=new Set<string>((oj.orders||[]).filter((order:Order)=>String(order.paymentStatus||"").toLowerCase()==="paid").map((order:Order)=>String(order.id)));
    if(seenPaidOrders.current!==null && soundEnabledRef.current){
      const newPaid=[...paidIds].filter(id=>!seenPaidOrders.current!.has(id));
      if(newPaid.length) void playOrderChime().catch(()=>{
        if(soundEnabledRef.current) setOrderSoundNotice("Could not play the cash register sound.");
      });
    }
    seenPaidOrders.current=paidIds;
    setMetrics(mj);setOrders(oj.orders||[]);setAuth("in");setLast(new Date());setError("");
    return true;
  }

  async function loadProducts(){
    const r=await fetch("/api/admin/products",{cache:"no-store"});
    if(r.status===401){setAuth("out");return;}
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||"Could not load products");
    setProducts(data.products||[]);
  }

  async function loadAll(){
    try{
      const ok=await loadDashboard();
      if(ok) await loadProducts();
    }catch(e){setError(e instanceof Error?e.message:"Could not load admin data");}
  }

  useEffect(()=>{loadAll(); const id=initialTab==="dashboard"?setInterval(loadDashboard,30000):undefined; return()=>{if(id!==undefined)clearInterval(id);};},[]);

  async function login(e:FormEvent){
    e.preventDefault();setError("");
    const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
    if(!r.ok){setError((await r.json()).error||"Login failed");return;}
    setPassword("");await loadAll();
  }

  function openFulfilmentEditor(order:Order){
    setEditingOrder(order);
    setEditingStatus(String(order.fulfillmentStatus || (order.paymentStatus === "paid" ? "PAID" : "PAYMENT_PENDING")).toUpperCase());
    setEditingCourier(String(order.courier || ""));
    setEditingTracking(String(order.trackingNumber || ""));
    setEditError("");
  }

  async function archiveOrder(order:Order){
    if(!confirm(`Archive order ${order.reference}? It will be hidden from the active list and can be restored later.`)) return;
    try{const r=await fetch(`/api/admin/orders/${encodeURIComponent(String(order.id))}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"archive"})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not archive order");await loadDashboard();}catch(e){setError(e instanceof Error?e.message:"Could not archive order");}
  }

  async function saveFulfilmentChanges(){
    if(!editingOrder) return;
    if(editingStatus === "SHIPPED" && (!editingCourier.trim() || !editingTracking.trim())){
      setEditError("Enter both courier name and tracking number before marking this order as shipped.");
      return;
    }
    setSavingOrder(true);
    setEditError("");
    try{
      const response=await fetch(`/api/admin/orders/${encodeURIComponent(String(editingOrder.id))}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({status:editingStatus,courier:editingCourier.trim(),trackingNumber:editingTracking.trim()})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error || "Could not save order changes.");
      setEditingOrder(null);
      await loadDashboard();
    }catch(e){
      setEditError(e instanceof Error ? e.message : "Could not save order changes.");
    }finally{
      setSavingOrder(false);
    }
  }

  const maxDaily=useMemo(()=>Math.max(1,...(metrics?.daily||[]).map((d:any)=>Number(d.visitors||0))),[metrics]);
  const maxSource=useMemo(()=>Math.max(1,...(metrics?.sources||[]).map((d:any)=>Number(d.visitors||0))),[metrics]);

  if(auth==="loading") return <div className="login"><div className="loginCard"><Brand dark/><h1>Loading dashboard…</h1></div></div>;
  if(auth==="out") return <div className="login"><form className="loginCard" onSubmit={login}><Brand dark/><div className="loginDivider"/><h1>Admin login</h1><p>Sales, products, visitors, carts and fulfilment in one place.</p><label className="loginLabel" htmlFor="adminPassword">Admin password</label><input id="adminPassword" type="password" placeholder="Enter admin password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus autoComplete="current-password"/><button className="btn yellow">Open dashboard</button>{error&&<div className="error">{error}</div>}</form></div>;

  const s=metrics?.summary||{};
  return <div className="adminShell">
    

    <main className="main">
      {/* Vintage cash register by Tompalompa (CC0), excerpt from Slap Alert. */}
      <audio ref={orderAudioRef} preload="auto" src="/sounds/cash-register.mp3" />
      {tab==="products" ? <ProductManager products={products} onReload={async()=>{try{await loadProducts();setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load products");}}}/> : <>
        <div className="heroRow"><div><h1>{tab==="orders"?"Orders":"Overview"}</h1></div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><button className="btn" onClick={loadDashboard}>Refresh now</button></div></div>

        {tab==="dashboard"&&<><section className="grid metricGrid">
          <Metric label="Active users now" value={num(s.activeUsers)} sub="Seen in the last 3 min"/>
          <Metric label="Visitors today" value={num(s.visitorsToday)} sub={`${num(s.pageViewsToday)} page views`}/>
          <Metric label="Live carts" value={num(s.liveCarts)} sub={`${money(s.liveCartValue)} sitting in carts`}/>
          <Metric label="Orders today" value={num(s.ordersToday)} sub={`${num(s.paidOrdersToday)} paid`}/>
          <Metric label="Revenue today" value={money(s.revenueToday)} sub={`AOV ${money(s.averageOrderValue)}`}/>
          <Metric label="Conversion today" value={`${Number(s.conversionToday||0).toFixed(1)}%`} sub={`${money(s.lifetimeRevenue)} lifetime paid revenue`}/>
        </section>

        <section className="grid sectionGrid">
          <div className="card"><div className="sectionTitle"><h2>Where visitors come from</h2><span className="pill">First-touch · 30 days</span></div><div className="sourceRows">{(metrics?.sources||[]).map((x:any)=><div key={x.source} className="row"><div><div className="sourceName">{sourceLabel(x.source)}</div><div className="barTrack"><div className="barFill" style={{width:`${Math.max(4,Number(x.visitors)/maxSource*100)}%`}}/></div></div><b>{num(x.visitors)}</b><span className="small">visitors</span></div>)}{!(metrics?.sources||[]).length&&<div className="empty">Traffic source data will appear after tracking starts.</div>}</div></div>
          <div className="card"><div className="sectionTitle"><h2>Revenue by source</h2><span className="pill">Paid orders · 30 days</span></div><div className="sourceRows">{(metrics?.orderSources||[]).map((x:any)=><div key={x.source} className="row"><div className="sourceName">{sourceLabel(x.source)}</div><b>{money(x.revenue)}</b><span className="small">{num(x.orders)} orders</span></div>)}{!(metrics?.orderSources||[]).length&&<div className="empty">No paid attributed orders yet.</div>}</div></div>
        </section>

        <section className="grid sectionGrid">
          <div className="card"><div className="sectionTitle"><h2>Daily visitors</h2><span className="pill">Last 14 days</span></div><div className="chart">{(metrics?.daily||[]).map((d:any)=><div key={d.date} className="chartCol" data-tip={`${d.date}: ${d.visitors} visitors`} style={{height:`${Math.max(4,Number(d.visitors)/maxDaily*100)}%`}}/>)}</div></div>
          <div className="card"><div className="sectionTitle"><h2>Visitor locations</h2><span className="pill">30 days</span></div><div className="locationRows">{(metrics?.locations||[]).slice(0,10).map((x:any,i:number)=><div className="row" key={i}><div><b>{x.city}</b><div className="small">{[x.region,x.country].filter(Boolean).join(", ")}</div></div><b>{num(x.visitors)}</b><span className="small">visitors</span></div>)}</div></div>
        </section>

        <section className="grid sectionGrid">
          <div className="card"><div className="sectionTitle"><h2>Product interest</h2><span className="pill">30 days</span></div><div className="productRows">{(metrics?.products||[]).slice(0,12).map((x:any)=><div className="row" key={x.productId}><div><b>{x.title||x.productId}</b><div className="small">{x.adds} adds · {x.purchases} purchases</div></div><b>{num(x.views)}</b><span className="small">views</span></div>)}{!(metrics?.products||[]).length&&<div className="empty">Product analytics will populate after storefront activity.</div>}</div></div>
          <div className="card"><div className="sectionTitle"><h2>Carts happening now</h2><span className="pill">Last 10 min</span></div><div className="cartRows">{(metrics?.liveCarts||[]).map((x:any)=><div className="row" key={x.sessionId}><div><b>{x.itemCount} item{x.itemCount===1?"":"s"}</b><div className="small">{Array.isArray(x.items)?x.items.slice(0,2).map((i:any)=>i.title).join(" · "):"Live cart"}</div></div><b>{money(x.cartValue)}</b><span className="small">live</span></div>)}{!(metrics?.liveCarts||[]).length&&<div className="empty">No live carts right now.</div>}<div className="small" style={{marginTop:12}}>Abandoned (7 days): <b>{num(metrics?.abandoned?.count)}</b> carts · <b>{money(metrics?.abandoned?.value)}</b></div></div></div>
        </section>

        </>}{tab==="orders"&&<section className="card ordersCard pcOrders"><div className="sectionTitle"><h2>Order register</h2><span className="pill">{visibleOrders.length} shown · latest 300</span></div><div className="toolbar"><input className="search" placeholder="Search reference, customer, phone or payment ID" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')loadDashboard()}}/><button className="btn" onClick={loadDashboard}>Search</button><select aria-label="Fulfilment filter" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option>{FULFILMENT_STATUSES.map(s=><option key={s}>{s}</option>)}</select><button className="btn yellow" onClick={()=>exportCsv("petrocrib-orders",["Reference","Customer","Email","Phone","Payment","Fulfilment","Total","Courier","Tracking","Created"],visibleOrders.map(o=>[o.reference,o.customerName,o.email,o.phone,o.paymentStatus,o.fulfillmentStatus,o.total,o.courier,o.trackingNumber,o.createdAt]))}>Export CSV (Excel)</button></div><div className="tableWrap"><table className="ordersTable pcOrderTable"><colgroup><col style={{width:190}}/><col style={{width:215}}/><col style={{width:245}}/><col style={{width:245}}/><col style={{width:175}}/><col style={{width:125}}/><col style={{width:150}}/></colgroup><thead><tr><th>Order / source</th><th>Customer</th><th>Delivery address</th><th>Products</th><th>Payment / fulfilment</th><th>Total</th><th>Created (IST)</th></tr></thead><tbody>{visibleOrders.map((o:any)=>{const address=[o.addressLine1,o.addressLine2,[o.city,o.state].filter(Boolean).join(", "),o.postalCode,o.country].filter(Boolean);const copyText=[o.customerName,o.phone,o.email,...address].filter(Boolean).join("\n");return <tr key={o.id}><td><div className="pcCellStack"><b className="pcRef">{o.reference}</b><span className="pcSource">{sourceLabel(o.source)}</span><details className="pcPaymentRef"><summary>Payment reference</summary><span>{o.razorpayPaymentId||o.razorpayOrderId||"—"}</span></details><div className="pcOrderActions"><button className="manageOrderBtn" type="button" onClick={()=>openFulfilmentEditor(o)}>Manage</button><button className="manageOrderBtn archiveOrderBtn" type="button" onClick={()=>archiveOrder(o)}>Archive</button></div></div></td><td><b>{o.customerName}</b><div className="small">{o.phone}</div>{o.email&&<div className="small orderEmail">{o.email}</div>}</td><td><div className="orderAddress">{address.length?address.map((line:string,i:number)=><div key={i}>{line}</div>):<span className="small">No address recorded</span>}</div>{address.length>0&&<button className="copyAddressBtn" type="button" onClick={()=>navigator.clipboard?.writeText(copyText)}>Copy address</button>}</td><td><div className="pcItems">{(o.items||[]).map((i:any)=><div className="pcItem" key={i.id}><div className="pcItemHead"><strong>{i.title}</strong><span className="pcQty">×{i.quantity}</span></div><div className="pcVariant">{i.variant||"Standard"}</div></div>)}{!(o.items||[]).length&&<span>—</span>}</div></td><td><div className="pcCellStack"><span className={`status ${o.paymentStatus==='paid'?'PAID':''}`}>{o.paymentStatus}</span><span className={`status pcFulfilment ${o.fulfillmentStatus}`}>{String(o.fulfillmentStatus||"Pending").replaceAll("_"," ")}</span>{o.trackingNumber&&<div className="pcTracking"><strong>{o.courier}</strong><span>{o.trackingNumber}</span></div>}</div></td><td><b className="pcAmount">{money(o.total)}</b></td><td><div className="pcCellStack"><strong>{new Date(o.createdAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"})}</strong><span>{new Date(o.createdAt).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"})}</span></div></td></tr>})}</tbody></table>{!visibleOrders.length&&<div className="empty">No orders yet.</div>}</div></section>}
      </>}
      {editingOrder&&<div className="orderModalBackdrop">
        <section className="orderEditor" role="dialog" aria-modal="true" aria-labelledby="orderEditorTitle">
          <header className="orderEditorHeader">
            <div><div className="eyebrow">Order fulfilment</div><h2 id="orderEditorTitle">{editingOrder.reference}</h2></div>
            <button className="editorClose" type="button" aria-label="Close order editor" onClick={()=>setEditingOrder(null)}>×</button>
          </header>
          <div className="orderEditorBody">
            <div className="orderEditorSummary"><div><span>Customer</span><b>{editingOrder.customerName || "Customer"}</b></div><div><span>Payment</span><b>{String(editingOrder.paymentStatus || "unknown").toUpperCase()}</b></div><div><span>Order total</span><b>{money(editingOrder.total)}</b></div></div>
            <label className="orderEditorField"><span>Fulfilment status</span><select value={editingStatus} onChange={e=>setEditingStatus(e.target.value)}>{FULFILMENT_STATUSES.map(status=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select></label>
            <div className="orderEditorFields">
              <label className="orderEditorField"><span>Courier name</span><input value={editingCourier} onChange={e=>setEditingCourier(e.target.value)} placeholder="e.g. Delhivery, Blue Dart" maxLength={120}/></label>
              <label className="orderEditorField"><span>Tracking number</span><input value={editingTracking} onChange={e=>setEditingTracking(e.target.value)} placeholder="Enter tracking / AWB number" maxLength={160}/></label>
            </div>
            <p className="orderEditorHint">Enter the courier and tracking number before saving as SHIPPED. The customer shipping email is sent after the order is saved.</p>
            {editError&&<div className="error orderEditorError">{editError}</div>}
          </div>
          <footer className="orderEditorFooter"><button className="btn light" type="button" onClick={()=>setEditingOrder(null)} disabled={savingOrder}>Cancel</button><button className="btn yellow" type="button" onClick={saveFulfilmentChanges} disabled={savingOrder}>{savingOrder?"Saving…":"Save changes"}</button></footer>
        </section>
      </div>}
      {error&&<div className="error adminGlobalError">{error}</div>}
      {settingsOpen&&<section className="card" aria-labelledby="notificationSettingsTitle" style={{position:"fixed",inset:"auto 12px 16px auto",width:"min(440px, calc(100vw - 24px))",maxHeight:"80vh",overflow:"auto",zIndex:1000,padding:24,boxSizing:"border-box",background:"#141414",color:"#facc15",border:"1px solid #facc15",borderRadius:16,boxShadow:"0 12px 48px #0008"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><h2 id="notificationSettingsTitle" style={{margin:0}}>Settings</h2><button className="btn" type="button" aria-label="Close settings" onClick={()=>{window.history.replaceState(null,"",window.location.pathname+window.location.search);setSettingsOpen(false);}}>Close</button></div>
        <p style={{fontSize:13,marginBlock:"12px 20px"}}>ORDER NOTIFICATIONS</p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,paddingBlock:16,borderTop:"1px solid #665b24"}}>
          <div><strong>Ka-ching sound</strong><p style={{fontSize:13,margin:"6px 0 0"}}>Play sound for new paid orders.</p></div>
          <button className="btn" type="button" role="switch" aria-label="Ka-ching sound" aria-checked={orderSoundEnabled} onClick={toggleOrderSound} style={{minWidth:64,background:orderSoundEnabled?"#facc15":"#141414",color:orderSoundEnabled?"#141414":"#facc15",border:"1px solid #facc15"}}>{orderSoundEnabled?"ON":"OFF"}</button>
        </div>
        {orderSoundNotice&&<p role="status" className="small">{orderSoundNotice}</p>}
        <AdminPushControls />
      </section>}
    </main>
  </div>;
}

function Metric({label,value,sub}:{label:string,value:string,sub:string}){return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricSub">{sub}</div></div>}
