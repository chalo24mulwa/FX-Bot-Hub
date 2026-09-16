"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/google-icon";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => {
    getProviders().then((providers) => setGoogleAvailable(!!providers?.google));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong.");
      return;
    }
    router.push("/auth/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create an account</h1>
        <p className="mt-2 text-sm text-slate-500">Join to browse, buy, and sell EAs and indicators.</p>

        {googleAvailable && (
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
            <label htmlFor="sign-up-name" className="text-sm font-medium text-slate-700">
              Name
            </label>
            <Input
              id="sign-up-name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sign-up-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <Input
              id="sign-up-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sign-up-password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <PasswordInput
              id="sign-up-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-12 text-base"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" className="mt-2 w-full text-base" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
