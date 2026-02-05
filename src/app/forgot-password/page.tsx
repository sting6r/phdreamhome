"use client";
import { useState } from "react";
import { supabasePublic } from "@lib/supabase";
import MainFooterCards from "../../components/MainFooterCards";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { error } = await supabasePublic.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/update-password` });
      if (error) throw new Error("Failed to send reset email");
      setMessage("If an account with that email exists, a password reset link has been sent.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-sm mx-auto card">
        <h1 className="text-xl font-semibold mb-2">Forgot Password</h1>
        <div className="text-xs text-black mb-4">Enter your email to receive a password reset link.</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {message && <div className="text-green-600 text-sm">{message}</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button className="btn-blue w-full" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <div className="text-xs text-black mt-3">
          <a href="/4120626" className="text-black">Back to Login</a>
        </div>
      </div>
      <MainFooterCards />
    </div>
  );
}
