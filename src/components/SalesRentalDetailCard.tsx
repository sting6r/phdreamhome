"use client";

import { useState, useEffect } from "react";
import * as Icons from "lucide-react";

interface SalesRentalDetailCardProps {
  sale?: any;
}

export default function SalesRentalDetailCard({ sale }: SalesRentalDetailCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [activeTab, setActiveTab] = useState<"Sale" | "Rental">(sale?.salesCategory === "Rental" ? "Rental" : "Sale");
  const [detailTab, setDetailTab] = useState<"Payment" | "Dues" | "Utilities" | "Financial">("Payment");

  if (!mounted) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center shadow-sm animate-pulse">
        <div className="bg-slate-50 w-12 h-12 rounded-full mx-auto mb-3"></div>
        <div className="h-4 bg-slate-100 w-32 mx-auto mb-2 rounded"></div>
        <div className="h-3 bg-slate-50 w-48 mx-auto rounded"></div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center shadow-sm">
        <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icons.Info className="text-slate-400" size={24} />
        </div>
        <h3 className="text-sm font-bold text-slate-800">No Record Selected</h3>
        <p className="text-xs text-slate-500 mt-1">Select a sale or rental record from the table above to view detailed information.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* Sidebar: Record Info */}
      <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 p-4 space-y-4">
        <div>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Icons.User size={12} /> Client Information
          </h3>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">{sale.clientName}</p>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Icons.Mail size={10} /> {sale.clientEmail || "N/A"}
            </p>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Icons.Phone size={10} /> {sale.clientPhone || "N/A"}
            </p>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Icons.MapPin size={10} /> {sale.clientAddress || "N/A"}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Icons.Home size={12} /> Property Detail
          </h3>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">{sale.listing?.title || "Custom Property"}</p>
            <p className="text-xs text-slate-600">Room No: <span className="font-medium text-slate-800">{sale.roomNo || "N/A"}</span></p>
            <p className="text-xs text-slate-600 leading-tight">{sale.listing?.location || "N/A"}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <div className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${
            sale.salesCategory === "Rental" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
          }`}>
            {sale.salesCategory || "Sale"} Record
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 flex items-center gap-1">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-900">
              <path d="M7 6h8a3 3 0 0 1 0 6H7" />
              <path d="M7 12h8a3 3 0 0 1 0 6H7" />
              <path d="M5 9h10" />
              <path d="M5 15h10" />
              <path d="M7 6v12" />
            </svg>
            {mounted ? (sale.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "..."}
          </div>
          <p className="text-[10px] text-slate-400">Total Contract Value</p>
        </div>
      </div>

      {/* Main Content: Tabs & Forms */}
      <div className="flex-1 flex flex-col min-h-[400px]">
        {/* Detail Tabs */}
        <div className="flex border-b border-slate-200 bg-white">
          {(["Payment", "Dues", "Utilities", "Financial"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDetailTab(tab)}
              className={`px-4 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                detailTab === tab 
                ? "border-blue-600 text-blue-600 bg-blue-50/30" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab === "Payment" && <Icons.Calendar size={14} />}
              {tab === "Dues" && <Icons.ClipboardList size={14} />}
              {tab === "Utilities" && <Icons.Zap size={14} />}
              {tab === "Financial" && <Icons.CreditCard size={14} />}
              {tab === "Payment" ? (sale.salesCategory === "Rental" ? "Rental Schedule" : "Payment") : 
               tab === "Financial" ? (sale.salesCategory === "Rental" ? "Deposit/Advance" : "Amortization") : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-5 overflow-y-auto">
          {detailTab === "Payment" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Payment Schedule</h4>
                <button className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                  <Icons.Plus size={12} /> Add Entry
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">2024-03-01</td>
                      <td className="px-3 py-2">{sale.salesCategory === "Rental" ? "Monthly Rent" : "Downpayment"}</td>
                      <td className="px-3 py-2 font-medium">{mounted ? `₱${(sale.amount / 10).toLocaleString()}` : "₱..."}</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[9px]">Pending</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detailTab === "Dues" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Association Dues & Maintenance</h4>
                <button className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                  <Icons.Plus size={12} /> Add Entry
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Monthly Dues</p>
                  <p className="text-sm font-bold text-slate-900">₱2,500.00</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Next Due Date</p>
                  <p className="text-sm font-bold text-slate-900">March 15, 2024</p>
                </div>
              </div>
            </div>
          )}

          {detailTab === "Utilities" && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800">Utility Monitoring</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Icons.Droplets size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Water Bill</p>
                    <p className="text-sm font-bold text-slate-900">₱450.00 <span className="text-[9px] font-normal text-slate-500">(Last Read)</span></p>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-yellow-100 bg-yellow-50/30 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                    <Icons.Zap size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Electric Bill</p>
                    <p className="text-sm font-bold text-slate-900">₱3,240.00 <span className="text-[9px] font-normal text-slate-500">(Last Read)</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailTab === "Financial" && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800">
                {sale.salesCategory === "Rental" ? "Security Deposit & Advance" : "Mortgage & Amortization"}
              </h4>
              <div className="space-y-3">
                <div className="p-4 bg-slate-900 text-white rounded-xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icons.CreditCard size={80} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {sale.salesCategory === "Rental" ? "Total Security Deposit" : "Remaining Balance"}
                  </p>
                  <p className="text-2xl font-black mt-1">
                    {mounted ? `₱${(sale.amount * (sale.salesCategory === "Rental" ? 0.2 : 0.8)).toLocaleString()}` : "₱..."}
                  </p>
                  <div className="mt-4 flex gap-4">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase">Interest Rate</p>
                      <p className="text-xs font-bold">{sale.salesCategory === "Rental" ? "N/A" : "5.5% p.a."}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase">Tenure</p>
                      <p className="text-xs font-bold">{sale.salesCategory === "Rental" ? "12 Months" : "15 Years"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button className="px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200 rounded transition-colors flex items-center gap-1">
            <Icons.Printer size={12} /> Print Statement
          </button>
          <button className="px-3 py-1.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1">
            <Icons.Save size={12} /> Update Records
          </button>
        </div>
      </div>
    </div>
  );
}
