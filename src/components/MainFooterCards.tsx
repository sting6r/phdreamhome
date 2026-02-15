"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MainFooterCards() {
  const pathname = usePathname();

  const LinkItem = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link 
        prefetch={false} 
        href={href} 
        className={`transition-colors block w-fit relative pb-0.5 hover:text-purple-600 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-purple-600 after:transition-transform after:duration-300 ${isActive ? "text-purple-600 after:scale-x-100" : "text-gray-700 after:scale-x-0 hover:after:scale-x-100"}`}
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="card p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-md border-none" style={{ backgroundColor: '#F9F5FF' }}>
        <div className="font-bold text-xl mb-3 text-purple-900">PhDreamHome</div>
        <div className="text-sm leading-relaxed text-gray-700">Helping people find the perfect home, where dreams become reality. We provide professional real estate services across the Philippines.</div>
        <div className="mt-2">
          <LinkItem href="/about">About</LinkItem>
        </div>
      </div>
      <div className="card p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-md border-none" style={{ backgroundColor: '#F9F5FF' }}>
        <div className="font-bold text-xl mb-3 text-purple-900">Quick Links</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="space-y-2">
            <LinkItem href="/">Home</LinkItem>
            <LinkItem href="/properties/for-sale">For Sale</LinkItem>
            <LinkItem href="/properties/for-rent">For Rent</LinkItem>
            <LinkItem href="/properties/preselling">Preselling</LinkItem>
          </div>
          <div className="space-y-2">
            <LinkItem href="/properties/rfo">RFO</LinkItem>
            <LinkItem href="/blog">Blog</LinkItem>
            <LinkItem href="/about">About</LinkItem>
            <LinkItem href="/contact">Contact</LinkItem>
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
