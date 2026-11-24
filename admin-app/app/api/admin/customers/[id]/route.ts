import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request,{params}:{params:Promise<{id:string}>}) {
 if(!(await isAdmin())) return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const {id}=await params;const sql=db();
  const [customers,orders]=await Promise.all([
   sql`SELECT * FROM "Customer" WHERE "id"=${id} LIMIT 1`,
   sql`SELECT o.*,COALESCE(json_agg(i ORDER BY i."id") FILTER (WHERE i."id" IS NOT NULL),'[]') AS items FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o."id" WHERE o."customerId"=${id} GROUP BY o."id" ORDER BY o."createdAt" DESC LIMIT 100`
  ]);
  if(!customers.length)return NextResponse.json({error:"Customer not found"},{status:404});
  return NextResponse.json({customer:customers[0],orders},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("customer detail",error);return NextResponse.json({error:"Customer unavailable"},{status:500});}
}
