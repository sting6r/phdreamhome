import Link from "next/link";

export default function MissionPage() {
  return (
    <div className="container">
      <div className="card p-6 sm:p-8 space-y-4">
        <div className="text-2xl sm:text-3xl font-bold">Our Mission</div>
        <div className="text-sm sm:text-base text-slate-800">
          To simplify the complex Philippine real estate market through transparency, innovation, and personalized service. We provide a digital‑first experience that empowers you to make informed decisions with confidence.
        </div>
        <div className="text-sm sm:text-base text-slate-700">
          We combine curated listings, local expertise, and end‑to‑end support with responsive tools to help you move from search to ownership smoothly.
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Link prefetch={false} href="/about" className="inline-flex items-center gap-2 rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-500 shadow-sm">
            Learn More
          </Link>
          <Link prefetch={false} href="/contact" className="inline-flex items-center gap-2 rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-500 shadow-sm">
            Talk To Us
          </Link>
        </div>
      </div>
    </div>
  );
}
