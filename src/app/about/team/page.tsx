import Link from "next/link";

export default function TeamPage() {
  return (
    <div className="container">
      <div className="card p-6 sm:p-8 space-y-4">
        <div className="text-2xl sm:text-3xl font-bold">Meet Our Team</div>
        <div className="text-sm sm:text-base text-slate-800">
          We are a multidisciplinary team of real estate professionals, technologists, and customer advocates committed to delivering a modern property experience across the Philippines.
        </div>
        <div className="text-sm sm:text-base text-slate-700">
          From regional experts to digital product builders, each member brings deep local knowledge and a focus on service so you can make confident decisions wherever you are.
        </div>
        <div className="mt-2">
          <Link prefetch={false} href="/contact" className="inline-flex items-center gap-2 rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-500 shadow-sm">
            Talk To Us
          </Link>
        </div>
      </div>
    </div>
  );
}
