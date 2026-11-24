"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
export default function ArchivedOrdersPage(){
 const [orders,setOrders]=useState<any[]>([]),[error,setError]=useState("");
 async function load(){try{const r=await fetch("/api/admin/orders?archived=true",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load archived orders");setOrders(d.orders||[]);}catch(e){setError(e instanceof Error?e.message:"Could not load orders");}}
 useEffect(()=>{load();},[]);
 async function restore(id:string){if(!confirm("Restore this order to the active orders list?"))return;try{const r=await fetch("/api/admin/orders/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"restore"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not restore");await load();}catch(e){setError(e instanceof Error?e.message:"Could not restore");}}
 return <main className="main"><div className="heroRow"><div><div className="eyebrow">Order management</div><h1>Archived orders</h1><p>Archived orders are preserved and can be restored at any time.</p></div><Link className="btn" href="/admin">Back to dashboard</Link></div>{error&&<p className="error">{error}</p>}<section className="card"><div className="tableWrap"><table className="ordersTable"><thead><tr><th>Reference</th><th>Customer</th><th>Payment</th><th>Total</th><th>Archived</th><th>Action</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b>{o.reference}</b></td><td>{o.customerName}<div className="small">{o.phone}</div></td><td>{o.paymentStatus}</td><td>₹{Number(o.total||0).toLocaleString("en-IN")}</td><td>{o.archivedAt?new Date(o.archivedAt).toLocaleString():"—"}</td><td><button className="btn yellow" onClick={()=>restore(o.id)}>Restore</button></td></tr>)}</tbody></table>{!orders.length&&<div className="empty">No archived orders.</div>}</div></section></main>;
}
