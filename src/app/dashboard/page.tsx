"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

import { supabasePublic } from "@lib/supabase";

const visitorData = [
  { name: "Jan", visitors: 4500 },
  { name: "Feb", visitors: 5200 },
  { name: "Mar", visitors: 4800 },
  { name: "Apr", visitors: 6100 },
  { name: "May", visitors: 5900 },
  { name: "Jun", visitors: 7200 },
  { name: "Jul", visitors: 8100 },
  { name: "Aug", visitors: 7800 },
  { name: "Sep", visitors: 8500 },
  { name: "Oct", visitors: 9200 },
  { name: "Nov", visitors: 10500 },
  { name: "Dec", visitors: 12000 },
];

const salesReportData = [
  { name: "Jan", sales: 1250000 },
  { name: "Feb", sales: 2100000 },
  { name: "Mar", sales: 1800000 },
  { name: "Apr", sales: 3400000 },
  { name: "May", sales: 2900000 },
  { name: "Jun", sales: 4200000 },
  { name: "Jul", sales: 3800000 },
  { name: "Aug", sales: 5100000 },
  { name: "Sep", sales: 4600000 },
  { name: "Oct", sales: 6200000 },
  { name: "Nov", sales: 5800000 },
  { name: "Dec", sales: 8500000 },
];
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
  const { data: visitorReportData } = useSWR("/api/analytics/monthly-visitors", fetcher);
  
  const [mounted, setMounted] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);

  useEffect(() => { 
    setMounted(true); 
    // Simulate real-time visitor count with small random fluctuations
    const baseCount = 573;
    setVisitorCount(baseCount);
    
    const interval = setInterval(() => {
      setVisitorCount(prev => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = prev + change;
        return next < 500 ? 500 : next; // Keep it above 500
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);
  
  const listings = listingsData?.listings ?? [];
  const sales = Array.isArray(salesData) ? salesData : [];

  const totalRevenue = sales
    .filter((s: any) => s.status === "Closed")
    .reduce((acc: number, s: any) => acc + (s.amount || 0), 0);

  const activeSales = sales.filter((s: any) => s.status !== "Cancelled" && s.status !== "In Progress");
  const totalSalesCount = activeSales.filter((s: any) => s.salesCategory === "Sale" || !s.salesCategory).length;
  const totalRentalsCount = activeSales.filter((s: any) => s.salesCategory === "Rental").length;

  const safeVisitorReportData = Array.isArray(visitorReportData) ? visitorReportData : visitorData;

  // Calculate real sales data per month for the graph
  const currentYear = new Date().getFullYear();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const dynamicSalesReportData = months.map((monthName, index) => {
    const monthlyTotal = sales
      .filter((s: any) => {
        const date = s.saleDate ? new Date(s.saleDate) : new Date(s.createdAt);
        return date.getFullYear() === currentYear && date.getMonth() === index && s.status === "Closed";
      })
      .reduce((acc: number, s: any) => acc + (s.amount || 0), 0);
    
    return { name: monthName, sales: monthlyTotal };
  });

  // Use dynamic data if there are any closed sales, otherwise fallback to demo data for visual
  const finalSalesReportData = dynamicSalesReportData.some(d => d.sales > 0) 
    ? dynamicSalesReportData 
    : salesReportData;

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card">
          <div className="text-xs text-gray-500">Total Revenue</div>
          <div className="text-xl sm:text-2xl font-semibold">{mounted ? `₱${totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">Active Now</div>
          <div className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {mounted ? `+${visitorCount}` : ""}
          </div>
        </div>
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
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="font-semibold text-lg">Sales Report</div>
              <div className="text-xs text-gray-500">Total revenue generated by month</div>
            </div>
            <div className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              {currentYear} Revenue
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finalSalesReportData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#64748b'}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#64748b'}}
                  tickFormatter={(value) => `₱${value > 999999 ? (value/1000000).toFixed(1) + 'M' : (value/1000).toFixed(0) + 'k'}`}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => {
                    const numeric = typeof value === "number" ? value : Number(value ?? 0);
                    return [`₱${numeric.toLocaleString("en-PH")}`, "Total Sales"];
                  }}
                />
                <Bar 
                  dataKey="sales" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="font-semibold text-lg">Visitor Report</div>
              <div className="text-xs text-gray-500">Yearly website traffic overview</div>
            </div>
            <div className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
              2026 Data
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={safeVisitorReportData}>
                <defs>
                  <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#64748b'}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: '#64748b'}}
                  tickFormatter={(value) => `${value > 999 ? (value/1000).toFixed(1) + 'k' : value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#8b5cf6', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="visitors" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVis)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <div className="font-semibold">My Properties</div>
            <Link href="/dashboard/properties" className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 rounded-md text-xs transition-colors" prefetch={false}>View All</Link>
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
                {(Array.isArray(listings) ? listings : []).slice(0,5).map((l:any)=> (
                  <tr key={l.id} className="border-t hover:bg-slate-50 transition-colors">
                    <td className="py-3 truncate max-w-[150px] font-medium">{l.title}</td>
                    <td className="py-3 whitespace-nowrap">{mounted ? `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0 })}` : ""}</td>
                    <td className="py-3 whitespace-nowrap">{mounted && l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-PH") : (mounted ? "-" : "")}</td>
                  </tr>
                ))}
                {(!Array.isArray(listings) || listings.length === 0) && (
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
            <Link href="/dashboard/sales" className="btn-blue px-3 py-1 text-xs" prefetch={false}>View All</Link>
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
                {(Array.isArray(activeSales) ? activeSales : []).slice(0,5).map((s: any) => (
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
                {(!Array.isArray(activeSales) || activeSales.length === 0) && (
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
