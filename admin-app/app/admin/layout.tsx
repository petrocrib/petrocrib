"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import "./workspace.css";
const links=[
["/admin","Overview","M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"],
["/admin/orders","Orders","M5 4h14v17H5z M9 4V2h6v2 M8 9h8 M8 13h8 M8 17h5"],
["/admin/products","Products","M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10"],
["/admin/customers","Customers","M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-4 M16 3a4 4 0 0 1 0 8"],
["/admin/returning","Growth","M3 3v18h18 M6 16l5-5 4 4 6-8 M16 7h5v5"],
["/admin/marketing","Campaigns","M3 5h18v14H3z M3 6l9 7 9-7"],
["/admin/archived-orders","Archives","M3 4h18v4H3z M5 8v13h14V8 M9 12h6"]];
export default function Layout({children}:{children:ReactNode}){
 const path=(usePathname()||"/admin").replace(/\/$/,"");
 return <div className="pcWorkspace"><aside className="pcSidebar"><Link className="pcBrand" href="/admin"><img src="https://www.petrocrib.in/assets/img/logo.png" alt="Petrocrib"/><span>ADMIN STUDIO</span></Link><nav aria-label="Admin workspace">{links.map(([href,label,d])=><Link key={href} href={href} aria-current={(href==="/admin"?path===href:path===href||path.startsWith(href+"/"))?"page":undefined}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg><span>{label}</span></Link>)}</nav></aside><div className="pcContent">{children}</div></div>;
}
