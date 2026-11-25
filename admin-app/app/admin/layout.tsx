"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import "./workspace.css";
const links=[["/admin","Overview"],["/admin/orders","Orders"],["/admin/products","Products"],["/admin/customers","Customers"],["/admin/returning","Growth"],["/admin/marketing","Campaigns"],["/admin/archived-orders","Archives"]];
export default function Layout({children}:{children:ReactNode}){
 const path=usePathname();
 return <div className="pcWorkspace"><aside className="pcSidebar"><Link href="/admin"><img src="https://www.petrocrib.in/assets/img/logo.png" alt="Petrocrib"/></Link><nav aria-label="Admin workspace">{links.map(([href,label])=><Link key={href} href={href} aria-current={(href==="/admin"?path===href:path===href||path.startsWith(href+"/"))?"page":undefined}>{label}</Link>)}</nav></aside><div className="pcContent">{children}</div></div>;
}
