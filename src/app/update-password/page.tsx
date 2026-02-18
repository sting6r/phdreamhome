"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@lib/supabase";
import MainFooterCards from "../../components/MainFooterCards";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event: any, _session: any) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }: { data: any }) => { if (data.session) setReady(true); });
    try {
      const sp = new URLSearchParams(window.location.search);
      const code = sp.get("code");
      const token_hash = sp.get("token_hash");
      const type = sp.get("type");
      if (type === "recovery") setReady(true);
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ data, error }: { data: any, error: any }) => { if (!error && data.session) setReady(true); });
      } else if (token_hash && type === "recovery") {
        (supabase.auth as any).verifyOtp({ type: "recovery", token_hash }).then((res: any) => { if (!res?.error) setReady(true); });
      }
    } catch {}
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null); setLoading(true);
    try {
      if (!ready) throw new Error("Reset link invalid or expired");
      if (password.length < 8) throw new Error("Password must be at least 8 characters");
      if (password !== confirm) throw new Error("Passwords do not match");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error("Failed to update password");
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
          await fetch("/api/auth/session", { 
            method: "DELETE", 
            keepalive: true,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
      } catch {}
      
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}

      router.replace("/4120626");
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-sm mx-auto card">
        <h1 className="text-xl font-semibold mb-2">Set New Password</h1>
        <div className="text-xs text-black mb-4">Enter and confirm your new password.</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input 
                type={showPw ? "text" : "password"} 
                className="input pr-10" 
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.413 7.047 7.454 4 12 4s8.587 3.047 9.964 7.678c.04.135.04.274 0 .409C20.587 16.953 16.546 20 12 20s-8.587-3.047-9.964-7.678Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <div className="relative">
              <input 
                type={showPw ? "text" : "password"} 
                className="input pr-10" 
                value={confirm} 
                onChange={e=>setConfirm(e.target.value)} 
              />
            </div>
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {message && <div className="text-green-600 text-sm">{message}</div>}
          <button className="btn-blue w-full" disabled={loading}>{loading ? "Updating..." : "Update Password"}</button>
        </form>
        <div className="text-xs text-black mt-3"><a href="/4120626" className="text-black">Back to Login</a></div>
      </div>
      <MainFooterCards />
    </div>
  );
}
