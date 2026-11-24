"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function CustomersPage() {
  const [customers,setCustomers]=useState<any[]>([]),[q,setQ]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  async function load(){setLoading(true);try{const r=await fetch("/api/admin/customers?q="+encodeURIComponent(q),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load customers");setCustomers(d.customers||[]);setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load customers");}finally{setLoading(false);}}
  useEffect(()=>{load();},[]);
  return <main className="main"><div className="heroRow"><div><div className="eyebrow">Petrocrib CRM</div><h1>Customers</h1><p>Customer records, order frequency and lifetime value.</p></div><Link className="btn" href="/admin">Back to dashboard</Link></div>
    <section className="card"><div className="toolbar"><input className="search" placeholder="Search name, email or phone" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/><button className="btn yellow" onClick={load}>Search</button></div>
    {error&&<p className="error">{error}</p>}<div className="tableWrap"><table className="ordersTable"><thead><tr><th>Customer</th><th>Contact</th><th>Paid orders</th><th>Lifetime value</th><th>Last order</th><th>Marketing</th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><Link href={"/admin/customers/"+encodeURIComponent(c.id)}><b>{c.name}</b></Link><div className="small">{c.city||"Location not set"}</div></td><td>{c.email||"—"}<div className="small">{c.phone}</div></td><td>{Number(c.paidOrderCount||0)}</td><td><b>₹{Number(c.lifetimeValue||0).toLocaleString("en-IN")}</b></td><td>{c.lastPaidOrderAt?new Date(c.lastPaidOrderAt).toLocaleDateString():"—"}</td><td><span className="status">{c.marketingConsent&& !c.marketingUnsubscribedAt?"Opted in":"Not subscribed"}</span></td></tr>)}</tbody></table>{!loading&&!customers.length&&<div className="empty">No customers found.</div>}</div></section></main>;
}
