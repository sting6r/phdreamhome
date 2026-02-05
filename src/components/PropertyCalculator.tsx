"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CurrencyInput from "./CurrencyInput";

interface PropertyCalculatorProps {
  id: string;
  initialPrice: number;
  initialDp: string;
  initialRate: number;
  initialTerm: number;
}

export default function PropertyCalculator({
  id,
  initialPrice,
  initialDp,
  initialRate,
  initialTerm,
}: PropertyCalculatorProps) {
  const router = useRouter();

  const [price, setPrice] = useState(initialPrice.toString());
  const [dp, setDp] = useState(initialDp);
  const [rate, setRate] = useState(initialRate.toString());
  const [term, setTerm] = useState(initialTerm.toString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (price) params.set("price", price);
    if (dp) params.set("dp", dp);
    if (rate) params.set("rate", rate);
    if (term) params.set("term", term);

    router.push(`/listing/${id}?${params.toString()}`, { scroll: false });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label className="text-xs text-slate-700">Property Price</label>
        <CurrencyInput
          name="price"
          value={price}
          onChange={setPrice}
          className="input border-[#DE6A4A]"
          placeholder="0.00"
        />
      </div>
      <div>
        <label className="text-xs text-slate-700">Down Payment</label>
        <CurrencyInput
          name="dp"
          value={dp}
          onChange={setDp}
          allowPercent={true}
          placeholder="Enter down payment (e.g. 20% or 1,000,000.00)"
          className="input border-[#DE6A4A]"
        />
      </div>
      <div>
        <label className="text-xs text-slate-700">Interest Rate (%)</label>
        <input
          name="rate"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Enter interest rate percentage"
          className="input border-[#DE6A4A]"
        />
      </div>
      <div>
        <label className="text-xs text-slate-700">Loan Term (Years)</label>
        <input
          name="term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Enter loan term"
          className="input border-[#DE6A4A]"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center rounded border border-[#DE6A4A] text-[#DE6A4A] px-4 py-2 text-sm hover:bg-[#DE6A4A] hover:text-white transition-colors"
      >
        Calculate
      </button>
    </form>
  );
}
