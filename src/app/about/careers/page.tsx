import Link from "next/link";

export default function CareersPage() {
  return (
    <div className="container">
      <div className="card p-6 sm:p-8 space-y-4">
        <div className="text-2xl sm:text-3xl font-bold">Careers at PHDreamHome</div>
        <div className="text-sm sm:text-base text-slate-800">
          Join a team building modern, customer‑centric real estate experiences across the Philippines. We value initiative, integrity, and a bias for action.
        </div>
        <div className="text-sm sm:text-base text-slate-700">
          Roles span property advisory, operations, marketing, and product. If you share our mission to make home‑buying accessible and stress‑free, we’d love to hear from you.
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Link prefetch={false} href="/contact" className="inline-flex items-center gap-2 rounded-md bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-500 shadow-sm">
            Contact Us
          </Link>
          <Link prefetch={false} href="/about" className="inline-flex items-center gap-2 rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-500 shadow-sm">
            Learn About Us
          </Link>
        </div>
      </div>
    </div>
  );
}
