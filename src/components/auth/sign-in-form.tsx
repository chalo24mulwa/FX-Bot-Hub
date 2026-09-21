"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/google-icon";
import { authErrorMessage } from "@/lib/auth-errors";

export function SignInForm({ googleEnabled, errorCode }: { googleEnabled: boolean; errorCode?: string }) {
  const oauthError = authErrorMessage(errorCode);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/marketplace");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">Welcome back — sign in to your account.</p>

        {oauthError && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {oauthError}
          </p>
        )}

        {googleEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-6 w-full gap-3 text-base"
              disabled={googleLoading}
              onClick={() => {
                setGoogleLoading(true);
                void signIn("google", { callbackUrl: "/marketplace" });
              }}
            >
              <GoogleIcon className="h-5 w-5" />
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </Button>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs uppercase tracking-wide text-slate-400">Or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sign-in-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <Input
              id="sign-in-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="sign-in-password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="sign-in-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 text-base"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" className="mt-2 w-full text-base" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className="font-medium text-slate-900 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
