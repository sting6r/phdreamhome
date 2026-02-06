import Link from "next/link";
import Image from "next/image";
import MainFooterCards from "@/components/MainFooterCards";

export default function AboutPage() {
  const heroBg = process.env.NEXT_PUBLIC_ABOUT_BG || "";
  return (
    <div className="space-y-10">
      <div className="relative h-[42vh] sm:h-[55vh] rounded-md overflow-hidden">
        <div
          className={heroBg ? "absolute inset-0 bg-center bg-cover" : "absolute inset-0"}
          style={heroBg ? { backgroundImage: `url(${heroBg})` } : {}}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#32004A]/70 via-[#32004A]/60 to-[#32004A]/30" />
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center text-center gap-3 px-4">
          <div className="text-white text-3xl sm:text-5xl font-extrabold tracking-tight">YOUR VISION. OUR MISSION.</div>
          <div className="text-white text-sm sm:text-base">Beyond Listings. We Build Legacies.</div>
          <Link
            prefetch={false}
            href="/contact"
            className="mt-2 pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#7E2BF5] hover:bg-[#6F24E3] text-white px-6 py-2 text-sm font-bold shadow-lg active:scale-[0.98]"
          >
            MEET OUR TEAM
          </Link>
        </div>
      </div>

      <div className="container">
        <div className="card p-6 sm:p-8 space-y-4">
          <div className="text-2xl sm:text-3xl font-bold">About PHDreamHome.com: Turning Visions into Addresses</div>
          <div className="text-sm sm:text-base text-slate-700">
            Your Trusted Partner in the Philippine Real Estate Journey
          </div>
          <div className="text-sm sm:text-base text-slate-800">
            At PHDreamHome.com, we believe that finding a home is about more than just square footage and floor plans—it’s about finding where your future begins. Whether you are a first-time homebuyer, a Balikbayan returning to your roots, or an investor looking for the next big opportunity in the archipelago, we are here to bridge the gap between your search and your success.
          </div>
          <div className="text-lg font-semibold">Our Mission</div>
          <div className="text-sm sm:text-base text-slate-800">
            To simplify the complex Philippine real estate market through transparency, innovation, and personalized service. We strive to provide a digital-first experience that empowers you to make informed decisions with confidence.
          </div>
        </div>
      </div>

      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-stretch">
          <div className="card p-6 sm:p-8">
            <div className="text-xl sm:text-2xl font-bold mb-4">Why Choose PHDreamHome?</div>
            <div className="text-sm sm:text-base text-slate-700 mb-6">
              The Philippine market is vibrant but can be overwhelming. We stand out by offering:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 grid place-items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M21 10l-6 6-3-3-6 6"/></svg>
                  </div>
                  <div className="font-semibold text-slate-900">Curated Listings</div>
                </div>
                <div className="text-sm text-slate-700 mt-2">We handpick homes and investments that meet high standards of quality and value.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 grid place-items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M3 3h18v18H3z"/></svg>
                  </div>
                  <div className="font-semibold text-slate-900">Local Expertise</div>
                </div>
                <div className="text-sm text-slate-700 mt-2">From Metro Manila to Palawan and Cebu, we understand the nuances of every region.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 grid place-items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M12 2l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-8.5L2 9h7z"/></svg>
                  </div>
                  <div className="font-semibold text-slate-900">End‑to‑End Support</div>
                </div>
                <div className="text-sm text-slate-700 mt-2">We guide you through legalities, paperwork, and financing hurdles.</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 grid place-items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M2 7h20M2 12h20M2 17h20"/></svg>
                  </div>
                  <div className="font-semibold text-slate-900">Innovation</div>
                </div>
                <div className="text-sm text-slate-700 mt-2">Our AI-powered assistant is available 24/7 to answer your questions instantly.</div>
              </div>
            </div>
          </div>
          <div className="card relative overflow-hidden min-h-16 md:min-h-[300px] lg:min-h-16 w-full h-full">
            <div className="absolute inset-0 bg-slate-100" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[88%] max-w-[420px] aspect-[4/3] rounded-2xl overflow-hidden ring-1 ring-black/10 shadow-xl">
                <Image src="/girl.png" alt="PH Dream Home Team" fill className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-[#E9D5FF]" />
        <div className="container relative py-4 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 card bg-transparent shadow-none">
              <div className="text-2xl font-bold text-[#32004A]">Our Story</div>
              <div className="mt-2 text-sm sm:text-base text-slate-800">
                PHDreamHome was founded on a simple observation: the dream of owning a home in the Philippines should be accessible, modern, and stress-free. In a world where technology is evolving, we saw an opportunity to bring world-class digital tools to the local real estate scene, ensuring that every Filipino—at home or abroad—has a reliable place to find their piece of paradise.
              </div>
              <div className="mt-4 text-sm sm:text-base italic text-slate-700">
                &quot;A house is made of bricks and beams; a home is made of hopes and dreams. Our job is to make sure those dreams are built on a solid foundation.&quot;
              </div>
            </div>
            <div className="card">
              <div className="text-xl font-bold mb-2">Let’s Find Your Dream Home</div>
              <div className="text-sm text-slate-700">
                The market moves fast, but so do we. Explore our latest listings or speak with our AI-powered property assistant right now to find a match tailored to your budget and lifestyle.
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link prefetch={false} href="/properties/for-sale" className="inline-flex items-center gap-2 rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-500 shadow-sm">
                  Browse Listings
                </Link>
                <Link prefetch={false} href="/contact" className="inline-flex items-center gap-2 rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-500 shadow-sm">
                  Talk To Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <MainFooterCards />
      </div>
    </div>
  );
}
