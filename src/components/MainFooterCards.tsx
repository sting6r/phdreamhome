import React from "react";
import Link from "next/link";

export default function MainFooterCards() {
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="card p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-md border-none" style={{ backgroundColor: '#F9F5FF' }}>
        <div className="font-bold text-xl mb-3 text-purple-900">PhDreamHome</div>
        <div className="text-sm leading-relaxed text-gray-700">Helping people find the perfect home, where dreams become reality. We provide professional real estate services across the Philippines.</div>
        <Link prefetch={false} href="/about" className="mt-2 hover:text-purple-600 transition-colors block text-sm font-semibold">About</Link>
      </div>
      <div className="card p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-md border-none" style={{ backgroundColor: '#F9F5FF' }}>
        <div className="font-bold text-xl mb-3 text-purple-900">Quick Links</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700">
          <div className="space-y-2">
            <Link prefetch={false} href="/" className="hover:text-purple-600 transition-colors block">Home</Link>
            <Link prefetch={false} href="/properties/for-sale" className="hover:text-purple-600 transition-colors block">For Sale</Link>
            <Link prefetch={false} href="/properties/for-rent" className="hover:text-purple-600 transition-colors block">For Rent</Link>
            <Link prefetch={false} href="/properties/preselling" className="hover:text-purple-600 transition-colors block">Preselling</Link>
          </div>
          <div className="space-y-2">
            <Link prefetch={false} href="/properties/rfo" className="hover:text-purple-600 transition-colors block">RFO</Link>
            <Link prefetch={false} href="/blog" className="hover:text-purple-600 transition-colors block">Blog</Link>
            <Link prefetch={false} href="/about" className="hover:text-purple-600 transition-colors block">About</Link>
            <Link prefetch={false} href="/contact" className="hover:text-purple-600 transition-colors block">Contact</Link>
          </div>
        </div>
      </div>
      <div className="card p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-md border-none" style={{ backgroundColor: '#F9F5FF' }}>
        <div className="font-bold text-xl mb-3 text-purple-900">Top Developers</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm text-gray-700">
          {[
            "Ayala Land",
            "SMDC",
            "Megaworld",
            "Vista Land",
            "DMCI Homes",
            "Robinsons Land",
            "Filinvest Land",
            "Rockwell Land",
            "Federal Land",
            "Cebu Landmasters"
          ].map((dev, i) => (
            <div key={dev} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></div>
              <span className="truncate">{dev}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
