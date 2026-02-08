"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClientSideClient } from "@lib/supabase";

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
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8">
        <div className="card shadow-xl p-8 bg-white border border-slate-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h1>
            <p className="mt-2 text-sm text-slate-600">Please sign in to access your dashboard</p>
          </div>
          
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
              <input 
                type="email" 
                className="input h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
                placeholder="name@example.com" 
                value={identifier} 
                onChange={e=>setIdentifier(e.target.value)} 
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <a href="/forgot-password" title="Forgot Password?" className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors">Forgot password?</a>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="input h-12 pr-12 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
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

            {err && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 animate-in fade-in slide-in-from-left-2">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700 font-medium">{err}</p>
                  </div>
                </div>
              </div>
            )}

            <button 
              type="submit"
              className="btn-blue w-full h-12 rounded-lg font-bold text-base shadow-lg shadow-sky-100 hover:shadow-sky-200 transition-all active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm uppercase">
              <span className="bg-white px-4 text-slate-500 font-bold tracking-widest text-[10px]">Or continue with</span>
            </div>
          </div>

          <button 
            className="w-full h-12 bg-white border border-slate-200 rounded-lg px-4 text-sm font-semibold text-slate-700 flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]" 
            onClick={signInWithGoogle} 
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.99h5.68c-.24 1.49-1.72 4.36-5.68 4.36-3.42 0-6.21-2.82-6.21-6.31s2.79-6.31 6.21-6.31c1.96 0 3.27.83 4.02 1.54l2.74-2.66C17.31 3.14 14.9 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10c5.77 0 9.6-4.05 9.6-9.74 0-.65-.07-1.14-.16-1.61H12z"/>
              <path fill="#34A853" d="M3.48 7.15l3.28 2.41C7.63 7.06 9.66 5.69 12 5.69c1.96 0 3.27.83 4.02 1.54l2.74-2.66C17.31 3.14 14.9 2 12 2 8.16 2 4.82 4.25 3.48 7.15z"/>
              <path fill="#4A90E2" d="M12 22c2.65 0 4.88-.87 6.51-2.36l-3.02-2.47c-.83.58-1.95 1-3.49 1-2.26 0-4.19-1.52-4.87-3.58l-3.13 2.41C5.76 19.85 8.62 22 12 22z"/>
              <path fill="#FBBC05" d="M21.6 12.26c0-.65-.07-1.14-.16-1.61H12v3.99h5.68c-.24 1.49-1.72 4.36-5.68 4.36-1.61 0-3.09-.55-4.22-1.48l-3.13 2.41C6.03 21.69 8.78 23 12 23c5.77 0 9.6-4.05 9.6-9.74z"/>
            </svg>
            Google
          </button>

          <p className="mt-8 text-center text-sm text-slate-600">
            Don&apos;t have an account? <a href="/register" className="font-bold text-sky-600 hover:text-sky-700 transition-colors">Sign up for free</a>
          </p>
        </div>
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
