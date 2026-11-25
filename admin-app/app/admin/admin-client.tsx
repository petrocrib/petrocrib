"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [last,setLast]=useState<Date|null>(null);
  const [tab,setTab]=useState<Tab>(initialTab);
  const [editingOrder,setEditingOrder]=useState<Order|null>(null);
  const [editingStatus,setEditingStatus]=useState("PAID");
  const [editingCourier,setEditingCourier]=useState("");
  const [editingTracking,setEditingTracking]=useState("");
  const [savingOrder,setSavingOrder]=useState(false);
  const [editError,setEditError]=useState("");

  async function loadDashboard(){
    const [m,o]=await Promise.all([fetch("/api/admin/metrics",{cache:"no-store"}),fetch(`/api/admin/orders${q?`?q=${encodeURIComponent(q)}`:""}`,{cache:"no-store"})]);
    if(m.status===401||o.status===401){setAuth("out");return false;}
    if(!m.ok||!o.ok){setError("Could not load dashboard data.");return false;}
    const [mj,oj]=await Promise.all([m.json(),o.json()]);
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

  useEffect(()=>{loadAll(); const id=setInterval(loadDashboard,30000); return()=>clearInterval(id);},[]);

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
      {tab==="products" ? <ProductManager products={products} onReload={async()=>{try{await loadProducts();setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load products");}}}/> : <>
        <div className="heroRow"><div><h1>{tab==="orders"?"Orders":"Overview"}</h1></div><button className="btn" onClick={loadDashboard}>Refresh now</button></div>

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

        </>}{tab==="orders"&&<section className="card ordersCard"><div className="sectionTitle"><h2>Orders</h2><span className="pill">Latest 300</span></div><div className="toolbar"><input className="search" placeholder="Search reference, customer, phone or payment ID" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')loadDashboard()}}/><button className="btn" onClick={loadDashboard}>Search</button></div><div className="tableWrap"><table className="ordersTable"><thead><tr><th>Order</th><th>Customer</th><th>Delivery address</th><th>Items</th><th>Source</th><th>Payment</th><th>Fulfilment</th><th>Total</th><th>Created</th></tr></thead><tbody>{orders.map((o:any)=>{const address=[o.addressLine1,o.addressLine2,[o.city,o.state].filter(Boolean).join(", "),o.postalCode,o.country].filter(Boolean);const copyText=[o.customerName,o.phone,o.email,...address].filter(Boolean).join("\n");return <tr key={o.id}><td><b>{o.reference}</b><div className="small">{o.razorpayPaymentId||o.razorpayOrderId||"—"}</div><button className="manageOrderBtn" type="button" onClick={()=>openFulfilmentEditor(o)}>Manage order</button><button className="manageOrderBtn archiveOrderBtn" type="button" onClick={()=>archiveOrder(o)}>Archive</button></td><td><b>{o.customerName}</b><div className="small">{o.phone}</div>{o.email&&<div className="small orderEmail">{o.email}</div>}</td><td><div className="orderAddress">{address.length?address.map((line:string,i:number)=><div key={i}>{line}</div>):<span className="small">No address recorded</span>}</div>{address.length>0&&<button className="copyAddressBtn" type="button" onClick={()=>navigator.clipboard?.writeText(copyText)}>Copy address</button>}</td><td>{(o.items||[]).map((i:any)=><div className="orderItem" key={i.id}>{i.title} × {i.quantity}<br/><span className="small">{i.variant}</span></div>)}</td><td><span className="status">{sourceLabel(o.source)}</span></td><td><span className={`status ${o.paymentStatus==='paid'?'PAID':''}`}>{o.paymentStatus}</span></td><td><span className={`status ${o.fulfillmentStatus}`}>{o.fulfillmentStatus}</span>{o.trackingNumber&&<div className="small">{o.courier} · {o.trackingNumber}</div>}</td><td><b>{money(o.total)}</b></td><td>{new Date(o.createdAt).toLocaleString()}</td></tr>})}</tbody></table>{!orders.length&&<div className="empty">No orders yet.</div>}</div></section>}
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
    </main>
  </div>;
}

function Metric({label,value,sub}:{label:string,value:string,sub:string}){return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricSub">{sub}</div></div>}
