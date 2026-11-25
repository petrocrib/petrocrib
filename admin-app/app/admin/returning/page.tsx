"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
const money=(v:any)=>"₹"+Number(v||0).toLocaleString("en-IN");
export default function ReturningPage(){
 const [data,setData]=useState<any>(null),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/admin/returning",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load");setData(d);}).catch(e=>setError(e.message));},[]);
 const s=data?.summary||{};
 return <main className="main"><div className="heroRow"><div><div className="eyebrow">Retention & loyalty</div><h1>Returning customers</h1><p>Understand repeat purchases and identify high-value customers.</p></div><Link className="btn" href="/admin">Back to dashboard</Link></div>{error&&<p className="error">{error}</p>}
 <section className="grid metricGrid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))"}}><Metric label="Customers with paid orders" value={s.customersWithOrders}/><Metric label="Returning customers" value={s.returningCustomers}/><Metric label="Repeat customer rate" value={String(s.repeatCustomerRate??0)+"%"}/><Metric label="Returning customer revenue" value={money(s.returningRevenue)}/><Metric label="Paid AOV" value={money(s.paidAov)}/><Metric label="Paid revenue" value={money(s.paidRevenue)}/></section>
 <section className="grid sectionGrid"><div className="card"><h2>Highest lifetime value</h2><div className="tableWrap"><table className="ordersTable"><thead><tr><th>Customer</th><th>Paid orders</th><th>Spend</th><th>Last order</th></tr></thead><tbody>{(data?.top||[]).map((c:any)=><tr key={c.id}><td><b>{c.name}</b><div className="small">{c.email||c.phone}</div></td><td>{c.paidOrders}</td><td>{money(c.lifetimeValue)}</td><td>{c.lastOrderAt?new Date(c.lastOrderAt).toLocaleDateString():"—"}</td></tr>)}</tbody></table></div></div>
 <div className="card"><h2>Win-back opportunities</h2><p className="small" style={{margin:"8px 0 14px"}}>Customers whose last order was more than 90 days ago. Promotional emails still require explicit opt-in.</p>{(data?.inactive||[]).slice(0,20).map((c:any)=><div className="row" key={c.id}><div><b>{c.name}</b><div className="small">{c.email||c.phone}</div></div><b>{money(c.lifetimeValue)}</b><span className="small">{c.lastOrderAt?new Date(c.lastOrderAt).toLocaleDateString():"—"}</span></div>)}</div></section></main>;
}
function Metric({label,value}:{label:string,value:any}){return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value??"—"}</div></div>}
