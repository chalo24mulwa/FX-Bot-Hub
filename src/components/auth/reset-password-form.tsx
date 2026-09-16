"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Something went wrong. Try again.");
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold text-slate-900">Invalid reset link</h1>
        <p className="mt-2 text-sm text-slate-500">This link is missing its reset token. Request a new one below.</p>
        <Link href="/auth/forgot-password" className="mt-6 inline-block font-medium text-slate-900 hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Password reset</h1>
        <div className="mt-4 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
          Your password has been changed. You can now sign in with your new password.
        </div>
        <Button className="mt-6 w-full text-base" size="lg" onClick={() => router.push("/auth/sign-in")}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Set a new password</h1>
      <p className="mt-2 text-sm text-slate-500">Choose a new password for your account.</p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password-new" className="text-sm font-medium text-slate-700">
            New password
          </label>
          <PasswordInput
            id="reset-password-new"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-12 text-base"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password-confirm" className="text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <PasswordInput
            id="reset-password-confirm"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="h-12 text-base"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" size="lg" className="mt-2 w-full text-base" disabled={loading}>
          {loading ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </div>
  );
}
