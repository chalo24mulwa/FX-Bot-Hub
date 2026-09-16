"use client";

import { useState, useTransition } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { changePasswordAction } from "@/features/auth/actions";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    startTransition(async () => {
      try {
        await changePasswordAction({ currentPassword, newPassword });
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-password-current" className="text-sm font-medium text-slate-700">
          Current password
        </label>
        <PasswordInput
          id="change-password-current"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-password-new" className="text-sm font-medium text-slate-700">
          New password
        </label>
        <PasswordInput
          id="change-password-new"
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-password-confirm" className="text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <PasswordInput
          id="change-password-confirm"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Password changed.</p>}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
