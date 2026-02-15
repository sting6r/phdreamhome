"use client";
import { useState } from "react";
import { supabase } from "@lib/supabase";
import MainFooterCards from "../../components/MainFooterCards";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"success" | "error" | null>(null);

  function getFriendlyError(msg: string) {
    if (msg.includes("rate limit exceeded")) return "Too many attempts. Please wait a few minutes before trying again.";
    if (msg.includes("already registered")) return "Email already registered";
    return msg;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password });
    setLoading(false);
    if (error || !data.user) { 
      setErr(getFriendlyError(error?.message || "Registration failed")); 
      return; 
    }
    try {
      console.log("Attempting to sync user from register page.");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        await fetch("/api/auth/sync-user", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ userId: data.user.id, email: form.email }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
      console.log("Sync user request successful from register page.");
    } catch (syncError: any) {
      console.error("Sync user request failed from register page:", syncError);
    }
    setMsg("Check your email for verification link");
  }
  async function resend() {
    setResendMsg(null);
    setResendStatus(null);
    setResending(true);
    try {
      const email = form.email;
      if (!email) { 
        setResendMsg("Enter email first"); 
        setResendStatus("error");
        return; 
      }
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        console.error("Resend error:", error);
        setResendMsg(getFriendlyError(error.message || "Failed to send verification email"));
        setResendStatus("error");
      } else {
        setResendMsg("Verification email sent!");
        setResendStatus("success");
      }
    } finally {
      setResending(false);
    }
  }
  return (
    <div className="container py-10">
      <div className="max-w-sm mx-auto card">
        <h1 className="text-xl font-semibold mb-4">Create Account</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><label className="label">Email</label><input className="input" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} /></div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="input pr-10" 
                value={form.password} 
                onChange={e=>setForm({...form, password: e.target.value})} 
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
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
          {err && <div className="text-red-600 text-sm">{err}</div>}
          {err === "Email already registered" && <div className="text-xs"><a href="/4120626" className="text-black">Already have an account? Login</a></div>}
          {msg && (
            <div className="space-y-2">
              <div className="text-green-600 text-sm">{msg}</div>
              <button type="button" className="btn-blue w-full" onClick={resend} disabled={resending}>{resending ? "Sending..." : "Send Email Verification"}</button>
              {resendMsg && (
                <div className={`text-xs ${resendStatus === "error" ? "text-red-600" : "text-green-600"}`}>
                  {resendMsg}
                </div>
              )}
            </div>
          )}
          <button className="btn w-full" disabled={loading}>{loading ? "Submitting..." : "Register"}</button>
        </form>
      </div>
      <MainFooterCards />
    </div>
  );
}
