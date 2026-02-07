"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabasePublic, createClientSideClient } from "@lib/supabase";

import { Suspense } from "react";

function LoginPageContent() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") ?? "/dashboard";
  const urlError = sp.get("error");
  const router = useRouter();
  const isPreviewPing = Boolean(sp.get("ide_webview_request_time"));
  const supabase = createClientSideClient();

  useEffect(() => {
    if (urlError) {
      setErr(urlError);
    }
  }, [urlError]);
  async function signInWithGoogle() {
    setLoading(true);
    setErr(null);
    try {
      // Use the current origin to ensure the redirect matches the domain the user is on
      const origin = window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
          skipBrowserRedirect: true,
          queryParams: { 
            access_type: "offline", 
            prompt: "consent" 
          }
        }
      });
      if (error) throw error;

      if (data?.url) {
        // Use window.location.assign for a clean redirect. 
        // If in an iframe (like Trae preview), try to redirect the top window to avoid X-Frame-Options issues.
        if (window.self !== window.top) {
          window.top!.location.href = data.url;
        } else {
          window.location.assign(data.url);
        }
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      setErr(error.message || "Google sign-in failed");
      setLoading(false);
    }
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isPreviewPing) router.replace(callbackUrl);
    });
  }, [callbackUrl, isPreviewPing, router, supabase]);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    setLoading(false);
    if (error || !data.session) { 
      setErr(error?.message || "Invalid credentials"); 
      return; 
    }
    
    // Sync user with Railway DB
    try {
      await fetch("/api/auth/sync-user", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          userId: data.session.user.id, 
          email: data.session.user.email 
        }) 
      });
    } catch (syncError) {
      console.error("Failed to sync user on login:", syncError);
    }

    await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: data.session.access_token }) });
    router.replace(callbackUrl);
  }
  return (
    <div className="container py-10">
      <div className="max-w-sm mx-auto card">
        <h1 className="text-xl font-semibold mb-2">Login</h1>
        <div className="text-xs text-gray-600 mb-4">Enter your credentials to access your account.</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input h-12" placeholder="your.email@example.com" value={identifier} onChange={e=>setIdentifier(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="input h-12 pr-10" 
                placeholder="••••••••" 
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
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
            <div className="text-xs text-sky-600 mt-1"><a href="/forgot-password" title="Forgot Password?" className="text-sky-600">Forgot Password?</a></div>
          </div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <button className="btn-blue w-full h-12 rounded-lg" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
        </form>
        <div className="mt-3">
          <button className="w-full h-12 bg-white border border-gray-300 rounded-lg px-4 text-sm flex items-center justify-center gap-2 hover:bg-gray-50" onClick={signInWithGoogle} disabled={loading}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.99h5.68c-.24 1.49-1.72 4.36-5.68 4.36-3.42 0-6.21-2.82-6.21-6.31s2.79-6.31 6.21-6.31c1.96 0 3.27.83 4.02 1.54l2.74-2.66C17.31 3.14 14.9 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10c5.77 0 9.6-4.05 9.6-9.74 0-.65-.07-1.14-.16-1.61H12z"/><path fill="#34A853" d="M3.48 7.15l3.28 2.41C7.63 7.06 9.66 5.69 12 5.69c1.96 0 3.27.83 4.02 1.54l2.74-2.66C17.31 3.14 14.9 2 12 2 8.16 2 4.82 4.25 3.48 7.15z"/><path fill="#4A90E2" d="M12 22c2.65 0 4.88-.87 6.51-2.36l-3.02-2.47c-.83.58-1.95 1-3.49 1-2.26 0-4.19-1.52-4.87-3.58l-3.13 2.41C5.76 19.85 8.62 22 12 22z"/><path fill="#FBBC05" d="M21.6 12.26c0-.65-.07-1.14-.16-1.61H12v3.99h5.68c-.24 1.49-1.72 4.36-5.68 4.36-1.61 0-3.09-.55-4.22-1.48l-3.13 2.41C6.03 21.69 8.78 23 12 23c5.77 0 9.6-4.05 9.6-9.74z"/></svg>
            <span>Sign in with Google</span>
          </button>
        </div>
        <div className="text-xs text-black mt-3">Don&apos;t have an account? <a href="/register" className="text-sky-600">Sign up</a></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-sm mx-auto card">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
