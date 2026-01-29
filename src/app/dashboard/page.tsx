"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";

import { supabasePublic } from "@lib/supabase";
const fetcher = async (u:string)=>{
  const { data } = await supabasePublic.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string,string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(u, { headers });
  return r.json();
};

export default function DashboardPage() {
  const { data: listingsData } = useSWR("/api/listings", fetcher);
  const { data: salesData } = useSWR("/api/sales", fetcher);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  
  const listings = listingsData?.listings ?? [];
  const sales = Array.isArray(salesData) ? salesData : [];

  const totalRevenue = sales
    .filter((s: any) => s.status === "Closed")
    .reduce((acc: number, s: any) => acc + (s.amount || 0), 0);

  const activeSales = sales.filter((s: any) => s.status !== "Cancelled" && s.status !== "In Progress");
  const totalSalesCount = activeSales.filter((s: any) => s.salesCategory === "Sale" || !s.salesCategory).length;
  const totalRentalsCount = activeSales.filter((s: any) => s.salesCategory === "Rental").length;

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card">
          <div className="text-xs text-gray-500">Total Revenue</div>
          <div className="text-xl sm:text-2xl font-semibold">{mounted ? `₱${totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</div>
        </div>
        <div className="card"><div className="text-xs text-gray-500">Active Now</div><div className="text-xl sm:text-2xl font-semibold">+573</div></div>
        <div className="card"><div className="text-xs text-gray-500">Total Properties</div><div className="text-xl sm:text-2xl font-semibold">{listings.length}</div></div>
        <div className="card"><div className="text-xs text-gray-500">Properties for Sale</div><div className="text-xl sm:text-2xl font-semibold">{listings.filter((l:any)=> String(l.status || "") === "For Sale").length}</div></div>
        <div className="card"><div className="text-xs text-gray-500">Properties for Rent</div><div className="text-xl sm:text-2xl font-semibold">{listings.filter((l:any)=> String(l.status || "") === "For Rent").length}</div></div>
        <div className="card"><div className="text-xs text-gray-500">RFO Properties</div><div className="text-xl sm:text-2xl font-semibold">{listings.filter((l:any)=> String(l.status || "") === "RFO").length}</div></div>
        <div className="card"><div className="text-xs text-gray-500">Preselling Properties</div><div className="text-xl sm:text-2xl font-semibold">{listings.filter((l:any)=> String(l.status || "") === "Preselling").length}</div></div>
        <div className="card">
          <div className="text-xs text-gray-500">Total Units Rented</div>
          <div className="text-xl sm:text-2xl font-semibold">{totalRentalsCount}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">Total Project Sold</div>
          <div className="text-xl sm:text-2xl font-semibold">{totalSalesCount}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">Total No. of Sales</div>
          <div className="text-xl sm:text-2xl font-semibold">{totalSalesCount + totalRentalsCount}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <div className="font-semibold">My Properties</div>
            <Link href="/dashboard/properties" className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 rounded-md text-xs transition-colors">View All</Link>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Property</th>
                  <th className="text-left py-2">Price</th>
                  <th className="text-left py-2">Published</th>
                </tr>
              </thead>
              <tbody>
                {listings.slice(0,5).map((l:any)=> (
                  <tr key={l.id} className="border-t hover:bg-slate-50 transition-colors">
                    <td className="py-3 truncate max-w-[150px] font-medium">{l.title}</td>
                    <td className="py-3 whitespace-nowrap">{mounted ? `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0 })}` : ""}</td>
                    <td className="py-3 whitespace-nowrap">{mounted && l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-PH") : (mounted ? "-" : "")}</td>
                  </tr>
                ))}
                {listings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-500 italic">No properties found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <div className="font-semibold">Recent Sales</div>
            <Link href="/dashboard/sales" className="btn-blue px-3 py-1 text-xs">View All</Link>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Client</th>
                  <th className="text-left py-2">Property</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeSales.slice(0,5).map((s: any) => (
                  <tr key={s.id} className="border-t text-black hover:bg-slate-50 transition-colors">
                    <td className="py-3">
                      <div className="font-medium">{s.clientName}</div>
                      <div className="text-[10px] text-slate-500">{s.salesCategory || "Sale"}</div>
                    </td>
                    <td className="py-3 truncate max-w-[120px]">{s.listing?.title || "Direct Sale"}</td>
                    <td className="py-3 font-medium whitespace-nowrap">{mounted ? `₱${s.amount.toLocaleString("en-PH", { minimumFractionDigits: 0 })}` : ""}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                        s.status === "Closed" ? "bg-green-100 text-green-700" :
                        s.status === "Cancelled" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {activeSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500 italic">No recent sales.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
