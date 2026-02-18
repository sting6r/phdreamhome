"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import * as Icons from "lucide-react";
import { supabase } from "@lib/supabase";

interface SalesRentalDetailCardProps {
  sale?: any;
}

type PaymentEntry = { due: string; desc: string; amount: number; status: string; paidAt?: string; paymentMethod?: string };
type DuesEntry = { due: string; amount: number; status: string };
type UtilityEntry = { type: "Water" | "Electric"; date: string; amount: number; status?: string; note?: string; meterStart?: number; meterEnd?: number; rate?: number };

export default function SalesRentalDetailCard({ sale }: SalesRentalDetailCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [detailTab, setDetailTab] = useState<"Payment" | "Dues" | "Utilities" | "Financial">("Payment");
  const isRental = sale?.salesCategory === "Rental";
  useEffect(() => {
    if (!isRental && (detailTab === "Dues" || detailTab === "Utilities")) {
      setDetailTab("Payment");
    }
  }, [isRental, detailTab]);
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState<{ due: string; desc: string; amount: string; status: string }>({
    due: "",
    desc: isRental ? "Monthly Rent" : "Downpayment",
    amount: "",
    status: "Pending"
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ due: string; desc: string; amount: string; status: string }>({
    due: "",
    desc: "",
    amount: "",
    status: "Pending"
  });
  const [markingPaidIndex, setMarkingPaidIndex] = useState<number | null>(null);
  const [markingPaymentMethod, setMarkingPaymentMethod] = useState<string>("Cash");

  const [dues, setDues] = useState<DuesEntry[]>([]);
  const [showDuesAdd, setShowDuesAdd] = useState(false);
  const [duesNew, setDuesNew] = useState<{ due: string; amount: string; status: string }>({ due: "", amount: "", status: "Pending" });
  const [duesEditingIndex, setDuesEditingIndex] = useState<number | null>(null);
  const [duesEditing, setDuesEditing] = useState<{ due: string; amount: string; status: string }>({ due: "", amount: "", status: "Pending" });

  const [utilities, setUtilities] = useState<UtilityEntry[]>([]);
  const [showUtilAdd, setShowUtilAdd] = useState(false);
  const [utilNew, setUtilNew] = useState<{ type: "Water" | "Electric"; date: string; amount: string; status: string; note: string; meterStart: string; meterEnd: string; rate: string }>({
    type: "Water",
    date: "",
    amount: "",
    status: "Pending",
    note: "",
    meterStart: "",
    meterEnd: "",
    rate: ""
  });
  const [utilEditingIndex, setUtilEditingIndex] = useState<number | null>(null);
  const [utilEditing, setUtilEditing] = useState<{ type: "Water" | "Electric"; date: string; amount: string; status: string; note: string; meterStart: string; meterEnd: string; rate: string }>({
    type: "Water",
    date: "",
    amount: "",
    status: "Pending",
    note: "",
    meterStart: "",
    meterEnd: "",
    rate: ""
  });

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [utilScrollX, setUtilScrollX] = useState(0);
  const [utilScrollMax, setUtilScrollMax] = useState(0);
  const [utilYear, setUtilYear] = useState<number>(new Date().getFullYear());
  const [showUtilSummary, setShowUtilSummary] = useState(false);
  const [depositCfg, setDepositCfg] = useState<{ advanceMonths?: number; securityMonths?: number; advanceAmount?: number; securityAmount?: number }>({});
  const [meta, setMeta] = useState<{ roomNo?: string; floor?: string }>({});
  const rentalMonths = useMemo(() => {
    if (!isRental) return null;
    const rs = sale?.rentalStartDate ? new Date(sale.rentalStartDate) : null;
    const rd = sale?.rentalDueDate ? new Date(sale.rentalDueDate) : null;
    if (!rs || !rd) return null;
    if (isNaN(rs.getTime()) || isNaN(rd.getTime())) return null;
    const months = (rd.getFullYear() - rs.getFullYear()) * 12 + (rd.getMonth() - rs.getMonth()) + 1;
    if (months <= 0) return null;
    return months;
  }, [isRental, sale?.rentalStartDate, sale?.rentalDueDate]);
  const utilYears = useMemo(() => {
    const years = new Set<number>();
    utilities.forEach(u => {
      if (!u?.date) return;
      const dt = new Date(u.date);
      if (!isNaN(dt.getTime())) years.add(dt.getFullYear());
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [utilities]);
  useEffect(() => {
    const el = tableScrollRef.current;
    const recompute = () => {
      if (!el) return;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      setUtilScrollMax(max);
      setUtilScrollX(Math.min(el.scrollLeft, max));
    };
    recompute();
    if (!el) return;
    const onScroll = () => setUtilScrollX(el.scrollLeft);
    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", recompute);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recompute);
    };
  }, [utilities, showUtilAdd, utilEditingIndex]);

  const utilMonths = useMemo(() => {
    const arr: { key: string; label: string }[] = [];
    for (let m = 1; m <= 12; m++) {
      const dt = new Date(utilYear, m - 1, 1);
      const key = `${utilYear}-${String(m).padStart(2, "0")}`;
      const label = dt.toLocaleString("en-US", { month: "short", year: "numeric" });
      arr.push({ key, label });
    }
    return arr;
  }, [utilYear]);

  const utilTotals = useMemo(() => {
    const map: Record<string, { water: number; electric: number }> = {};
    utilMonths.forEach(({ key }) => {
      map[key] = { water: 0, electric: 0 };
    });
    utilities.forEach(u => {
      if (!u?.date) return;
      const dt = new Date(u.date);
      if (isNaN(dt.getTime())) return;
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}`;
      if (!map[key]) return;
      const amt = Number(u.amount) || 0;
      if (u.type === "Water") map[key].water += amt;
      if (u.type === "Electric") map[key].electric += amt;
    });
    return map;
  }, [utilities, utilMonths]);

  const now = new Date();
  const utilCurrentIndex = (() => {
    const idxs = utilMonths
      .map((m, i) => {
        const t = utilTotals[m.key] || { water: 0, electric: 0 };
        const sum = (t.water || 0) + (t.electric || 0);
        return { i, sum };
      })
      .filter(x => x.sum > 0)
      .map(x => x.i);
    if (idxs.length) return Math.max(...idxs);
    return utilYear === now.getFullYear() ? now.getMonth() : 11;
  })();
  const utilPreviousIndex = utilCurrentIndex > 0 ? (() => {
    for (let i = utilCurrentIndex - 1; i >= 0; i--) {
      const t = utilTotals[utilMonths[i].key] || { water: 0, electric: 0 };
      const sum = (t.water || 0) + (t.electric || 0);
      if (sum > 0) return i;
    }
    return utilCurrentIndex - 1;
  })() : -1;
  const utilCurrent = utilMonths[utilCurrentIndex];
  const utilPrevious = utilPreviousIndex >= 0 ? utilMonths[utilPreviousIndex] : undefined;
  const utilCurrTotals = utilCurrent ? (utilTotals[utilCurrent.key] || { water: 0, electric: 0 }) : { water: 0, electric: 0 };
  const utilPrevTotals = utilPrevious ? (utilTotals[utilPrevious.key] || { water: 0, electric: 0 }) : { water: 0, electric: 0 };

  useEffect(() => {
    const parseNotes = () => {
      const raw = sale?.notes;
      if (!raw) {
        setEntries([]);
        setDues([]);
        setUtilities([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const safe = parsed.map((p: any) => ({
            due: String(p?.due ?? ""),
            desc: String(p?.desc ?? ""),
            amount: Number(p?.amount ?? 0),
            status: String(p?.status ?? "Pending")
          })) as PaymentEntry[];
          setEntries(safe);
          setDues([]);
          setUtilities([]);
          setDepositCfg({});
          return;
        }
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.payments)) {
            const safeP = parsed.payments.map((p: any) => ({
              due: String(p?.due ?? ""),
              desc: String(p?.desc ?? ""),
              amount: Number(p?.amount ?? 0),
              status: String(p?.status ?? "Pending"),
              paidAt: typeof p?.paidAt === "string" ? p.paidAt : undefined,
              paymentMethod: typeof p?.paymentMethod === "string" ? p.paymentMethod : undefined
            })) as PaymentEntry[];
            setEntries(safeP);
          } else {
            setEntries([]);
          }
          if (Array.isArray(parsed.dues)) {
            const safeD = parsed.dues.map((d: any) => ({
              due: String(d?.due ?? ""),
              amount: Number(d?.amount ?? 0),
              status: String(d?.status ?? "Pending")
            })) as DuesEntry[];
            setDues(safeD);
          } else {
            setDues([]);
          }
          if (Array.isArray(parsed.utilities)) {
            const safeU = parsed.utilities.map((u: any) => ({
              type: (u?.type === "Electric" ? "Electric" : "Water") as "Water" | "Electric",
              date: String(u?.date ?? ""),
              amount: Number(u?.amount ?? 0),
              status: String(u?.status ?? "Pending"),
              note: typeof u?.note === "string" ? u.note : "",
              meterStart: typeof u?.meterStart === "number" ? u.meterStart : (typeof u?.meterStart === "string" ? parseFloat(u.meterStart) : undefined),
              meterEnd: typeof u?.meterEnd === "number" ? u.meterEnd : (typeof u?.meterEnd === "string" ? parseFloat(u.meterEnd) : undefined),
              rate: typeof u?.rate === "number" ? u.rate : (typeof u?.rate === "string" ? parseFloat(u.rate) : undefined)
            })) as UtilityEntry[];
            setUtilities(safeU);
          } else {
            setUtilities([]);
          }
          if (parsed.deposits && typeof parsed.deposits === "object") {
            const advM = Number((parsed.deposits as any).advanceMonths);
            const secM = Number((parsed.deposits as any).securityMonths);
            const advA = Number((parsed.deposits as any).advanceAmount);
            const secA = Number((parsed.deposits as any).securityAmount);
            const out: any = {};
            if (!Number.isNaN(advM) && advM >= 0) out.advanceMonths = advM;
            if (!Number.isNaN(secM) && secM >= 0) out.securityMonths = secM;
            if (!Number.isNaN(advA) && advA >= 0) out.advanceAmount = advA;
            if (!Number.isNaN(secA) && secA >= 0) out.securityAmount = secA;
            setDepositCfg(out);
          } else {
            setDepositCfg({});
          }
          if (parsed.meta && typeof parsed.meta === "object") {
            const out: any = {};
            if (typeof (parsed.meta as any).roomNo === "string") out.roomNo = (parsed.meta as any).roomNo;
            if (typeof (parsed.meta as any).floor === "string") out.floor = (parsed.meta as any).floor;
            setMeta(out);
          } else {
            setMeta({});
          }
          return;
        }
        setEntries([]);
        setDues([]);
        setUtilities([]);
        setDepositCfg({});
        setMeta({});
      } catch {
        setEntries([]);
        setDues([]);
        setUtilities([]);
        setDepositCfg({});
        setMeta({});
      }
    };
    parseNotes();
    setShowAdd(false);
    setNewEntry({
      due: "",
      desc: isRental ? "Monthly Rent" : "Downpayment",
      amount: "",
      status: "Pending"
    });
    setShowDuesAdd(false);
    setDuesNew({ due: "", amount: "", status: "Pending" });
    setDuesEditingIndex(null);
    setDuesEditing({ due: "", amount: "", status: "Pending" });
    setShowUtilAdd(false);
    setUtilNew({ type: "Water", date: "", amount: "", status: "Pending", note: "", meterStart: "", meterEnd: "", rate: "" });
    setUtilEditingIndex(null);
    setUtilEditing({ type: "Water", date: "", amount: "", status: "Pending", note: "", meterStart: "", meterEnd: "", rate: "" });
  }, [sale?.id, sale?.notes, isRental]);

  function formatMDY(s: string) {
    if (!s) return "N/A";
    if (s === "N/A") return s;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${m[2]}-${m[3]}-${m[1]}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${mm}-${dd}-${yyyy}`;
    }
    return String(s);
  }

  const scheduleRows: Array<{ due: string; desc: string; amount: number }> = entries.length
    ? entries.map(e => ({ due: e.due, desc: e.desc, amount: e.amount }))
    : [
        {
          due: "N/A",
          desc: isRental ? "Monthly Rent" : "Downpayment",
          amount: isRental ? (sale?.amount || 0) : ((sale?.amount || 0) / 10)
        }
      ];

  async function saveEntry() {
    if (!sale?.id) return;
    const amt = parseFloat(newEntry.amount.replace(/,/g, ""));
    if (!newEntry.due || isNaN(amt)) return;
    const updated = [...entries, { due: newEntry.due, desc: newEntry.desc || (isRental ? "Monthly Rent" : "Downpayment"), amount: amt, status: newEntry.status || "Pending" }];
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ paymentEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setEntries(updated);
          setShowAdd(false);
          setNewEntry({ due: "", desc: isRental ? "Monthly Rent" : "Downpayment", amount: "", status: "Pending" });
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  function startEdit(i: number) {
    if (!entries[i]) return;
    const e = entries[i];
    setEditingIndex(i);
    setEditingEntry({
      due: e.due || "",
      desc: e.desc || "",
      amount: String(e.amount ?? ""),
      status: e.status || "Pending"
    });
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditingEntry({ due: "", desc: "", amount: "", status: "Pending" });
  }

  async function applyEdit() {
    if (editingIndex === null || !sale?.id) return;
    const amt = parseFloat(editingEntry.amount.replace(/,/g, ""));
    if (!editingEntry.due || isNaN(amt)) return;
    const updated = entries.map((e, i) => i === editingIndex ? ({ ...e, due: editingEntry.due, desc: editingEntry.desc, amount: amt, status: editingEntry.status }) : e);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ paymentEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setEntries(updated);
          cancelEdit();
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  async function deleteEntry(i: number) {
    if (!sale?.id) return;
    const updated = entries.filter((_, idx) => idx !== i);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ paymentEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setEntries(updated);
          if (editingIndex !== null && i === editingIndex) cancelEdit();
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  async function updateRecords() {
    if (!sale?.id) return;
    let payload = entries;
    if (editingIndex !== null) {
      const amt = parseFloat(editingEntry.amount.replace(/,/g, ""));
      if (!editingEntry.due || isNaN(amt)) {
        alert("Please complete the editing fields before updating.");
        return;
      }
      payload = entries.map((e, i) =>
        i === editingIndex
          ? { due: editingEntry.due, desc: editingEntry.desc || (isRental ? "Monthly Rent" : "Downpayment"), amount: amt, status: editingEntry.status || "Pending" }
          : e
      );
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ paymentEntries: payload }),
          signal: controller.signal
        });
        if (res.ok) {
          setEntries(payload);
          cancelEdit();
          alert(isRental ? "Update Records on Rental Data is Successful." : (detailTab === "Dues" ? "Dues are successfully updated" : "Payment schedule is successfully updated"));
        }
      } finally {
        clearTimeout(t);
      }
    } catch {
      alert("Payment Schedule update failed");
    }
  }

  async function markPaid(i: number, method: string) {
    if (!sale?.id) return;
    const updated = entries.map((e, idx) => idx === i ? { ...e, status: "Paid", paidAt: new Date().toISOString(), paymentMethod: method } : e);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ paymentEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setEntries(updated);
          setMarkingPaidIndex(null);
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  function cancelMarkPaid() {
    setMarkingPaidIndex(null);
    setMarkingPaymentMethod("Cash");
  }

  async function confirmMarkPaid() {
    if (markingPaidIndex === null) return;
    await markPaid(markingPaidIndex, markingPaymentMethod);
  }

  function printStatement() {
    const rows = (entries.length ? entries : scheduleRows).map(r => ({
      due: formatMDY(r.due),
      desc: (r as any).desc || (isRental ? "Monthly Rent" : "Downpayment"),
      amount: `₱${Number(r.amount).toLocaleString()}`,
      status: (r as any).status || "Pending",
      paidAt: (r as any).paidAt,
      paymentMethod: (r as any).paymentMethod
    }));
    const total = entries.length ? entries.reduce((s, e) => s + (Number(e.amount) || 0), 0) : (scheduleRows.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const duesRows = dues.map(d => ({
      due: formatMDY(d.due),
      amount: `₱${Number(d.amount).toLocaleString()}`,
      status: d.status || "Pending"
    }));
    const duesTotal = dues.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const utilitiesRows = utilities.map(u => {
      const hasStart = typeof u.meterStart === "number" && !isNaN(u.meterStart);
      const hasEnd = typeof u.meterEnd === "number" && !isNaN(u.meterEnd);
      const usage = hasStart && hasEnd ? (u.meterEnd! - u.meterStart!) : null;
      const rateDisplay = typeof u.rate === "number" && isFinite(u.rate) ? `₱${Number(u.rate).toLocaleString()} / ${u.type === "Water" ? "m³" : "kWh"}` : "";
      return {
        type: u.type,
        date: formatMDY(u.date),
        start: u.meterStart != null ? String(u.meterStart) : "",
        end: u.meterEnd != null ? String(u.meterEnd) : "",
        usage: usage != null && isFinite(usage) ? String(usage) : "",
        rate: rateDisplay,
        amount: `₱${Number(u.amount).toLocaleString()}`,
        note: u.note || ""
      };
    });
    const financialTitle = sale?.salesCategory === "Rental" ? "Security Deposit & Advance" : "Mortgage & Amortization";
    const financialAmount = sale?.salesCategory === "Rental" ? (Number(sale?.amount) * 0.2) : (Number(sale?.amount) * 0.8);
    const utilWaterTotal = utilities.reduce((s, u) => s + (u.type === "Water" ? (Number(u.amount) || 0) : 0), 0);
    const utilElectricTotal = utilities.reduce((s, u) => s + (u.type === "Electric" ? (Number(u.amount) || 0) : 0), 0);
    const utilTotal = utilWaterTotal + utilElectricTotal;
    const html = `
      <html>
        <head>
          <title>Statement</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 18px; margin: 0 0 8px; }
            h2 { font-size: 14px; margin: 0 0 16px; color: #475569; }
            h3 { font-size: 13px; margin: 24px 0 8px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            th { background: #f8fafc; color: #64748b; }
            tfoot td { font-weight: 700; background: #f1f5f9; }
            .right { text-align: right; }
            .muted { color: #64748b; font-size: 11px; }
            .section { page-break-inside: avoid; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <h1>Statement</h1>
          <h2>${sale?.clientName || ""} — ${sale?.listing?.title || "Custom Property"}</h2>
          <div class="section">
            <h3>Rental Schedule</h3>
            <table>
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th>Description</th>
                  <th class="right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => {
                  const extra = r.status === "Paid"
                    ? `${r.paymentMethod ? ` (${r.paymentMethod})` : ""}${r.paidAt ? ` — <span class='muted'>${formatMDY(r.paidAt)}</span>` : ""}`
                    : "";
                  return `<tr><td>${r.due}</td><td>${r.desc}</td><td class="right">${r.amount}</td><td>${r.status}${extra}</td></tr>`;
                }).join("")}
              </tbody>
              <tfoot>
                <tr><td colspan="2">Total</td><td class="right">₱${Number(total).toLocaleString()}</td><td></td></tr>
              </tfoot>
            </table>
          </div>
          <div class="section">
            <h3>Association Dues</h3>
            <table>
              <thead>
                <tr>
                  <th>Next Due Date</th>
                  <th class="right">Monthly Dues</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${duesRows.length ? duesRows.map(d => `<tr><td>${d.due}</td><td class="right">${d.amount}</td><td>${d.status}</td></tr>`).join("") : `<tr><td colspan="3">No dues entries</td></tr>`}
              </tbody>
              ${duesRows.length ? `<tfoot><tr><td>Total</td><td class="right">₱${Number(duesTotal).toLocaleString()}</td><td></td></tr></tfoot>` : ``}
            </table>
          </div>
          <div class="section">
            <h3>Utilities</h3>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Start Read</th>
                  <th>End Read</th>
                  <th>Usage</th>
                  <th>Rate</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${utilitiesRows.length ? utilitiesRows.map(u => `<tr><td>${u.type}</td><td>${u.date}</td><td>${u.start}</td><td>${u.end}</td><td>${u.usage}</td><td>${u.rate}</td><td class="right">${u.amount}</td></tr>`).join("") : `<tr><td colspan="7">No utilities recorded</td></tr>`}
              </tbody>
              ${utilitiesRows.length ? `
              <tfoot>
                <tr><td colspan="6">Water Total</td><td class="right">₱${Number(utilWaterTotal).toLocaleString()}</td></tr>
                <tr><td colspan="6">Electric Total</td><td class="right">₱${Number(utilElectricTotal).toLocaleString()}</td></tr>
                <tr><td colspan="6">Total Utilities</td><td class="right">₱${Number(utilTotal).toLocaleString()}</td></tr>
              </tfoot>
              ` : ``}
            </table>
          </div>
          <div class="section">
            <h3>${financialTitle}</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>${financialTitle}</td><td class="right">₱${Number(financialAmount || 0).toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>`;
    const w = window.open("", "_blank", "width=800,height=600");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  }

  async function saveUtilityEntry() {
    if (!sale?.id) return;
    const amt = parseFloat(utilNew.amount.replace(/,/g, ""));
    const ms = utilNew.meterStart !== "" ? parseFloat(utilNew.meterStart.replace(/,/g, "")) : NaN;
    const me = utilNew.meterEnd !== "" ? parseFloat(utilNew.meterEnd.replace(/,/g, "")) : NaN;
    const rate = utilNew.rate !== "" ? parseFloat(utilNew.rate.replace(/,/g, "")) : NaN;
    if (!utilNew.date || isNaN(amt)) return;
    let computedAmount = amt;
    if (!isNaN(ms) && !isNaN(me) && !isNaN(rate)) {
      const usage = me - ms;
      if (isFinite(usage)) {
        computedAmount = usage * rate;
      }
    }
    const updated = [...utilities, { type: utilNew.type, date: utilNew.date, amount: computedAmount, status: utilNew.status || "Pending", note: utilNew.note || "", meterStart: isNaN(ms) ? undefined : ms, meterEnd: isNaN(me) ? undefined : me, rate: isNaN(rate) ? undefined : rate }];
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ utilitiesEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setUtilities(updated);
          setShowUtilAdd(false);
          setUtilNew({ type: "Water", date: "", amount: "", status: "Pending", note: "", meterStart: "", meterEnd: "", rate: "" });
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  function startUtilityEdit(i: number) {
    if (!utilities[i]) return;
    const u = utilities[i];
    setUtilEditingIndex(i);
    setUtilEditing({ type: u.type, date: u.date || "", amount: String(u.amount ?? ""), status: (u.status as string) || "Pending", note: u.note || "", meterStart: u.meterStart !== undefined ? String(u.meterStart) : "", meterEnd: u.meterEnd !== undefined ? String(u.meterEnd) : "", rate: u.rate !== undefined ? String(u.rate) : "" } as any);
  }

  function cancelUtilityEdit() {
    setUtilEditingIndex(null);
    setUtilEditing({ type: "Water", date: "", amount: "", status: "Pending", note: "", meterStart: "", meterEnd: "", rate: "" } as any);
  }

  async function applyUtilityEdit() {
    if (utilEditingIndex === null || !sale?.id) return;
    const amt = parseFloat((utilEditing as any).amount.replace(/,/g, ""));
    const ms = (utilEditing as any).meterStart !== "" ? parseFloat((utilEditing as any).meterStart.replace(/,/g, "")) : NaN;
    const me = (utilEditing as any).meterEnd !== "" ? parseFloat((utilEditing as any).meterEnd.replace(/,/g, "")) : NaN;
    const rate = (utilEditing as any).rate !== "" ? parseFloat((utilEditing as any).rate.replace(/,/g, "")) : NaN;
    if (!utilEditing.date || isNaN(amt)) return;
    let computedAmount = amt;
    if (!isNaN(ms) && !isNaN(me) && !isNaN(rate)) {
      const usage = me - ms;
      if (isFinite(usage)) {
        computedAmount = usage * rate;
      }
    }
    const updated = utilities.map((u, i) => i === utilEditingIndex ? ({ type: utilEditing.type, date: utilEditing.date, amount: computedAmount, status: utilEditing.status || "Pending", note: utilEditing.note || "", meterStart: isNaN(ms) ? undefined : ms, meterEnd: isNaN(me) ? undefined : me, rate: isNaN(rate) ? undefined : rate }) : u);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ utilitiesEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setUtilities(updated);
          cancelUtilityEdit();
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  async function deleteUtilityEntry(i: number) {
    if (!sale?.id) return;
    const updated = utilities.filter((_, idx) => idx !== i);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ utilitiesEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setUtilities(updated);
          if (utilEditingIndex !== null && i === utilEditingIndex) cancelUtilityEdit();
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  async function saveDuesEntry() {
    if (!sale?.id) return;
    const amt = parseFloat(duesNew.amount.replace(/,/g, ""));
    if (!duesNew.due || isNaN(amt)) return;
    const updated = [...dues, { due: duesNew.due, amount: amt, status: duesNew.status || "Pending" }];
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ duesEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setDues(updated);
          setShowDuesAdd(false);
          setDuesNew({ due: "", amount: "", status: "Pending" });
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  function startDuesEdit(i: number) {
    if (!dues[i]) return;
    const d = dues[i];
    setDuesEditingIndex(i);
    setDuesEditing({ due: d.due || "", amount: String(d.amount ?? ""), status: d.status || "Pending" });
  }

  function cancelDuesEdit() {
    setDuesEditingIndex(null);
    setDuesEditing({ due: "", amount: "", status: "Pending" });
  }

  async function applyDuesEdit() {
    if (duesEditingIndex === null || !sale?.id) return;
    const amt = parseFloat(duesEditing.amount.replace(/,/g, ""));
    if (!duesEditing.due || isNaN(amt)) return;
    const updated = dues.map((d, i) => i === duesEditingIndex ? ({ due: duesEditing.due, amount: amt, status: duesEditing.status || "Pending" }) : d);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ duesEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setDues(updated);
          cancelDuesEdit();
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

  async function deleteDuesEntry(i: number) {
    if (!sale?.id) return;
    const updated = dues.filter((_, idx) => idx !== i);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ duesEntries: updated }),
          signal: controller.signal
        });
        if (res.ok) {
          setDues(updated);
          if (duesEditingIndex !== null && i === duesEditingIndex) cancelDuesEdit();
        }
      } finally {
        clearTimeout(t);
      }
    } catch {}
  }

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
      <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 p-4 space-y-4">
        <div>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Icons.User size={12} /> Client Information
          </h3>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">{sale.clientName}</p>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Icons.MapPin size={10} /> {(() => {
                const l = sale.listing;
                if (l) {
                  const cityCountry = [l.city, l.country].filter(Boolean).join(", ");
                  const primary = cityCountry || l.address;
                  return primary || sale.clientAddress || "N/A";
                }
                return sale.clientAddress || "N/A";
              })()}
            </p>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Icons.Mail size={10} /> {sale.clientEmail || "N/A"}
            </p>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Icons.Phone size={10} /> {sale.clientPhone || "N/A"}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Icons.Home size={12} /> Property Detail
          </h3>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">{sale.listing?.title || "Custom Property"}</p>
            <p className="text-xs text-slate-600 leading-tight">Address:</p>
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                {(() => {
                  const l = sale.listing;
                  if (!l) return "N/A";
                  return l.address || "N/A";
                })()}
              </span>
            </p>
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                {(() => {
                  const l = sale.listing;
                  if (!l) return "N/A";
                  const parts = [l.city, l.country].filter(Boolean).join(", ");
                  return parts || "N/A";
                })()}
              </span>
            </p>
            <p className="text-xs text-slate-600">Room No: <span className="font-medium text-slate-800">{(meta.roomNo || sale.roomNo) || "N/A"}</span></p>
            <p className="text-xs text-slate-600">Floor: <span className="font-medium text-slate-800">{(meta.floor || sale.floor) || "N/A"}</span></p>
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
            {mounted ? (() => {
              const monthly = Number(sale?.amount || 0);
              if (isRental) {
                const mos = typeof rentalMonths === "number" && rentalMonths > 0 ? rentalMonths : 1;
                return (monthly * mos).toLocaleString("en-PH", { minimumFractionDigits: 2 });
              }
              return monthly.toLocaleString("en-PH", { minimumFractionDigits: 2 });
            })() : "..."}
          </div>
          <p className="text-[10px] text-slate-400">Total Contract Value</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-[400px]">
        <div className="flex border-b border-slate-200 bg-white">
          {(["Payment", "Dues", "Utilities", "Financial"] as const)
            .filter(tab => {
              if (!isRental) {
                return tab !== "Dues" && tab !== "Utilities";
              }
              return true;
            })
            .map((tab) => (
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

        <div className="flex-1 p-5 overflow-y-auto min-h-0">
          {detailTab === "Payment" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Payment Schedule</h4>
                <button
                  onClick={() => setShowAdd(s => !s)}
                  disabled={!sale?.id}
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Icons.Plus size={12} /> Add Entry
                </button>
              </div>
              {showAdd && (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 min-w-0">
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="date"
                      value={newEntry.due}
                      onChange={(e) => setNewEntry({ ...newEntry, due: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-2 min-w-0">
                    <input
                      type="text"
                      value={newEntry.desc}
                      onChange={(e) => setNewEntry({ ...newEntry, desc: e.target.value })}
                      placeholder={isRental ? "Monthly Rent" : "Downpayment"}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="text"
                      value={newEntry.amount}
                      onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-1 flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                    <select
                      value={newEntry.status}
                      onChange={(e) => setNewEntry({ ...newEntry, status: e.target.value })}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-full sm:w-auto"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                    <button
                      onClick={saveEntry}
                      className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded w-full sm:w-auto"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-3 py-2 whitespace-nowrap">Due Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 whitespace-nowrap">Amount</th>
                      <th className="px-3 py-2 whitespace-nowrap">Status</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[110px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(entries.length ? entries : scheduleRows).map((row: any, idx: number) => {
                      const isEditing = entries.length > 0 && editingIndex === idx;
                      return (
                        <tr key={`${row.due}-${idx}`} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <input
                                type="date"
                                value={editingEntry.due}
                                onChange={(e) => setEditingEntry({ ...editingEntry, due: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                              />
                            ) : (
                              formatMDY(row.due)
                            )}
                          </td>
                          <td className="px-3 py-2 align-middle break-words">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingEntry.desc}
                                onChange={(e) => setEditingEntry({ ...editingEntry, desc: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-full"
                              />
                            ) : (
                              row.desc
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap align-middle">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingEntry.amount}
                                onChange={(e) => setEditingEntry({ ...editingEntry, amount: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-24"
                              />
                            ) : (
                              mounted ? `₱${Number(row.amount).toLocaleString()}` : "₱..."
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <select
                                value={editingEntry.status}
                                onChange={(e) => setEditingEntry({ ...editingEntry, status: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                                <option value="Overdue">Overdue</option>
                              </select>
                            ) : (
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                                (row.status || "Pending") === "Paid" ? "bg-green-100 text-green-700" :
                                (row.status || "Pending") === "Overdue" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                                {row.status || "Pending"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap align-middle w-[200px]">
                            {entries.length > 0 ? (
                              isEditing ? (
                                <div className="flex justify-end gap-1">
                                  <button onClick={applyEdit} className="p-1 rounded text-green-700 hover:bg-green-50">
                                    <Icons.Check size={14} />
                                  </button>
                                  <button onClick={cancelEdit} className="p-1 rounded text-slate-600 hover:bg-slate-100">
                                    <Icons.X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1 items-center">
                                  {markingPaidIndex === idx ? (
                                    <>
                                      <select
                                        value={markingPaymentMethod}
                                        onChange={(e) => setMarkingPaymentMethod(e.target.value)}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                                      >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="GCash">GCash</option>
                                        <option value="Check">Check</option>
                                        <option value="Online">Online</option>
                                        <option value="Manual">Manual</option>
                                      </select>
                                      <button onClick={confirmMarkPaid} className="p-1 rounded text-green-700 hover:bg-green-50">
                                        <Icons.Check size={14} />
                                      </button>
                                      <button onClick={cancelMarkPaid} className="p-1 rounded text-slate-600 hover:bg-slate-100">
                                        <Icons.X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => { setMarkingPaidIndex(idx); setMarkingPaymentMethod("Cash"); }} className="p-1 rounded text-green-700 hover:bg-green-50">
                                        <Icons.CheckCircle size={14} />
                                      </button>
                                      <button onClick={() => startEdit(idx)} className="p-1 rounded text-blue-600 hover:bg-blue-50">
                                        <Icons.Pencil size={14} />
                                      </button>
                                      <button onClick={() => deleteEntry(idx)} className="p-1 rounded text-red-600 hover:bg-red-50">
                                        <Icons.Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {entries.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-3 py-2" colSpan={2}>Total</td>
                        <td className="px-3 py-2">
                          {mounted ? `₱${entries.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}` : "₱..."}
                        </td>
                        <td className="px-3 py-2" colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {detailTab === "Dues" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Association Dues & Maintenance</h4>
                <button
                  onClick={() => setShowDuesAdd(s => !s)}
                  disabled={!sale?.id}
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Icons.Plus size={12} /> Add Entry
                </button>
              </div>
              {showDuesAdd && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 min-w-0">
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="date"
                      value={duesNew.due}
                      onChange={(e) => setDuesNew({ ...duesNew, due: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="text"
                      value={duesNew.amount}
                      onChange={(e) => setDuesNew({ ...duesNew, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <select
                      value={duesNew.status}
                      onChange={(e) => setDuesNew({ ...duesNew, status: e.target.value })}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-full sm:w-auto"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1 flex items-center gap-2 min-w-0">
                    <button
                      onClick={saveDuesEntry}
                      className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded w-full sm:w-auto"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-3 py-2 whitespace-nowrap">Next Due Date</th>
                      <th className="px-3 py-2 whitespace-nowrap">Monthly Dues</th>
                      <th className="px-3 py-2 whitespace-nowrap">Status</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[110px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dues.map((row, idx) => {
                      const isEditing = duesEditingIndex === idx;
                      return (
                        <tr key={`${row.due}-${idx}`} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <input
                                type="date"
                                value={duesEditing.due}
                                onChange={(e) => setDuesEditing({ ...duesEditing, due: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                              />
                            ) : (
                              formatMDY(row.due)
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap align-middle">
                            {isEditing ? (
                              <input
                                type="text"
                                value={duesEditing.amount}
                                onChange={(e) => setDuesEditing({ ...duesEditing, amount: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-24"
                              />
                            ) : (
                              mounted ? `₱${Number(row.amount).toLocaleString()}` : "₱..."
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <select
                                value={duesEditing.status}
                                onChange={(e) => setDuesEditing({ ...duesEditing, status: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                                <option value="Overdue">Overdue</option>
                              </select>
                            ) : (
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                                (row.status || "Pending") === "Paid" ? "bg-green-100 text-green-700" :
                                (row.status || "Pending") === "Overdue" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                                {row.status || "Pending"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap align-middle w-[110px]">
                            {isEditing ? (
                              <div className="flex justify-end gap-1">
                                <button onClick={applyDuesEdit} className="p-1 rounded text-green-700 hover:bg-green-50">
                                  <Icons.Check size={14} />
                                </button>
                                <button onClick={cancelDuesEdit} className="p-1 rounded text-slate-600 hover:bg-slate-100">
                                  <Icons.X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => startDuesEdit(idx)} className="p-1 rounded text-blue-600 hover:bg-blue-50">
                                  <Icons.Pencil size={14} />
                                </button>
                                <button onClick={() => deleteDuesEntry(idx)} className="p-1 rounded text-red-600 hover:bg-red-50">
                                  <Icons.Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {dues.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-3 py-2" colSpan={1}>Total</td>
                        <td className="px-3 py-2">
                          {mounted ? `₱${dues.reduce((s, d) => s + (Number(d.amount) || 0), 0).toLocaleString()}` : "₱..."}
                        </td>
                        <td className="px-3 py-2" colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {detailTab === "Utilities" && (
            <div className="space-y-4">
              <div className="flex items-center">
                <h4 className="text-sm font-bold text-slate-800">Utility Monitoring</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-3 border border-slate-200 rounded-lg bg-white">
                  <div className="text-[10px] font-bold text-slate-500">Present Bill</div>
                  <div className="mt-1 text-xs font-bold text-slate-900">{utilCurrent?.label || ""}</div>
                  <div className="mt-1 text-[11px] text-slate-700">Water: {mounted ? `₱${utilCurrTotals.water.toLocaleString()}` : "₱..."}</div>
                  <div className="text-[11px] text-slate-700">Electric: {mounted ? `₱${utilCurrTotals.electric.toLocaleString()}` : "₱..."}</div>
                  <div className="mt-1 text-sm font-black text-slate-900">Total: {mounted ? `₱${(utilCurrTotals.water + utilCurrTotals.electric).toLocaleString()}` : "₱..."}</div>
                </div>
                <div className="p-3 border border-slate-200 rounded-lg bg-white">
                  <div className="text-[10px] font-bold text-slate-500">Previous Month</div>
                  <div className="mt-1 text-xs font-bold text-slate-900">{utilPrevious?.label || ""}</div>
                  <div className="mt-1 text-[11px] text-slate-700">Water: {mounted ? `₱${utilPrevTotals.water.toLocaleString()}` : "₱..."}</div>
                  <div className="text-[11px] text-slate-700">Electric: {mounted ? `₱${utilPrevTotals.electric.toLocaleString()}` : "₱..."}</div>
                  <div className="mt-1 text-sm font-black text-slate-900">Total: {mounted ? `₱${(utilPrevTotals.water + utilPrevTotals.electric).toLocaleString()}` : "₱..."}</div>
                </div>
              </div>
              <div className="flex justify-end items-center">
                <button
                  onClick={() => setShowUtilAdd(s => !s)}
                  disabled={!sale?.id}
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Icons.Plus size={12} /> Add Entry
                </button>
              </div>
              {showUtilAdd && (
                <div className="grid grid-cols-1 sm:grid-cols-9 gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 min-w-0">
                  <div className="sm:col-span-1 min-w-0">
                    <select
                      value={utilNew.type}
                      onChange={(e) => setUtilNew({ ...utilNew, type: e.target.value as any })}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-full"
                    >
                      <option value="Water">Water</option>
                      <option value="Electric">Electric</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="date"
                      value={utilNew.date}
                      onChange={(e) => setUtilNew({ ...utilNew, date: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={utilNew.meterStart}
                      onChange={(e) => {
                        const meterStart = e.target.value;
                        const ms = parseFloat(meterStart.replace(/,/g, ""));
                        const me = utilNew.meterEnd !== "" ? parseFloat(utilNew.meterEnd.replace(/,/g, "")) : NaN;
                        const r = utilNew.rate !== "" ? parseFloat(utilNew.rate.replace(/,/g, "")) : NaN;
                        let amount = utilNew.amount;
                        if (!isNaN(ms) && !isNaN(me) && !isNaN(r)) {
                          const usage = me - ms;
                          if (isFinite(usage)) amount = String(usage * r);
                        }
                        setUtilNew({ ...utilNew, meterStart, amount });
                      }}
                      placeholder="Start read"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-14 text-right"
                    />
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={utilNew.meterEnd}
                      onChange={(e) => {
                        const meterEnd = e.target.value;
                        const me = parseFloat(meterEnd.replace(/,/g, ""));
                        const ms = utilNew.meterStart !== "" ? parseFloat(utilNew.meterStart.replace(/,/g, "")) : NaN;
                        const r = utilNew.rate !== "" ? parseFloat(utilNew.rate.replace(/,/g, "")) : NaN;
                        let amount = utilNew.amount;
                        if (!isNaN(ms) && !isNaN(me) && !isNaN(r)) {
                          const usage = me - ms;
                          if (isFinite(usage)) amount = String(usage * r);
                        }
                        setUtilNew({ ...utilNew, meterEnd, amount });
                      }}
                      placeholder="End read"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-14 text-right"
                    />
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="text"
                      value={utilNew.rate}
                      onChange={(e) => {
                        const rate = e.target.value;
                        const r = parseFloat(rate.replace(/,/g, ""));
                        const ms = utilNew.meterStart !== "" ? parseFloat(utilNew.meterStart.replace(/,/g, "")) : NaN;
                        const me = utilNew.meterEnd !== "" ? parseFloat(utilNew.meterEnd.replace(/,/g, "")) : NaN;
                        let amount = utilNew.amount;
                        if (!isNaN(ms) && !isNaN(me) && !isNaN(r)) {
                          const usage = me - ms;
                          if (isFinite(usage)) amount = String(usage * r);
                        }
                        setUtilNew({ ...utilNew, rate, amount });
                      }}
                      placeholder="Rate per unit"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-1 min-w-0">
                    <input
                      type="text"
                      value={utilNew.amount}
                      onChange={(e) => setUtilNew({ ...utilNew, amount: e.target.value })}
                      readOnly={Boolean((utilNew.rate || "").trim())}
                      placeholder="0.00"
                      className={`w-full rounded border border-slate-300 px-2 py-1 text-[10px] h-[22px] ${Boolean((utilNew.rate || "").trim()) ? "bg-slate-100 cursor-not-allowed" : "bg-white"}`}
                    />
                  </div>
                  <div className="sm:col-span-3 min-w-0">
                    <input
                      type="text"
                      value={utilNew.note}
                      onChange={(e) => setUtilNew({ ...utilNew, note: e.target.value })}
                      placeholder="Optional note"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                    />
                  </div>
                  <div className="sm:col-span-6 flex items-center gap-2 min-w-0">
                    <button
                      onClick={saveUtilityEntry}
                      className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded w-full sm:w-auto"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              <div ref={tableScrollRef} className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full w-full table-fixed text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-2 py-2 whitespace-nowrap w-20">Type</th>
                      <th className="px-2 py-2 whitespace-nowrap w-24">Date</th>
                      <th className="px-1 py-2 whitespace-nowrap w-14">Start</th>
                      <th className="px-1 py-2 whitespace-nowrap w-14">End</th>
                      <th className="px-2 py-2 whitespace-nowrap w-20">Usage</th>
                      <th className="px-2 py-2 whitespace-nowrap w-16">Rate</th>
                      <th className="px-2 py-2 whitespace-nowrap w-20">Amount</th>
                      <th className="px-2 py-2 whitespace-nowrap w-16">Status</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap w-[88px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {utilities.map((row, idx) => {
                      const isEditing = utilEditingIndex === idx;
                      return (
                        <tr key={`${row.type}-${row.date}-${idx}`} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <select
                                value={utilEditing.type}
                                onChange={(e) => setUtilEditing({ ...utilEditing, type: e.target.value as any })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                              >
                                <option value="Water">Water</option>
                                <option value="Electric">Electric</option>
                              </select>
                            ) : (
                              row.type
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <input
                                type="date"
                                value={utilEditing.date}
                                onChange={(e) => setUtilEditing({ ...utilEditing, date: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                              />
                            ) : (
                              formatMDY(row.date)
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                value={utilEditing.meterStart}
                                onChange={(e) => {
                                  const meterStart = e.target.value;
                                  const ms = parseFloat(meterStart.replace(/,/g, ""));
                                  const me = (utilEditing.meterEnd || "") !== "" ? parseFloat((utilEditing.meterEnd || "").replace(/,/g, "")) : NaN;
                                  const r = (utilEditing.rate || "") !== "" ? parseFloat((utilEditing.rate || "").replace(/,/g, "")) : NaN;
                                  let amount = utilEditing.amount;
                                  if (!isNaN(ms) && !isNaN(me) && !isNaN(r)) {
                                    const usage = me - ms;
                                    if (isFinite(usage)) amount = String(usage * r);
                                  }
                                  setUtilEditing({ ...utilEditing, meterStart, amount });
                                }}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-14 text-right"
                              />
                            ) : (
                              row.meterStart != null ? String(row.meterStart) : ""
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                value={utilEditing.meterEnd}
                                onChange={(e) => {
                                  const meterEnd = e.target.value;
                                  const me = parseFloat(meterEnd.replace(/,/g, ""));
                                  const ms = (utilEditing.meterStart || "") !== "" ? parseFloat((utilEditing.meterStart || "").replace(/,/g, "")) : NaN;
                                  const r = (utilEditing.rate || "") !== "" ? parseFloat((utilEditing.rate || "").replace(/,/g, "")) : NaN;
                                  let amount = utilEditing.amount;
                                  if (!isNaN(ms) && !isNaN(me) && !isNaN(r)) {
                                    const usage = me - ms;
                                    if (isFinite(usage)) amount = String(usage * r);
                                  }
                                  setUtilEditing({ ...utilEditing, meterEnd, amount });
                                }}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-14 text-right"
                              />
                            ) : (
                              row.meterEnd != null ? String(row.meterEnd) : ""
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              (() => {
                                const ms = parseFloat((utilEditing.meterStart || "").replace(/,/g, ""));
                                const me = parseFloat((utilEditing.meterEnd || "").replace(/,/g, ""));
                                const usage = !isNaN(ms) && !isNaN(me) ? me - ms : NaN;
                                const unit = utilEditing.type === "Water" ? "m³" : "kWh";
                                return <span>{isFinite(usage) ? `${usage} ${unit}` : ""}</span>;
                              })()
                            ) : (
                              (() => {
                                if (row.meterStart != null && row.meterEnd != null) {
                                  const unit = row.type === "Water" ? "m³" : "kWh";
                                  const u = (row.meterEnd as number) - (row.meterStart as number);
                                  return `${u} ${unit}`;
                                }
                                return "";
                              })()
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <input
                                type="text"
                                value={utilEditing.rate}
                                onChange={(e) => {
                                  const rate = e.target.value;
                                  const r = parseFloat(rate.replace(/,/g, ""));
                                  const ms = (utilEditing.meterStart || "") !== "" ? parseFloat((utilEditing.meterStart || "").replace(/,/g, "")) : NaN;
                                  const me = (utilEditing.meterEnd || "") !== "" ? parseFloat((utilEditing.meterEnd || "").replace(/,/g, "")) : NaN;
                                  let amount = utilEditing.amount;
                                  if (!isNaN(ms) && !isNaN(me) && !isNaN(r)) {
                                    const usage = me - ms;
                                    if (isFinite(usage)) amount = String(usage * r);
                                  }
                                  setUtilEditing({ ...utilEditing, rate, amount });
                                }}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-16"
                              />
                            ) : (
                              (() => {
                                if (row.rate != null) {
                                  const unit = row.type === "Water" ? "m³" : "kWh";
                                  return `₱${Number(row.rate).toLocaleString()} / ${unit}`;
                                }
                                return "";
                              })()
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap align-middle">
                            {isEditing ? (
                              <input
                                type="text"
                                value={utilEditing.amount}
                                onChange={(e) => setUtilEditing({ ...utilEditing, amount: e.target.value })}
                                readOnly={Boolean((utilEditing.rate || "").trim())}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-20"
                              />
                            ) : (
                              mounted ? `₱${Number(row.amount).toLocaleString()}` : "₱..."
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap align-middle">
                            {isEditing ? (
                              <select
                                value={utilEditing.status}
                                onChange={(e) => setUtilEditing({ ...utilEditing, status: e.target.value })}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px]"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                                <option value="Overdue">Overdue</option>
                              </select>
                            ) : (
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                                (row.status || "Pending") === "Paid" ? "bg-green-100 text-green-700" :
                                (row.status || "Pending") === "Overdue" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                                {row.status || "Pending"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap align-middle w-[88px]">
                            {isEditing ? (
                              <div className="flex justify-end gap-1">
                                <button onClick={applyUtilityEdit} className="p-1 rounded text-green-700 hover:bg-green-50">
                                  <Icons.Check size={14} />
                                </button>
                                <button onClick={cancelUtilityEdit} className="p-1 rounded text-slate-600 hover:bg-slate-100">
                                  <Icons.X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => startUtilityEdit(idx)} className="p-1 rounded text-blue-600 hover:bg-blue-50">
                                  <Icons.Pencil size={14} />
                                </button>
                                <button onClick={() => deleteUtilityEntry(idx)} className="p-1 rounded text-red-600 hover:bg-red-50">
                                  <Icons.Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2" colSpan={6}>Water Total</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {mounted ? `₱${utilities.filter(u => u.type === "Water").reduce((s, u) => s + (Number(u.amount) || 0), 0).toLocaleString()}` : "₱..."}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2" colSpan={6}>Electric Total</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {mounted ? `₱${utilities.filter(u => u.type === "Electric").reduce((s, u) => s + (Number(u.amount) || 0), 0).toLocaleString()}` : "₱..."}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="bg-slate-100 font-bold">
                      <td className="px-3 py-2" colSpan={6}>Total Utilities</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {mounted ? `₱${utilities.reduce((s, u) => s + (Number(u.amount) || 0), 0).toLocaleString()}` : "₱..."}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {utilScrollMax > 0 && (
                <div className="mt-1 px-1">
                  <input
                    type="range"
                    min={0}
                    max={utilScrollMax}
                    value={utilScrollX}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setUtilScrollX(v);
                      if (tableScrollRef.current) tableScrollRef.current.scrollLeft = v;
                    }}
                    className="w-full"
                  />
                </div>
              )}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold text-slate-600">12-Month Summary</div>
                  <button
                    onClick={() => setShowUtilSummary(s => !s)}
                    className="p-1 rounded text-blue-600 hover:bg-blue-50"
                    aria-label={showUtilSummary ? "Hide summary" : "Show summary"}
                  >
                    {showUtilSummary ? <Icons.ChevronUp size={14} /> : <Icons.ChevronDown size={14} />}
                  </button>
                </div>
                {showUtilSummary && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-slate-600">Year</label>
                      <select
                        value={utilYear}
                        onChange={(e) => setUtilYear(Number(e.target.value))}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] h-[22px] w-24"
                      >
                        {utilYears.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="min-w-full w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold">
                          <tr>
                            <th className="px-2 py-2 whitespace-nowrap w-28">Month</th>
                            <th className="px-2 py-2 whitespace-nowrap w-28">Water</th>
                            <th className="px-2 py-2 whitespace-nowrap w-28">Electric</th>
                            <th className="px-2 py-2 whitespace-nowrap w-28">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {utilMonths.map(({ key, label }) => {
                            const t = utilTotals[key] || { water: 0, electric: 0 };
                            const sum = t.water + t.electric;
                            return (
                              <tr key={key} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 whitespace-nowrap align-middle">{label}</td>
                                <td className="px-3 py-2 whitespace-nowrap align-middle">{mounted ? `₱${t.water.toLocaleString()}` : "₱..."}</td>
                                <td className="px-3 py-2 whitespace-nowrap align-middle">{mounted ? `₱${t.electric.toLocaleString()}` : "₱..."}</td>
                                <td className="px-3 py-2 whitespace-nowrap align-middle font-medium">{mounted ? `₱${sum.toLocaleString()}` : "₱..."}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
                  {sale.salesCategory === "Rental" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Adv. Deposit</p>
                        <p className="text-2xl font-black mt-1">
                          {mounted ? (() => {
                            const amt = Number(depositCfg.advanceAmount);
                            const mos = Number(depositCfg.advanceMonths);
                            if (!Number.isNaN(amt) && amt > 0 && !Number.isNaN(mos) && mos > 0) {
                              return `₱${(amt * mos).toLocaleString()}`;
                            }
                            const fallback = (Number(sale?.amount || 0) * (mos > 0 ? mos : 1));
                            return `₱${fallback.toLocaleString()}`;
                          })() : "₱..."}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Sec. Deposit</p>
                        <p className="text-2xl font-black mt-1">
                          {mounted ? (() => {
                            const amt = Number(depositCfg.securityAmount);
                            const mos = Number(depositCfg.securityMonths);
                            if (!Number.isNaN(amt) && amt > 0 && !Number.isNaN(mos) && mos > 0) {
                              return `₱${(amt * mos).toLocaleString()}`;
                            }
                            const fallback = (Number(sale?.amount || 0) * (mos > 0 ? mos : 1));
                            return `₱${fallback.toLocaleString()}`;
                          })() : "₱..."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining Balance</p>
                      <p className="text-2xl font-black mt-1">
                        {mounted ? `₱${(sale.amount * 0.8).toLocaleString()}` : "₱..."}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex gap-4">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase">Tenure</p>
                      <p className="text-xs font-bold">{sale.salesCategory === "Rental" ? (rentalMonths !== null ? `${rentalMonths} Months` : "12 Months") : "15 Years"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={printStatement} className="px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200 rounded transition-colors flex items-center gap-1">
            <Icons.Printer size={12} /> Print Statement
          </button>
          <button
            onClick={updateRecords}
            className="px-3 py-1.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1"
          >
            <Icons.Save size={12} /> Update Records
          </button>
        </div>
      </div>
    </div>
  );
}
